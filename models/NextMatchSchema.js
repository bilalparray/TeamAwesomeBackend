// models/NextMatchSchema.js
const mongoose = require("mongoose");

const NextMatchSchema = new mongoose.Schema({
  opponent: { type: String, required: true },
  isSeries: { type: Boolean, required: true },
  date: { type: Date, required: true },

  // Series fields (only if isSeries = true)
  seriesName: { type: String },
  totalMatches: { type: Number },
  matchNumber: { type: Number },
  seriesLeader: { type: String },
  seriesScore: {
    ourTeam: { type: Number, default: 0 },
    opponent: { type: Number, default: 0 }
  },

  // Extra details
  venue: { type: String },
  overs: { type: Number },
  isHomeMatch: { type: Boolean, default: false },
  status: { type: String, enum: ["upcoming", "completed"], default: "upcoming" }
},{ timestamps: true });

module.exports = mongoose.model("NextMatch", NextMatchSchema);
