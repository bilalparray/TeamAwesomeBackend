/**
 * Append default team rules to MongoDB (merges with existing, skips duplicates).
 * Run: node scripts/seedTeamRules.js
 */

const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", "process.env") });

const TeamRules = require("../models/TeamRulesSchema");

const RULES_TO_APPEND = [
  "Be at the ground at least 30 minutes before match time.",
  "Inform the captain if you cannot play before match day.",
  "Full team kit is required (whites, pads, bat, gloves).",
  "No smoking or chewing tobacco on the ground.",
  "Respect umpires, opponents, and teammates at all times.",
  "Late arrival without notice may affect batting order and mate turn.",
  "Mobile phones on silent during play unless you are scoring.",
  "Help with ground setup and pack-up after the match.",
  "Disputes are settled by the captain on match day.",
  "Mate turn must be paid on the day it is your group's turn.",
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI missing in process.env");
    process.exit(1);
  }

  await mongoose.connect(uri);

  let doc = await TeamRules.findOne();
  if (!doc) {
    doc = new TeamRules({ rules: [] });
  }

  const existing = new Set(
    (doc.rules || []).map((r) => String(r).trim().toLowerCase())
  );
  let added = 0;

  for (const rule of RULES_TO_APPEND) {
    const key = rule.trim().toLowerCase();
    if (!key || existing.has(key)) continue;
    doc.rules.push(rule);
    existing.add(key);
    added++;
  }

  await doc.save();

  console.log(`Done. Added ${added} rule(s). Total: ${doc.rules.length}`);
  doc.rules.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
