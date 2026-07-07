const mongoose = require("mongoose");

const teamRulesSchema = new mongoose.Schema(
  {
    rules: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const TeamRules = mongoose.model("TeamRules", teamRulesSchema);
module.exports = TeamRules;
