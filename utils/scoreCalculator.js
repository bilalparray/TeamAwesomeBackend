function calculateAdjustedRuns(runsScored, isNotOut, isLate) {
  let adjusted = Number.isFinite(runsScored) ? runsScored : 0;
  if (isNotOut === true) adjusted += 10;
  if (isLate === true) adjusted -= 10;
  return adjusted;
}

module.exports = { calculateAdjustedRuns };
