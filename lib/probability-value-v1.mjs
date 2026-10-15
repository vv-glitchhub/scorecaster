// Independent model probability and price analysis. This is paper-only
// research until chronological out-of-sample calibration is independently verified.
export const PROBABILITY_VALUE_VERSION = "probability-value-v1";

function validProbability(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 && num < 1 ? num : null;
}

function validOdds(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 1 ? num : null;
}

function rounded(value) {
  return Number(value.toFixed(5));
}

export function evaluateProbabilityValueV1(pick = {}) {
  const odds = validOdds(pick.odds);
  const breakEvenProbability = odds === null ? null : rounded(1 / odds);
  const evidence = pick.ownedDecisionEvidenceV1 || {};
  const independent = pick.marketKey === "h2h" &&
    pick.fixtureVerifiedByProvider === true &&
    evidence.qualified === true &&
    evidence.marketMapped === true &&
    evidence.independentFromMarket === true &&
    evidence.fresh === true &&
    evidence.chronologySafe === true &&
    evidence.strongConflict !== true;
  const probability = independent ? validProbability(evidence.probability) : null;
  const modelEstimatedEV = odds !== null && probability !== null ? rounded(probability * odds - 1) : null;

  // A confidence score is not a probability confidence bound. Only an
  // explicitly validated, calibrated lower bound may pass this gate.
  const calibration = evidence.validation || {};
  const lower = independent &&
    calibration.outOfSample === true &&
    calibration.calibrated === true &&
    Number.isInteger(calibration.sampleSize) &&
    calibration.sampleSize >= 200 &&
    Number(calibration.confidenceLevel) >= 0.9
    ? validProbability(calibration.lowerProbability)
    : null;
  const conservativeEV = odds !== null && lower !== null ? rounded(lower * odds - 1) : null;

  let status = "independent-model-unavailable";
  if (odds === null || !pick.fixtureVerifiedByProvider) status = "unverified-market";
  else if (probability !== null && lower === null) status = "out-of-sample-calibration-required";
  else if (lower !== null && conservativeEV <= 0) status = "nonpositive-conservative-value";
  else if (lower !== null && pick.productDecision !== "PLAY") status = "existing-play-safety-gate";
  else if (lower !== null && conservativeEV > 0) status = "eligible-paper-analysis";

  return {
    version: PROBABILITY_VALUE_VERSION,
    status,
    probabilitySource: probability === null ? null : "scorecaster-owned-baseline",
    modelEstimatedWinProbability: probability,
    breakEvenProbability,
    modelEstimatedEV,
    calibratedLowerProbability: lower,
    conservativeEV,
    eligible: status === "eligible-paper-analysis",
    paperOnly: true,
    realMoneyBetting: false
  };
}

export function probabilityValueLeaderboardsV1(picks = [], limit = 3) {
  const eligible = (Array.isArray(picks) ? picks : []).filter((pick) =>
    pick?.probabilityValue?.eligible === true &&
    pick.productDecision === "PLAY" &&
    pick.probabilityValue.conservativeEV > 0
  );
  const count = Math.max(0, Math.min(10, Math.trunc(Number(limit) || 0)));
  const highProbabilityValue = [...eligible]
    .sort((a,b) =>
      (b.probabilityValue.modelEstimatedWinProbability - a.probabilityValue.modelEstimatedWinProbability) ||
      (b.probabilityValue.conservativeEV - a.probabilityValue.conservativeEV)
    ).slice(0,count).map((pick) => pick.id);
  const maximumValue = [...eligible]
    .sort((a,b) =>
      (b.probabilityValue.conservativeEV - a.probabilityValue.conservativeEV) ||
      (b.probabilityValue.modelEstimatedWinProbability - a.probabilityValue.modelEstimatedWinProbability)
    ).slice(0,count).map((pick) => pick.id);
  return {
    version: PROBABILITY_VALUE_VERSION,
    eligibleCount: eligible.length,
    highProbabilityValue,
    maximumValue,
    status: eligible.length ? "qualified-paper-candidates" : "no-calibrated-qualified-candidates",
    paperOnly: true
  };
}
