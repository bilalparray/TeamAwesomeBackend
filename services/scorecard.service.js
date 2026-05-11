const pdfParseImport = require("pdf-parse");

async function extractTextUsingV2(pdfBuffer) {
  // pdf-parse@2.x exports a PDFParse class (not a callable function)
  const PDFParse = pdfParseImport && pdfParseImport.PDFParse;
  if (typeof PDFParse !== "function") {
    throw new TypeError("pdf-parse PDFParse class not found");
  }

  // pdf-parse@2.x expects an options object in some builds (otherwise it may
  // crash reading e.g. options.verbosity).
  const parser = new PDFParse({ data: pdfBuffer, verbosity: 0 });
  try {
    await parser.load();
    const textResult = await parser.getText();
    // getText() typically returns { text, pages, ... }
    if (typeof textResult === "string") return textResult;
    return textResult && textResult.text ? String(textResult.text) : "";
  } finally {
    try {
      parser.destroy();
    } catch {
      // ignore
    }
  }
}

async function extractTextUsingV1(pdfBuffer) {
  // pdf-parse@1.x style: callable function
  const fn =
    typeof pdfParseImport === "function"
      ? pdfParseImport
      : pdfParseImport && typeof pdfParseImport.default === "function"
      ? pdfParseImport.default
      : null;
  if (!fn) throw new TypeError("pdf-parse export is not a function");
  const data = await fn(pdfBuffer);
  return data && data.text ? String(data.text) : "";
}

/**
 * Extract raw text from PDF buffer.
 */
async function extractTextFromPdf(pdfBuffer) {
  // Prefer v2 API when present; fallback to v1-style callable API.
  if (pdfParseImport && typeof pdfParseImport.PDFParse === "function") {
    return await extractTextUsingV2(pdfBuffer);
  }
  return await extractTextUsingV1(pdfBuffer);
}

/**
 * Split PDF text into cleaned lines (format-agnostic).
 */
function textToLines(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const { findBestPlayerMatch, normalizeName } = require("../utils/nameMatcher");

const TEAM_NAME = "Team Awesome Sozeith";

function normalizeForContains(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function cleanScorecardName(raw) {
  return String(raw || "")
    .replace(/†/g, "")
    .replace(/\([^)]*\)/g, "") // remove (wk), (c), (RHB), etc
    .replace(/\s+/g, " ")
    .trim();
}

function findBestBattingKeyForDbName(dbName, battingKeys) {
  const dbNorm = normalizeName(dbName);
  if (!dbNorm) return null;

  // 1) strict exact match first
  for (const k of battingKeys) {
    if (normalizeName(k) === dbNorm) return k;
  }

  // 2) then fallback to fuzzy
  const m = findBestPlayerMatch(dbName, battingKeys);
  return m && m.matched ? m.matchedName : null;
}

function splitIntoInningsBlocks(allLines) {
  const lines = allLines || [];
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (/\binnings\b/i.test(lines[i])) starts.push(i);
  }
  if (starts.length === 0) return [{ start: 0, end: lines.length, lines }];

  const blocks = [];
  for (let s = 0; s < starts.length; s++) {
    const start = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1] : lines.length;
    blocks.push({
      start,
      end,
      lines: lines.slice(start, end),
      header: lines[start] || "",
    });
  }
  return blocks;
}

function extractNonBattingNamesFromLines(lines) {
  const names = new Set();

  // Cricheroes formats vary: sometimes "Did not bat:", sometimes "To Bat:"
  const patterns = [
    /did\s+not\s+bat\s*:?\s*(.+)$/i,
    /to\s+bat\s*:?\s*(.+)$/i,
  ];

  for (const line of lines || []) {
    for (const re of patterns) {
      const m = line.match(re);
      if (m && m[1]) {
        const parts = m[1]
          .split(/,|;|\u2022|\|/)
          .map((p) => p.trim())
          .filter(Boolean);
        for (const p of parts) if (p.length >= 2) names.add(p);
      }
    }
  }

  return Array.from(names).map(cleanScorecardName).filter(Boolean);
}

