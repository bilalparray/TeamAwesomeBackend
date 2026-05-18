const Player = require("../models/PlayerSchema");
const {
  extractPlayerNamesFromPdf,
  parseScorecard,
  SCORECARD_PARSER_VERSION,
} = require("../services/scorecard.service");
const { calculateAdjustedRuns } = require("../utils/scoreCalculator");
const { findExactPlayerMatch, normalizeName } = require("../utils/nameMatcher");

function parseLatePlayersField(latePlayersRaw) {
  if (latePlayersRaw == null || latePlayersRaw === "") return [];
  if (Array.isArray(latePlayersRaw)) return latePlayersRaw;
  if (typeof latePlayersRaw !== "string") {
    throw new Error("latePlayers must be a JSON array string");
  }
  const parsed = JSON.parse(latePlayersRaw);
  if (!Array.isArray(parsed)) throw new Error("latePlayers must be a JSON array");
  return parsed;
}

async function extractPlayers(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "pdf file is required" });
    }
    const dbPlayers = await Player.find({}, { name: 1 }).lean();
    const dbPlayerNames = dbPlayers.map((p) => p.name).filter(Boolean);

    const names = await extractPlayerNamesFromPdf(req.file.buffer, dbPlayerNames);

    // Also include players present in DB but not present in PDF extraction.
    const merged = [];
    const seen = new Set();
    for (const n of [...names, ...dbPlayerNames]) {
      const key = String(n || "").toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(n);
    }

    return res.status(200).json(merged.sort((a, b) => a.localeCompare(b)));
  } catch (err) {
    console.error("Error in extractPlayers:", err);
    return res.status(500).json({ message: "Failed to extract players" });
  }
}

async function processScorecard(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "pdf file is required" });
    }

    let latePlayers = [];
    try {
      latePlayers = parseLatePlayersField(req.body && req.body.latePlayers);
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    const lateSet = new Set(latePlayers.map((x) => String(x || "").trim()).filter(Boolean));

    // Pull DB players for matching
    const dbPlayers = await Player.find({}, { name: 1 }).lean();
    const dbPlayerNames = dbPlayers.map((p) => p.name).filter(Boolean);

    const debug = req.query && req.query.debug === "1";
    const { players: parsedPlayers } = await parseScorecard(
      req.file.buffer,
      dbPlayerNames,
      { debug }
    );

    const result = parsedPlayers.map((p) => {
      const isLate = lateSet.has(p.playerName);
      const adjustedRuns = calculateAdjustedRuns(
        Number(p.runsScored) || 0,
        p.isNotOut === true,
        isLate === true
      );

      return {
        playerName: p.playerName,
        runsScored: Number(p.runsScored) || 0,
        balls: Number(p.balls) || 0,
        wickets: Number(p.wickets) || 0,
        isNotOut: p.isNotOut === true,
        isLate: isLate === true,
        adjustedRuns,
      };
    });

    // Include DB players that are missing from parsed PDF output with zero stats.
    // This keeps the response complete for downstream UI/logic.
    const existing = new Set(result.map((r) => r.playerName.toLowerCase().trim()));
    for (const dbName of dbPlayerNames) {
      const key = String(dbName || "").toLowerCase().trim();
      if (!key || existing.has(key)) continue;

      const isLate = lateSet.has(dbName);
      result.push({
        playerName: dbName,
        runsScored: 0,
        balls: 0,
        wickets: 0,
        isNotOut: false,
        isLate: isLate === true,
        adjustedRuns: calculateAdjustedRuns(0, false, isLate === true),
      });
    }

    // keep stable ordering: highest adjustedRuns then name (easy to change)
    result.sort((a, b) => b.adjustedRuns - a.adjustedRuns || a.playerName.localeCompare(b.playerName));

    res.setHeader("X-Scorecard-Parser-Version", String(SCORECARD_PARSER_VERSION));
    return res.status(200).json(result);
  } catch (err) {
    console.error("Error in processScorecard:", err);
    return res.status(500).json({ message: "Failed to process scorecard" });
  }
}

async function applyScorecardToDb(req, res) {
  try {
    const payloadPlayers = req.body && req.body.players;
    if (!Array.isArray(payloadPlayers) || payloadPlayers.length === 0) {
      return res.status(400).json({
        message: "players array is required",
      });
    }

    const dbPlayers = await Player.find({}, { name: 1, scores: 1 });
    const dbPlayerNames = dbPlayers.map((p) => p.name).filter(Boolean);

    const updated = [];
    const skipped = [];

    for (const item of payloadPlayers) {
      const playerName = String((item && item.playerName) || "").trim();
      if (!playerName) {
        skipped.push({
          playerName: "",
          reason: "missing playerName",
        });
        continue;
      }

      const match = findExactPlayerMatch(playerName, dbPlayerNames);
      if (!match.matched || !match.matchedName) {
        skipped.push({
          playerName,
          reason: "player not found in database",
        });
        continue;
      }

      const dbPlayer = dbPlayers.find(
        (p) => normalizeName(p.name) === normalizeName(match.matchedName)
      );
      if (!dbPlayer) {
        skipped.push({
          playerName,
          reason: "player not found in loaded database set",
        });
        continue;
      }

      // Similar to existing score update API: append current match values.
      // adjustedRuns is mandatory for DB score persistence.
      const adjustedRuns = Number(item.adjustedRuns);
      if (!Number.isFinite(adjustedRuns)) {
        return res.status(400).json({
          message: "adjustedRuns is required and must be a number for all players",
          playerName,
        });
      }
      const runs = adjustedRuns;
      const ballsProvided = item.balls != null && item.balls !== "";
      const wicketsProvided = item.wickets != null && item.wickets !== "";
      const balls = ballsProvided ? Number(item.balls) : 0;
      const wickets = wicketsProvided ? Number(item.wickets) : 0;
      if (ballsProvided && !Number.isFinite(balls)) {
        return res.status(400).json({
          message: "balls must be a valid number for all players when provided",
          playerName,
        });
      }
      if (wicketsProvided && !Number.isFinite(wickets)) {
        return res.status(400).json({
          message: "wickets must be a valid number for all players when provided",
          playerName,
        });
      }
      const normalizedBalls = Number.isFinite(balls) ? balls : 0;
      const normalizedWickets = Number.isFinite(wickets) ? wickets : 0;

      dbPlayer.scores.runs.push(runs);
      dbPlayer.scores.balls.push(normalizedBalls);
      dbPlayer.scores.wickets.push(normalizedWickets);

      dbPlayer.scores.career.runs.push(runs);
      dbPlayer.scores.career.balls.push(normalizedBalls);
      dbPlayer.scores.career.wickets.push(normalizedWickets);

      // Maintain latest 4 innings scores in lastfour
      dbPlayer.scores.lastfour.push(runs);
      dbPlayer.scores.lastfour = dbPlayer.scores.lastfour.slice(-4);

      await dbPlayer.save();

      updated.push({
        inputName: playerName,
        dbName: dbPlayer.name,
        runsScored: runs,
        balls: normalizedBalls,
        wickets: normalizedWickets,
      });
    }

    return res.status(200).json({
      message: "Bulk score update completed",
      updatedCount: updated.length,
      skippedCount: skipped.length,
      updated,
      skipped,
    });
  } catch (err) {
    console.error("Error in applyScorecardToDb:", err);
    return res.status(500).json({ message: "Failed to apply scorecard to DB" });
  }
}

module.exports = {
  extractPlayers,
  processScorecard,
  applyScorecardToDb,
};
