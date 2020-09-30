#!/usr/bin/env node

process.title = "native-meeting-server";

const config = require("./config/config");
const fs = require("fs");
const http = require("http");
const spdy = require("spdy");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const mediasoup = require("mediasoup");
const { AwaitQueue } = require("awaitqueue");
const Logger = require("./lib/Logger");
const Room = require("./lib/Room");
const Peer = require("./lib/Peer");
const Native = require("./lib/Native");
const helmet = require("helmet");

const userRoles = require("./userRoles");

// auth
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

const redis = require("redis");
const redisClient = redis.createClient(config.redisOptions);
const expressSession = require("express-session");
const RedisStore = require("connect-redis")(expressSession);
const sharedSession = require("express-socket.io-session");

const interactiveServer = require("./lib/interactiveServer");
const { v4: uuidv4 } = require("uuid");

/* eslint-disable no-console */
console.log("- process.env.DEBUG:", process.env.DEBUG);
console.log(
  "- config.mediasoup.worker.logLevel:",
  config.mediasoup.worker.logLevel
);
console.log(
  "- config.mediasoup.worker.logTags:",
  config.mediasoup.worker.logTags
);
/* eslint-enable no-console */

const logger = new Logger();

const queue = new AwaitQueue();

let statusLogger = null;

if ("StatusLogger" in config) statusLogger = new config.StatusLogger();

// mediasoup Workers.
// @type {Array<mediasoup.Worker>}
const mediasoupWorkers = [];

// Map of Room instances indexed by roomId.
const rooms = new Map();

// Map of Peer instances indexed by peerId.
const peers = new Map();

// TLS server configuration.
const tls = {
  cert: fs.readFileSync(config.tls.cert),
  key: fs.readFileSync(config.tls.key),
  secureOptions: "tlsv12",
  ciphers: [
    "ECDHE-ECDSA-AES128-GCM-SHA256",
    "ECDHE-RSA-AES128-GCM-SHA256",
    "ECDHE-ECDSA-AES256-GCM-SHA384",
    "ECDHE-RSA-AES256-GCM-SHA384",
    "ECDHE-ECDSA-CHACHA20-POLY1305",
    "ECDHE-RSA-CHACHA20-POLY1305",
    "DHE-RSA-AES128-GCM-SHA256",
    "DHE-RSA-AES256-GCM-SHA384",
  ].join(":"),
  honorCipherOrder: true,
};

const app = express();

app.use(helmet.hsts());
app.use(cors({ origin: [config.origin], credentials: true }));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const session = expressSession({
  secret: config.cookieSecret,
  name: config.cookieName,
  resave: true,
  saveUninitialized: true,
  store: new RedisStore({ client: redisClient }),
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 60 * 60 * 1000, // Expire after 1 hour since last request from user
  },
});

if (config.trustProxy) {
  app.set("trust proxy", config.trustProxy);
}

app.use(session);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

let mainListener;
let io;

async function run() {
  try {
    // Open the interactive server.
    await interactiveServer(rooms, peers);

    await setupAuth();

    // Run a mediasoup Worker.
    await runMediasoupWorkers();

    // Run HTTPS server.
    await runHttpsServer();

    // Run WebSocketServer.
    await runWebSocketServer();

    const errorHandler = (err, req, res) => {
      const trackingId = uuidv4();

      res.status(500).send(
        `<h1>Internal Server Error</h1>
				<p>If you report this error, please also report this 
				<i>tracking ID</i> which makes it possible to locate your session
				in the logs which are available to the system administrator: 
				<b>${trackingId}</b></p>`
      );
      logger.error(
        "Express error handler dump with tracking ID: %s, error dump: %o",
        trackingId,
        err
      );
    };

    // eslint-disable-next-line no-unused-vars
    app.use(errorHandler);
  } catch (error) {
    logger.error('run() [error:"%o"]', error);
  }
}

function statusLog() {
  if (statusLogger) {
    statusLogger.log({
      rooms: rooms,
      peers: peers,
    });
  }
}

function setupLocal() {
  const localStrategy = new LocalStrategy(function (username, password, done) {
    return Native.auth(username, password, done);
  });

  passport.use("local", localStrategy);
}

function authLocal() {
  return passport.authenticate("local", { failWithError: true });
}

async function setupAuth() {
  setupLocal();

  app.use(passport.initialize());
  app.use(passport.session());

  app.post("/auth/login", authLocal(), async (req, res) => {
    const { roomId, peerId } = req.body;
    const { rooms } = req.user;

    req.session.peerId = peerId;
    req.session.roomId = roomId;

    let peer = peers.get(peerId);

    // User has no socket session yet, make temporary
    if (!peer) peer = new Peer({ id: peerId, roomId });

    if (peer.roomId !== roomId)
      throw new Error("peer authenticated with wrong room");

    const userinfo = {
      id: req.user.id,
      displayName: req.user.displayName,
      email: req.user.email,
      picture: req.user.picture,
      owner: rooms.includes(roomId),
    };

    if (typeof config.userMapping === "function") {
      await config.userMapping({ peer, roomId, userinfo });
    }

    peer.authenticated = true;

    res.json(userinfo);
  });

  app.get("/auth/logout", (req, res) => {
    const { peerId } = req.session;

    const peer = peers.get(peerId);

    if (peer) {
      for (const role of peer.roles) {
        if (role !== userRoles.NORMAL) peer.removeRole(role);
      }
    }

    req.logout();
    req.session.destroy(() => res.json({ loggedOut: true }));
  });
}

