const mongoose = require("mongoose");

const mateTurnPlayerSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ["regular", "solo", "helper"],
      required: true,
    },
    fromGroupNumber: { type: Number, min: 1, max: 5 },
  },
  { _id: false }
);

const mateTurnSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    groupNumber: { type: Number, required: true, min: 1, max: 6 },
    players: {
      type: [mateTurnPlayerSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2,
        message: "Exactly 2 players are required",
      },
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

mateTurnSchema.index({ date: 1 }, { unique: true });

const MateTurn = mongoose.model("MateTurn", mateTurnSchema);

module.exports = MateTurn;
