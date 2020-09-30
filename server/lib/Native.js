const axios = require("axios");
const https = require("https");

class Native {
  constructor() {
    this.api = axios.create({
      baseURL: "https://localhost/api",
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });
  }

  async auth(username, password, done) {
    try {
      const { data } = await this.api.post("/token", { username, password });
      const { user } = data;

      const picture = `https://localhost/assets/img/avatars/${user.avatar}`;
      const { id, name: displayName, email } = user;
      const rooms = user.Rooms.map((room) => room.roomId);

      return done(null, { id, displayName, email, picture, rooms });
    } catch (error) {
      return done(null, false);
    }
  }
}

module.exports = new Native();
