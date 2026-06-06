const mongoose = require("mongoose");

const groupEntrySchema = new mongoose.Schema(
  {
    groupNumber: { type: Number, required: true, min: 1, max: 6 },
    playerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
    playerNames: [String],
  },
  { _id: false }
);

const mateGroupSchema = new mongoose.Schema(
  {
    groups: [groupEntrySchema],
  },
  { timestamps: true }
);

const MateGroup = mongoose.model("MateGroup", mateGroupSchema);

module.exports = MateGroup;
