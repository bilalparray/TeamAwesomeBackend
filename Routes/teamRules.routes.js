const express = require("express");
const TeamRules = require("../models/TeamRulesSchema");

const router = express.Router();

function normalizeRules(raw) {
  if (!Array.isArray(raw)) return null;
  const rules = raw
    .map((r) => String(r ?? "").trim())
    .filter(Boolean);
  return rules;
}

// GET /api/team-rules — public read for app users
router.get("/team-rules", async (req, res) => {
  try {
    let doc = await TeamRules.findOne().lean();
    if (!doc) {
      doc = { rules: [] };
    }
    return res.status(200).json({
      rules: Array.isArray(doc.rules) ? doc.rules : [],
      updatedAt: doc.updatedAt || null,
    });
  } catch (err) {
    console.error("Error fetching team rules:", err);
    return res.status(500).json({ message: "Failed to fetch team rules" });
  }
});

// PUT /api/team-rules — replace full rules list (admin app)
// Body: { "rules": ["Rule one", "Rule two"] }
router.put("/team-rules", async (req, res) => {
  try {
    const rules = normalizeRules(req.body && req.body.rules);
    if (rules === null) {
      return res.status(400).json({
        message: "rules must be an array of strings",
      });
    }

    let doc = await TeamRules.findOne();
    if (!doc) {
      doc = new TeamRules({ rules });
    } else {
      doc.rules = rules;
    }
    await doc.save();

    return res.status(200).json({
      message: "Team rules updated",
      rules: doc.rules,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    console.error("Error updating team rules:", err);
    return res.status(500).json({ message: "Failed to update team rules" });
  }
});

module.exports = router;
