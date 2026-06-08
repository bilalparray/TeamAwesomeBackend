function calculateAdjustedRuns(runsScored, isNotOut, isLate) {
  let adjusted = Number.isFinite(runsScored) ? runsScored : 0;
  if (isNotOut === true) adjusted += 10;
  if (isLate === true) adjusted -= 10;
  return adjusted;
}

/**
 * Append innings runs to lastfour.
 * While building a block (0–3 entries): append normally.
 * When lastfour already has 4 entries, a new score starts a fresh block
 * (previous 4 are dropped) — e.g. [10,20,30,40] + 25 → [25].
 */
function appendToLastFour(lastfour, newValues) {
  const arr = Array.isArray(lastfour) ? [...lastfour] : [];
  const incoming = (Array.isArray(newValues) ? newValues : [newValues])
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));
  if (incoming.length === 0) return arr;

  if (arr.length >= 4) {
    return incoming;
  }

  const merged = [...arr, ...incoming];
  if (merged.length > 4) {
    return incoming;
  }
  return merged;
}

module.exports = { calculateAdjustedRuns, appendToLastFour };