async function runHttpsServer() {
  app.use(compression());

  app.use(
    "/.well-known/acme-challenge",
    express.static("public/.well-known/acme-challenge")
  );

  app.all("*", async (req, res, next) => {
    if (req.secure || config.httpOnly) {
      let ltiURL;

      try {
        ltiURL = new URL(
          `${req.protocol}://${req.get("host")}${req.originalUrl}`
        );
      } catch (error) {
        logger.error("Error parsing LTI url: %o", error);
      }

      if (
        req.isAuthenticated &&
        req.user &&
        req.user.displayName &&
        !ltiURL.searchParams.get("displayName") &&
        !isPathAlreadyTaken(req.url)
      ) {
        ltiURL.searchParams.append("displayName", req.user.displayName);

        res.redirect(ltiURL);
      } else return next();
    } else res.redirect(`https://${req.hostname}${req.url}`);
  });

  // Serve all files in the public folder as static files.
  app.use(express.static("public"));

  if (config.httpOnly === true) {
    // http
    mainListener = http.createServer(app);
  } else {
    // https
    mainListener = spdy.createServer(tls, app);

    // http
    const redirectListener = http.createServer(app);

    if (config.listeningHost)
      redirectListener.listen(
        config.listeningRedirectPort,
        config.listeningHost
      );
    else redirectListener.listen(config.listeningRedirectPort);
  }

  // https or http
  if (config.listeningHost)
    mainListener.listen(config.listeningPort, config.listeningHost);
  else mainListener.listen(config.listeningPort);
}

function isPathAlreadyTaken(url) {
  const alreadyTakenPath = [
    "/config/",
    "/static/",
    "/images/",
    "/sounds/",
    "/favicon.",
    "/auth/",
  ];

  alreadyTakenPath.forEach((path) => {
    if (url.toString().startsWith(path)) return true;
  });

  return false;
}

/**
 * Create a WebSocketServer to allow WebSocket connections from browsers.
 */
async function runWebSocketServer() {
  io = require("socket.io")(mainListener);

  io.use(
    sharedSession(session, {
      autoSave: true,
    })
  );

  // Handle connections from clients.
  io.on("connection", (socket) => {
    const { roomId, peerId } = socket.handshake.query;

    if (!roomId || !peerId) {
      logger.warn("connection request without roomId and/or peerId");

      socket.disconnect(true);

      return;
    }

    logger.info(
      'connection request [roomId:"%s", peerId:"%s"]',
      roomId,
      peerId
    );

    queue
      .push(async () => {
        const { token } = socket.handshake.session;
        const room = await getOrCreateRoom({ roomId });

        let peer = peers.get(peerId);
        let returning = false;

        if (peer && !token) {
          // Don't allow hijacking sessions
          socket.disconnect(true);

          return;
        } else if (token && room.verifyPeer({ id: peerId, token })) {
          // Returning user, remove if old peer exists
          if (peer) peer.close();

          returning = true;
        }

        peer = new Peer({ id: peerId, roomId, socket });

        peers.set(peerId, peer);

        peer.on("close", () => {
          peers.delete(peerId);

          statusLog();
        });

        if (
          Boolean(socket.handshake.session.passport) &&
          Boolean(socket.handshake.session.passport.user)
        ) {
          const {
            id,
            displayName,
            picture,
            email,
            rooms,
          } = socket.handshake.session.passport.user;

          const owner = rooms.includes(roomId);

          peer.authId = id;
          peer.displayName = displayName;
          peer.picture = picture;
          peer.email = email;
          peer.authenticated = true;
          peer.owner = owner;

          const userinfo = { id, displayName, email, picture, owner };

          if (typeof config.userMapping === "function") {
            await config.userMapping({ peer, roomId, userinfo });
          }
        }

        room.handlePeer({ peer, returning });

        statusLog();
      })
      .catch((error) => {
        logger.error(
          'room creation or room joining failed [error:"%o"]',
          error
        );

        if (socket) socket.disconnect(true);

        return;
      });
  });
}

/**
 * Launch as many mediasoup Workers as given in the configuration file.
 */
async function runMediasoupWorkers() {
  const { numWorkers } = config.mediasoup;

  logger.info("running %d mediasoup Workers...", numWorkers);

  for (let i = 0; i < numWorkers; ++i) {
    const worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.worker.logLevel,
      logTags: config.mediasoup.worker.logTags,
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    });

    worker.on("died", () => {
      logger.error(
        "mediasoup Worker died, exiting  in 2 seconds... [pid:%d]",
        worker.pid
      );

      setTimeout(() => process.exit(1), 2000);
    });

    mediasoupWorkers.push(worker);
  }
}

/**
 * Get a Room instance (or create one if it does not exist).
 */
async function getOrCreateRoom({ roomId }) {
  let room = rooms.get(roomId);

  // If the Room does not exist create a new one.
  if (!room) {
    logger.info('creating a new Room [roomId:"%s"]', roomId);

    room = await Room.create({ mediasoupWorkers, roomId });

    rooms.set(roomId, room);

    statusLog();

    room.on("close", () => {
      rooms.delete(roomId);

      statusLog();
    });
  }

  return room;
}

run();
