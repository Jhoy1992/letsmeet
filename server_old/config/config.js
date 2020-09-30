const os = require("os");
const userRoles = require("../userRoles");

const { BYPASS_ROOM_LOCK, BYPASS_LOBBY } = require("../access");

const {
  CHANGE_ROOM_LOCK,
  PROMOTE_PEER,
  SEND_CHAT,
  MODERATE_CHAT,
  SHARE_SCREEN,
  EXTRA_VIDEO,
  SHARE_FILE,
  MODERATE_FILES,
  MODERATE_ROOM,
} = require("../permissions");

module.exports = {
  // URI and key for requesting geoip-based TURN server closest to the client
  turnAPIKey: "examplekey",
  turnAPIURI: "https://example.com/api/turn",
  turnAPIparams: {
    uri_schema: "turn",
    transport: "tcp",
    ip_ver: "ipv4",
    servercount: "2",
  },

  // Backup turnservers if REST fails or is not configured
  backupTurnServers: [
    {
      urls: ["turn:turn.example.com:443?transport=tcp"],
      username: "example",
      credential: "example",
    },
  ],
  fileTracker: "wss://tracker.lab.vvc.niif.hu:443",
  redisOptions: {},
  // session cookie secret
  cookieSecret: "T0P-S3cR3t_cook!e",
  cookieName: "native-meeting.sid",
  // if you use encrypted private key the set the passphrase
  tls: {
    cert: `${__dirname}/../certs/mediasoup-demo.localhost.cert.pem`,
    // passphrase: 'key_password'
    key: `${__dirname}/../certs/mediasoup-demo.localhost.key.pem`,
  },
  // listening Host or IP
  // If omitted listens on every IP. ("0.0.0.0" and "::")
  // listeningHost: 'localhost',
  // Listening port for https server.
  listeningPort: 5000,
  // Any http request is redirected to https.
  // Listening port for http server.
  listeningRedirectPort: 5001,
  // Listens only on http, only on listeningPort
  // listeningRedirectPort disabled
  // use case: loadbalancer backend
  httpOnly: false,
  // WebServer/Express trust proxy config for httpOnly mode
  // You can find more info:
  //  - https://expressjs.com/en/guide/behind-proxies.html
  //  - https://www.npmjs.com/package/proxy-addr
  // use case: loadbalancer backend
  trustProxy: "",
  // This logger class will have the log function
  // called every time there is a room created or destroyed,
  // or peer created or destroyed. This would then be able
  // to log to a file or external service.
  /* StatusLogger          : class
	{
		constructor()
		{
			this._queue = new AwaitQueue();
		}

		// rooms: rooms object
		// peers: peers object
		// eslint-disable-next-line no-unused-vars
		async log({ rooms, peers })
		{
			this._queue.push(async () =>
			{
				// Do your logging in here, use queue to keep correct order

				// eslint-disable-next-line no-console
				console.log('Number of rooms: ', rooms.size);
				// eslint-disable-next-line no-console
				console.log('Number of peers: ', peers.size);
			})
				.catch((error) =>
				{
					// eslint-disable-next-line no-console
					console.log('error in log', error);
				});
		}
	}, */

  // eslint-disable-next-line no-unused-vars
  userMapping: async ({ peer, roomId, userinfo }) => {
    if (userinfo.picture != null) {
      if (!userinfo.picture.match(/^http/g)) {
        peer.picture = `data:image/jpeg;base64, ${userinfo.picture}`;
      } else {
        peer.picture = userinfo.picture;
      }
    }

    if (userinfo.nickname != null) {
      peer.displayName = userinfo.nickname;
    }

    if (userinfo.name != null) {
      peer.displayName = userinfo.name;
    }

    if (userinfo.email != null) {
      peer.email = userinfo.email;
    }

    if (Math.random() >= 0.5) {
      peer.addRole(userRoles.MODERATOR);
      peer.addRole(userRoles.ADMIN);
    }

    console.log(peer.roles);
  },
  // All users have the role "NORMAL" by default. Other roles need to be
  // added in the "userMapping" function. The following accesses and
  // permissions are arrays of roles. Roles can be changed in userRoles.js
  //
  // Example:
  // [ userRoles.MODERATOR, userRoles.AUTHENTICATED ]
  accessFromRoles: {
    // The role(s) will gain access to the room
    // even if it is locked (!)
    [BYPASS_ROOM_LOCK]: [userRoles.ADMIN],
    // The role(s) will gain access to the room without
    // going into the lobby. If you want to restrict access to your
    // server to only directly allow authenticated users, you could
    // add the userRoles.AUTHENTICATED to the user in the userMapping
    // function, and change to BYPASS_LOBBY : [ userRoles.AUTHENTICATED ]
    [BYPASS_LOBBY]: [userRoles.NORMAL],
  },
  permissionsFromRoles: {
    // The role(s) have permission to lock/unlock a room
    [CHANGE_ROOM_LOCK]: [userRoles.MODERATOR],
    // The role(s) have permission to promote a peer from the lobby
    [PROMOTE_PEER]: [userRoles.NORMAL],
    // The role(s) have permission to send chat messages
    [SEND_CHAT]: [userRoles.NORMAL],
    // The role(s) have permission to moderate chat
    [MODERATE_CHAT]: [userRoles.MODERATOR],
    // The role(s) have permission to share screen
    [SHARE_SCREEN]: [userRoles.NORMAL],
    // The role(s) have permission to produce extra video
    [EXTRA_VIDEO]: [userRoles.NORMAL],
    // The role(s) have permission to share files
    [SHARE_FILE]: [userRoles.NORMAL],
    // The role(s) have permission to moderate files
    [MODERATE_FILES]: [userRoles.MODERATOR],
    // The role(s) have permission to moderate room (e.g. kick user)
    [MODERATE_ROOM]: [userRoles.MODERATOR],
  },
  // Array of permissions. If no peer with the permission in question
  // is in the room, all peers are permitted to do the action. The peers
  // that are allowed because of this rule will not be able to do this
  // action as soon as a peer with the permission joins. In this example
  // everyone will be able to lock/unlock room until a MODERATOR joins.
  allowWhenRoleMissing: [],
  // When truthy, the room will be open to all users when as long as there
  // are allready users in the room
  activateOnHostJoin: true,
  // When set, maxUsersPerRoom defines how many users can join
  // a single room. If not set, there is no limit.
  // maxUsersPerRoom    : 20,
  // Room size before spreading to new router
  routerScaleSize: 40,
  // Socket timout value
  requestTimeout: 20000,
  // Socket retries when timeout
  requestRetries: 3,
  // Mediasoup settings
  mediasoup: {
    numWorkers: Object.keys(os.cpus()).length,
    // mediasoup Worker settings.
    worker: {
      logLevel: "warn",
      logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    },
    // mediasoup Router settings.
    router: {
      // Router media codecs.
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: "video",
          mimeType: "video/h264",
          clockRate: 90000,
          parameters: {
            "packetization-mode": 1,
            "profile-level-id": "4d0032",
            "level-asymmetry-allowed": 1,
            "x-google-start-bitrate": 1000,
          },
        },
        {
          kind: "video",
          mimeType: "video/VP8",
          clockRate: 90000,
          parameters: {
            "x-google-start-bitrate": 1000,
          },
        },
        {
          kind: "video",
          mimeType: "video/VP9",
          clockRate: 90000,
          parameters: {
            "profile-id": 2,
            "x-google-start-bitrate": 1000,
          },
        },

        {
          kind: "video",
          mimeType: "video/h264",
          clockRate: 90000,
          parameters: {
            "packetization-mode": 1,
            "profile-level-id": "42e01f",
            "level-asymmetry-allowed": 1,
            "x-google-start-bitrate": 1000,
          },
        },
      ],
    },
    // mediasoup WebRtcTransport settings.
    webRtcTransport: {
      listenIps: [{ ip: "127.0.0.1", announcedIp: null }],
      initialAvailableOutgoingBitrate: 1000000,
      minimumAvailableOutgoingBitrate: 600000,
      // Additional options that are not part of WebRtcTransportOptions.
      maxIncomingBitrate: 1500000,
    },
  },
};
