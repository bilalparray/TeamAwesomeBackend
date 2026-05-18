function normalizeName(name) {
  if (typeof name !== "string") return "";
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "") // keep letters/numbers/spaces; drop punctuation
    .trim();
}

function getNameTokens(name) {
  const norm = normalizeName(name);
  if (!norm) return { first: "", rest: "" };
  const parts = norm.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0], rest: "" };
  return { first: parts[0], rest: parts.slice(1).join(" ") };
}

// Levenshtein distance (iterative DP, O(min(n,m)) space)
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const s = a.length <= b.length ? a : b;
  const t = a.length <= b.length ? b : a;

  const prev = new Array(s.length + 1);
  const cur = new Array(s.length + 1);

  for (let i = 0; i <= s.length; i++) prev[i] = i;

  for (let j = 1; j <= t.length; j++) {
    cur[0] = j;
    const tj = t.charCodeAt(j - 1);
    for (let i = 1; i <= s.length; i++) {
      const cost = s.charCodeAt(i - 1) === tj ? 0 : 1;
      cur[i] = Math.min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + cost);
    }
    for (let i = 0; i <= s.length; i++) prev[i] = cur[i];
  }

  return prev[s.length];
}

/**
 * Exact full-name match only (normalized). Use for scorecard PDF → DB linking.
 */
function findExactPlayerMatch(inputName, dbPlayers) {
  const needle = normalizeName(inputName);
  if (!needle) return { matched: false };

  for (const p of dbPlayers || []) {
    const candidateName = typeof p === "string" ? p : p && p.name;
    if (!candidateName) continue;
    if (normalizeName(candidateName) === needle) {
      return { matched: true, matchedName: candidateName, distance: 0 };
    }
  }
  return { matched: false };
}

/**
 * Find best fuzzy match in dbPlayers (array of { name } or strings).
 * Returns { matched: boolean, matchedName?: string, distance?: number }
 */
function findBestPlayerMatch(inputName, dbPlayers) {
  const needle = normalizeName(inputName);
  if (!needle) return { matched: false };

  let best = null;
  for (const p of dbPlayers || []) {
    const candidateName = typeof p === "string" ? p : p && p.name;
    const normalized = normalizeName(candidateName);
    if (!normalized) continue;

    // exact match wins immediately
    if (normalized === needle) {
      return { matched: true, matchedName: candidateName, distance: 0 };
    }

    const dist = levenshtein(needle, normalized);
    if (!best || dist < best.distance) {
      best = { matchedName: candidateName, distance: dist };
    }
  }

  if (!best) return { matched: false };

  // adaptive threshold: allow small typos, tighter for short names
  const len = Math.max(needle.length, normalizeName(best.matchedName).length);
  const maxDistance = len <= 8 ? 1 : len <= 14 ? 2 : Math.floor(len * 0.2);
  if (best.distance <= maxDistance) {
    return { matched: true, matchedName: best.matchedName, distance: best.distance };
  }
  return { matched: false, matchedName: best.matchedName, distance: best.distance };
}

/**
 * Stricter variant for bowling rows: full-name fuzzy match only when the
 * first/given name is also a close match (avoids Sahil vs Suhail collisions).
 */
function findBestPlayerMatchStrict(inputName, dbPlayers) {
  const result = findBestPlayerMatch(inputName, dbPlayers);
  if (!result.matched || !result.matchedName) return result;

  const inputTokens = getNameTokens(inputName);
  const matchTokens = getNameTokens(result.matchedName);
  if (!inputTokens.first || !matchTokens.first) return result;

  const firstDist = levenshtein(inputTokens.first, matchTokens.first);
  const firstLen = Math.max(inputTokens.first.length, matchTokens.first.length);
  const maxFirstDist = firstLen <= 6 ? 1 : firstLen <= 10 ? 2 : Math.floor(firstLen * 0.2);
  if (firstDist > maxFirstDist) {
    return {
      matched: false,
      matchedName: result.matchedName,
      distance: result.distance,
    };
  }

  return result;
}

module.exports = {
  normalizeName,
  getNameTokens,
  findExactPlayerMatch,
  findBestPlayerMatch,
  findBestPlayerMatchStrict,
  levenshtein,
};
