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
    runs: [String],
    balls: [String],
    wickets: [String],
    lastfour: [String],
    innings: [String],
    career: {
      balls: [String],
      runs: [String],
      wickets: [String],
      innings: [String],
      ranking: String,
    },
  },
});
const Player = mongoose.model("Player", playerSchema);

module.exports = Player;
