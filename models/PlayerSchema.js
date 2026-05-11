const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  name: String,
  role: String,
  born: Date,
  birthplace: String,
  battingstyle: String,
  bowlingstyle: String,
  debut: Date,
  image: String,
  scores: {
    runs: [Number],
    balls: [Number],
    wickets: [Number],
    lastfour: [Number],
    career: {
      balls: [Number],
      runs: [Number],
      wickets: [Number],
      ranking: String,
    },
  },
});
const Player = mongoose.model("Player", playerSchema);

module.exports = Player;
