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

const {
  findExactPlayerMatch,
  canonicalPlayerNameForMatch,
  normalizeName,
} = require("../utils/nameMatcher");

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
  const dbCanon = canonicalPlayerNameForMatch(dbName);
  if (!dbCanon) return null;

  for (const k of battingKeys) {
    if (canonicalPlayerNameForMatch(k) === dbCanon) return k;
  }
  return null;
}

function prepareBattingLine(line) {
  return String(line || "")
    .replace(/†/g, "")
    .replace(/\(\s*(?:RHB|LHB|wk|c)\s*\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True only for a real not-out innings, not a bowler named "Asif Not Out". */
function isDismissalNotOut(dismissal) {
  let d = String(dismissal || "").trim();
  if (!d) return false;
  // "c X b Asif Not Out" — not out is part of the bowler's name
  if (/\bb\s+[\w\s]*not\s+out\s*$/i.test(d)) return false;
  return /^not\s+out\b/i.test(d);
}

// Cricheroes rows: … dismissal R B M 4s 6s SR — R/B are the first two ints after dismissal
const BATTING_LINE_REGEX =
  /^(?:\d+\s+)?([A-Za-z][A-Za-z0-9\s.'\-]{1,90}?)\s+((?:not\s+out|c&b|c|lbw|run\s+out|st|retired|b)\b(?:\s+[^\d]+)*?)\s+(\d+)\s+(\d+)(?:\s+\d)/i;
const BATTING_LINE_SIMPLE_REGEX =
  /^(?:\d+\s+)?([A-Za-z][A-Za-z0-9\s.'\-]{1,90}?)\s+(\d+)\s+(\d+)\b/;

/** Map each bowling PDF row to one DB player (exact name match only). */
function buildWicketsByDbName(bowlingRaw, dbPlayerNames) {
  const wicketsByDbName = new Map();

  for (const [bowlingPdfName, val] of bowlingRaw.entries()) {
    const match = findExactPlayerMatch(bowlingPdfName, dbPlayerNames);
    if (!match.matched || !match.matchedName) continue;

    const w = Number(val.wickets) || 0;
    const existing = wicketsByDbName.get(match.matchedName) || 0;
    wicketsByDbName.set(match.matchedName, Math.max(existing, w));
  }

  return wicketsByDbName;
}

function blocksAreSame(a, b) {
  return a.start === b.start && a.end === b.end;
}

function lineLooksLikeBattingDismissal(line, battingRegex) {
  return battingRegex.test(line);
}

/**
 * Prefer opponent-innings / post-"Bowling" lines so batting rows are not parsed as bowling.
 */
function selectBowlingLines(battingBlock, bowlingBlock) {
  if (!blocksAreSame(battingBlock, bowlingBlock)) {
    return bowlingBlock.lines;
  }

  const afterHeader = [];
  let inBowling = false;
  for (const line of battingBlock.lines) {
    if (/^bowling\b/i.test(line)) {
      inBowling = true;
      continue;
    }
    if (inBowling) afterHeader.push(line);
  }
  if (afterHeader.length > 0) return afterHeader;

  return battingBlock.lines;
}

function shouldSkipBowlingLine(line, name, batting, bowlingMatch, battingRegex) {
  if (lineLooksLikeBattingDismissal(line, battingRegex)) return true;

  const existing = batting.get(name);
  if (!existing) return false;

  // Lines that match both batting (runs/balls) and bowling (O M R W) are usually
  // batting rows — do not credit wickets unless this player did not bat.
  const wickets = parseInt(bowlingMatch[5], 10);
  if (wickets > 0 && (existing.runsScored > 0 || existing.balls > 0)) {
    const mSimple = line.match(
      /^(?:\d+\s+)?([A-Za-z][A-Za-z\s.'\-()†]{1,90}?)\s+(\d+)\s+(\d+)\b/
    );
    if (mSimple && cleanScorecardName(mSimple[1]) === name) {
      const runs = parseInt(mSimple[2], 10);
      const balls = parseInt(mSimple[3], 10);
      if (runs !== existing.runsScored || balls !== existing.balls) {
        return false;
      }
      return true;
    }
  }

  return false;
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

  for (const rawLine of lines || []) {
    const line = prepareBattingLine(rawLine);
    if (/^(extras|total|fall of wickets|no batsman)/i.test(line)) continue;

    let m = line.match(BATTING_LINE_REGEX);
    if (m) {
      const cleaned = cleanScorecardName(m[1]);
      if (cleaned) names.add(cleaned);
      continue;
    }
    m = line.match(BATTING_LINE_SIMPLE_REGEX);
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
    const m = findExactPlayerMatch(n, db);
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

    if (blocksAreSame(bowlingBlock, battingBlock)) {
      let bestAlt = null;
      for (const b of blocks) {
        if (blocksAreSame(b, battingBlock)) continue;
        const score = countDbMatches(
          extractBowlingNamesFromLines(b.lines),
          dbPlayerNames
        );
        if (!bestAlt || score > bestAlt.score) bestAlt = { block: b, score };
      }
      if (bestAlt && bestAlt.score > 0) bowlingBlock = bestAlt.block;
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
    const m = findExactPlayerMatch(n, dbPlayerNames);
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
const SCORECARD_PARSER_VERSION = 6;

async function parseScorecard(pdfBuffer, dbPlayerNames = [], options = {}) {
  const text = await extractTextFromPdf(pdfBuffer);
  const allLines = textToLines(text);
  const { battingBlock, bowlingBlock } = pickMyTeamBlocks(allLines, dbPlayerNames);
  const teamLines = battingBlock.lines;

  const batting = new Map(); // name -> { runsScored, balls, isNotOut, didNotBat }
  const bowlingRaw = new Map(); // name -> { wickets } from selected bowling innings only
  const didNotBat = new Set();

  // Detect DNB
  for (const p of extractNonBattingNamesFromLines(teamLines)) didNotBat.add(p);

  const battingRegex = BATTING_LINE_REGEX;
  const battingRegexSimple = BATTING_LINE_SIMPLE_REGEX;

  for (const rawLine of teamLines) {
    const line = prepareBattingLine(rawLine);
    // skip obvious non-player rows
    if (/^(extras|total|fall of wickets|no batsman)/i.test(line)) continue;

    let m = line.match(battingRegex);
    if (m) {
      const name = cleanScorecardName(m[1]);
      const dismissal = String(m[2] || "").trim();
      const runsScored = parseInt(m[3], 10);
      const balls = parseInt(m[4], 10);
      const isNotOut = isDismissalNotOut(dismissal);
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
    /^(?:\d+\s+)?([A-Za-z][A-Za-z\s.'\-()†]{1,90})\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)\b/;
  const linesToParseForBowling = selectBowlingLines(battingBlock, bowlingBlock);

  for (const rawLine of linesToParseForBowling) {
    const line = prepareBattingLine(rawLine);
    if (/^(extras|total|fall of wickets|no bowler)/i.test(line)) continue;
    const m = line.match(bowlingRegex);
    if (!m) continue;
    const name = cleanScorecardName(m[1]);
    if (shouldSkipBowlingLine(line, name, batting, m, battingRegex)) continue;
    const wickets = parseInt(m[5], 10);
    bowlingRaw.set(name, { wickets: Number.isFinite(wickets) ? wickets : 0 });
  }

  const wicketsByDbName = buildWicketsByDbName(bowlingRaw, dbPlayerNames);

  // Combine: only MY TEAM players (matched to DB) from batting block
  const rosterMatchedNames = new Set();
  for (const name of batting.keys()) {
    const m = findExactPlayerMatch(name, dbPlayerNames);
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
    const wickets = wicketsByDbName.get(matchedName) || 0;

    players.push({
      playerName: matchedName,
      runsScored: b ? b.runsScored : 0,
      balls: b ? b.balls : 0,
      wickets,
      isNotOut: b ? b.isNotOut : true, // if no batting info, treat as "did not bat" => not out
      didNotBat: b ? b.didNotBat : true,
    });
  }

  const out = { text, lines: allLines, players, parserVersion: SCORECARD_PARSER_VERSION };
  if (options.debug) {
    out._debug = {
      parserVersion: SCORECARD_PARSER_VERSION,
      sameBattingBowlingBlock: blocksAreSame(battingBlock, bowlingBlock),
      bowlingLinesParsed: linesToParseForBowling.length,
      bowlingRaw: Object.fromEntries(
        Array.from(bowlingRaw.entries()).map(([k, v]) => [k, v.wickets])
      ),
      wicketsByDbName: Object.fromEntries(wicketsByDbName.entries()),
    };
  }
  return out;
}

module.exports = {
  SCORECARD_PARSER_VERSION,
  extractPlayerNamesFromPdf,
  parseScorecard,
  extractTextFromPdf,
  textToLines,
};