function extractBattingNamesFromLines(lines) {
  const names = new Set();

  // Cricheroes style: "<no> <name/tags> <dismissal> <runs> <balls> ..."
  // Name must stop where dismissal starts.
  const battingLine =
    /^(?:\d+\s+)?([A-Za-z][A-Za-z\s.'\-()†]{1,90}?)\s+((?:not\s+out|c&b|c|b|lbw|run\s+out|st|retired)(?:\s+[A-Za-z†().'\-&]+)*)\s+(\d+)\s+(\d+)\b/i;
  const battingLineAlt =
    /^(?:\d+\s+)?([A-Za-z][A-Za-z\s.'\-()†]{1,90}?)\s+(\d+)\s+(\d+)\b/;

  for (const line of lines || []) {
    let m = line.match(battingLine);
    if (m) {
      const cleaned = cleanScorecardName(m[1]);
      if (cleaned) names.add(cleaned);
      continue;
    }
    m = line.match(battingLineAlt);
    if (m) {
      const n = cleanScorecardName(m[1]);
      if (!/^(extras|total|fall of wickets)/i.test(n)) names.add(n);
    }
  }

  for (const p of extractNonBattingNamesFromLines(lines)) names.add(p);

  return Array.from(names);
}

function extractBowlingNamesFromLines(lines) {
  const names = new Set();
  const bowlingLine = /^([A-Za-z][A-Za-z\s.'-]{1,60}?)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)\b/;
  for (const line of lines || []) {
    const m = line.match(bowlingLine);
    if (m) {
      const n = m[1].trim();
      if (!/^(extras|total|fall of wickets)/i.test(n)) names.add(n);
    }
  }
  return Array.from(names);
}

function countDbMatches(names, dbPlayerNames) {
  const db = (dbPlayerNames || []).map((x) => String(x || "")).filter(Boolean);
  const matched = new Set();
  for (const n of names || []) {
    const m = findBestPlayerMatch(n, db);
    if (m && m.matched && m.matchedName) matched.add(normalizeName(m.matchedName));
  }
  return matched.size;
}

function pickMyTeamBlocks(allLines, dbPlayerNames) {
  const blocks = splitIntoInningsBlocks(allLines);

  // Primary rule: if header contains our team name, always use that as batting innings.
  const tn = normalizeForContains(TEAM_NAME);
  const teamHeaderIdx = blocks.findIndex((b) =>
    normalizeForContains(b.header).includes(tn)
  );
  if (teamHeaderIdx !== -1) {
    const battingBlock = blocks[teamHeaderIdx];

    // "Corresponding bowling innings": usually the other innings (opponent batting),
    // which contains our bowlers. If 2 blocks exist, pick the other one. Otherwise,
    // prefer the next block, else previous.
    let bowlingBlock = battingBlock;
    if (blocks.length === 2) {
      bowlingBlock = blocks[teamHeaderIdx === 0 ? 1 : 0];
    } else if (teamHeaderIdx + 1 < blocks.length) {
      bowlingBlock = blocks[teamHeaderIdx + 1];
    } else if (teamHeaderIdx - 1 >= 0) {
      bowlingBlock = blocks[teamHeaderIdx - 1];
    }

    return { battingBlock, bowlingBlock };
  }

  let bestBatting = null;
  let bestBowling = null;

  for (const b of blocks) {
    const battingNames = extractBattingNamesFromLines(b.lines);
    const bowlingNames = extractBowlingNamesFromLines(b.lines);

    const battingMatchCount = countDbMatches(battingNames, dbPlayerNames);
    const bowlingMatchCount = countDbMatches(bowlingNames, dbPlayerNames);

    if (!bestBatting || battingMatchCount > bestBatting.matchCount) {
      bestBatting = { block: b, matchCount: battingMatchCount, battingNames };
    }
    if (!bestBowling || bowlingMatchCount > bestBowling.matchCount) {
      bestBowling = { block: b, matchCount: bowlingMatchCount, bowlingNames };
    }
  }

  return {
    battingBlock: bestBatting ? bestBatting.block : blocks[0],
    bowlingBlock: bestBowling ? bestBowling.block : blocks[0],
  };
}

/**
 * Heuristic: extract possible player names from scorecard text.
 * Designed to be easy to tweak as formats vary.
 */
async function extractPlayerNamesFromPdf(pdfBuffer, dbPlayerNames = []) {
  const text = await extractTextFromPdf(pdfBuffer);
  const allLines = textToLines(text);
  const { battingBlock } = pickMyTeamBlocks(allLines, dbPlayerNames);
  const extracted = extractBattingNamesFromLines(battingBlock.lines);

  // Return only players that match DB (opposition ignored)
  const out = [];
  const seen = new Set();
  for (const n of extracted) {
    const m = findBestPlayerMatch(n, dbPlayerNames);
    if (m && m.matched && m.matchedName) {
      const key = normalizeName(m.matchedName);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(m.matchedName);
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Parse batting + bowling into per-player stats.
 * Output is "raw stats" (no late/notout adjustments or DB matching yet).
 */
async function parseScorecard(pdfBuffer, dbPlayerNames = []) {
  const text = await extractTextFromPdf(pdfBuffer);
  const allLines = textToLines(text);
  const { battingBlock, bowlingBlock } = pickMyTeamBlocks(allLines, dbPlayerNames);
  const teamLines = battingBlock.lines;

  const batting = new Map(); // name -> { runsScored, balls, isNotOut, didNotBat }
  const bowlingRaw = new Map(); // name -> { wickets } from selected bowling innings only
  const didNotBat = new Set();

  // Detect DNB
  for (const p of extractNonBattingNamesFromLines(teamLines)) didNotBat.add(p);

  // Batting parsing
  // Primary: "<no?> <name> <dismissal> <runs> <balls> ..."
  // Fallback: "<no?> <name> <runs> <balls>" (assume out unless "not out" present)
  const battingRegex =
    /^(?:\d+\s+)?([A-Za-z][A-Za-z\s.'\-()†]{1,90}?)\s+((?:not\s+out|c&b|c|b|lbw|run\s+out|st|retired)(?:\s+[A-Za-z†().'\-&]+)*)\s+(\d+)\s+(\d+)\b/i;
  const battingRegexSimple =
    /^(?:\d+\s+)?([A-Za-z][A-Za-z\s.'\-()†]{1,90}?)\s+(\d+)\s+(\d+)\b/;

  for (const line of teamLines) {
    // skip obvious non-player rows
    if (/^(extras|total|fall of wickets)/i.test(line)) continue;

    let m = line.match(battingRegex);
    if (m) {
      const name = cleanScorecardName(m[1]);
      const dismissal = String(m[2] || "").trim();
      const runsScored = parseInt(m[3], 10);
      const balls = parseInt(m[4], 10);
      const isNotOut = /not\s+out/i.test(dismissal);
      batting.set(name, {
        playerName: name,
        runsScored: Number.isFinite(runsScored) ? runsScored : 0,
        balls: Number.isFinite(balls) ? balls : 0,
        isNotOut: isNotOut,
        didNotBat: false,
      });
      continue;
    }

    m = line.match(battingRegexSimple);
    if (m) {
      const name = cleanScorecardName(m[1]);
      if (/^(extras|total|fall of wickets)/i.test(name)) continue;
      const runsScored = parseInt(m[2], 10);
      const balls = parseInt(m[3], 10);
      batting.set(name, {
        playerName: name,
        runsScored: Number.isFinite(runsScored) ? runsScored : 0,
        balls: Number.isFinite(balls) ? balls : 0,
        isNotOut: false,
        didNotBat: false,
      });
    }
  }

  // apply DNB as "isNotOut: true" per requirement
  for (const name of didNotBat) {
    // if already parsed as batting row, keep that
    if (!batting.has(name)) {
      batting.set(name, {
        playerName: name,
        runsScored: 0,
        balls: 0,
        isNotOut: true,
        didNotBat: true,
      });
    }
  }

  // Bowling parsing
  // Common format: "<name> O M R W"
  const bowlingRegex =
    /^(?:\d+\s+)?([A-Za-z][A-Za-z\s.'\-()†]{1,90}?)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)\b/;
  for (const line of bowlingBlock.lines) {
    if (/^(extras|total|fall of wickets)/i.test(line)) continue;
    const m = line.match(bowlingRegex);
    if (!m) continue;
    const name = cleanScorecardName(m[1]);
    const wickets = parseInt(m[5], 10);
    bowlingRaw.set(name, { wickets: Number.isFinite(wickets) ? wickets : 0 });
  }

  // Combine: only MY TEAM players (matched to DB) from batting block
  const rosterMatchedNames = new Set();
  for (const name of batting.keys()) {
    const m = findBestPlayerMatch(name, dbPlayerNames);
    if (m && m.matched && m.matchedName) rosterMatchedNames.add(m.matchedName);
  }
  const players = [];
  for (const matchedName of rosterMatchedNames) {
    // Map DB name to batting row: exact normalized match first, fuzzy second.
    const battingKey = findBestBattingKeyForDbName(
      matchedName,
      Array.from(batting.keys())
    );
    const b = battingKey ? batting.get(battingKey) : null;

    // find wickets by best-effort match against bowlingRaw keys
    let wickets = 0;
    if (bowlingRaw.has(matchedName)) {
      wickets = bowlingRaw.get(matchedName).wickets || 0;
    } else {
      // fuzzy match for minor spelling differences between sections
      const candidateKeys = Array.from(bowlingRaw.keys());
      const match = findBestPlayerMatch(matchedName, candidateKeys);
      if (match.matched && match.matchedName && bowlingRaw.has(match.matchedName)) {
        wickets = bowlingRaw.get(match.matchedName).wickets || 0;
      }
    }

    players.push({
      playerName: matchedName,
      runsScored: b ? b.runsScored : 0,
      balls: b ? b.balls : 0,
      wickets,
      isNotOut: b ? b.isNotOut : true, // if no batting info, treat as "did not bat" => not out
      didNotBat: b ? b.didNotBat : true,
    });
  }

  return { text, lines: allLines, players };
}

module.exports = {
  extractPlayerNamesFromPdf,
  parseScorecard,
  extractTextFromPdf,
  textToLines,
};
