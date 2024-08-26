const mongoose = require("mongoose");

const battingOrderSchema = new mongoose.Schema({
  order: [String], // Array of player names in batting order
});

const BattingOrder = mongoose.model("BattingOrder", battingOrderSchema);
module.exports = BattingOrder;
