function normalizeName(name) {
  if (typeof name !== "string") return "";
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "") // keep letters/numbers/spaces; drop punctuation
    .trim();
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

module.exports = {
  normalizeName,
  findBestPlayerMatch,
  levenshtein,
};
