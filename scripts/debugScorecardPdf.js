/**
 * Debug scorecard PDF parsing locally.
 * Usage: node scripts/debugScorecardPdf.js path/to/scorecard.pdf
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../process.env") });

const { parseScorecard, extractPdfContent, textToLines } = require("../services/scorecard.service");
const Player = require("../models/PlayerSchema");

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: node scripts/debugScorecardPdf.js <scorecard.pdf>");
    process.exit(1);
  }

  const buffer = fs.readFileSync(pdfPath);
  console.log("PDF bytes:", buffer.length);

  const { text, tableRows } = await extractPdfContent(buffer);
  const lines = textToLines(text);
  console.log("Text lines:", lines.length, "| Table rows:", tableRows.length);
  console.log("--- First 40 text lines ---");
  lines.slice(0, 40).forEach((l, i) => console.log(`${i + 1}: ${l}`));

  if (tableRows.length) {
    console.log("--- First 15 table rows ---");
    tableRows.slice(0, 15).forEach((row, i) => console.log(`${i + 1}:`, row));
  }

  let dbPlayerNames = [];
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mongoUri) {
    await mongoose.connect(mongoUri);
    const dbPlayers = await Player.find({}, { name: 1 }).lean();
    dbPlayerNames = dbPlayers.map((p) => p.name).filter(Boolean);
    console.log("DB players:", dbPlayerNames.length);
  } else {
    console.warn("No MONGODB_URI — parsing without DB name filter");
  }

  const { players, _debug } = await parseScorecard(buffer, dbPlayerNames, {
    debug: true,
  });

  console.log("--- Parsed players ---");
  for (const p of players) {
    console.log(
      `${p.playerName}: R=${p.runsScored} B=${p.balls} W=${p.wickets} NOTOUT=${p.isNotOut}`
    );
  }

  if (_debug) {
    console.log("--- Debug ---");
    console.log(JSON.stringify(_debug, null, 2));
  }

  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
