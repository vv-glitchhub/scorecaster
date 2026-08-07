import { buildTransparent1X2 } from "./transparent-1x2-engine.mjs";
import { buildDixonColes1X2 } from "./dixon-coles-1x2.mjs";

export const TRANSPARENT_1X2_V2_VERSION = "scorecaster-transparent-1x2-v2";

const clean = (value, maximum = 120) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const round = (value, digits = 6) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;

function challengerProfile(value, generatedAt) {
  if (!value || typeof value !== "object") {
    return {
      supplied: false,
      valid: false,
      status: "not-supplied",
      reason: "no-chronology-validated-challenger-profile",
      rho: 0,
      sampleSize: 0,
      trainingCutoff: null,
      profileId: null
    };
  }

  const status = clean(value.status, 40).toLowerCase();
  const trainingCutoff = iso(value.trainingCutoff ?? value.training_cutoff);
  const sampleSize = Math.max(0, Math.trunc(Number(value.sampleSize ?? value.sample_size) || 0));
  const rho = Number(value.rho);
  const profileId = clean(value.profileId ?? value.id, 120) || null;
  const errors = [];

  if (status !== "validated") errors.push("profile-not-validated");
  if (!trainingCutoff) errors.push("missing-training-cutoff");
  if (trainingCutoff && Date.parse(trainingCutoff) > Date.parse(generatedAt)) errors.push("training-cutoff-after-prediction");
  if (!Number.isFinite(rho) || rho < -0.25 || rho > 0.25) errors.push("invalid-dixon-coles-rho");
  if (sampleSize < 100) errors.push("insufficient-validation-sample");

  return {
    supplied: true,
    valid: errors.length === 0,
    status,
    reason: errors[0] || null,
    errors,
    rho: Number.isFinite(rho) ? round(rho, 6) : 0,
    sampleSize,
    trainingCutoff,
    profileId
  };
}

export function buildTransparent1X2V2(input = {}, configuration = {}) {
  const baseline = buildTransparent1X2(input, configuration.baseline || configuration);
  if (!baseline.ok) {
    return {
      ...baseline,
      modelVersion: TRANSPARENT_1X2_V2_VERSION,
      baselineModelVersion: baseline.modelVersion,
      productionProbabilityChangedByChallenger: false
    };
  }

  const profile = challengerProfile(configuration.challengerProfile ?? input.challengerProfile, baseline.generatedAt);
  if (profile.supplied && profile.status === "validated" && !profile.valid && profile.reason === "training-cutoff-after-prediction") {
    return {
      ok: false,
      modelVersion: TRANSPARENT_1X2_V2_VERSION,
      baselineModelVersion: baseline.modelVersion,
      reason: "challenger-profile-chronology-violation",
      challengerProfile: profile,
      closingLineUsed: false,
      postKickoffDataUsed: false,
      productionProbabilityChangedByChallenger: false,
      paperOnly: true
    };
  }

  const dixonColes = buildDixonColes1X2({
    homeLambda: baseline.expectedGoals.home,
    awayLambda: baseline.expectedGoals.away,
    rho: profile.valid ? profile.rho : 0
  });

  const probabilityDelta = dixonColes.ok
    ? Object.fromEntries(["home", "draw", "away"].map((key) => [key, round(dixonColes.probabilities[key] - baseline.probabilities[key])]))
    : null;

  return {
    ...baseline,
    modelVersion: TRANSPARENT_1X2_V2_VERSION,
    baselineModelVersion: baseline.modelVersion,
    modelStatus: profile.valid
      ? "transparent-v2-baseline-with-validated-offline-challenger"
      : "transparent-v2-baseline-challenger-not-calibrated",
    calibrated: false,
    productionProbabilities: baseline.probabilities,
    probabilities: baseline.probabilities,
    productionProbabilityChangedByChallenger: false,
    challenger: {
      role: "offline-evaluation-only",
      profile,
      dixonColes,
      probabilityDelta,
      eligibleForOfflineComparison: profile.valid && dixonColes.ok,
      canAffectProductionDecision: false,
      canPromotePlayByItself: false
    },
    validationContract: {
      engine: "scorecaster-transparent-1x2-validation-v2",
      requiredBeforePromotion: [
        "chronological rolling evaluation",
        "multiclass Brier score",
        "log loss",
        "calibration reliability bins",
        "league and season slices",
        "separate no-vig market benchmark",
        "minimum sample requirement"
      ],
      automaticPromotionAllowed: false
    },
    formulas: [
      ...baseline.formulas,
      "Dixon-Coles challenger: P_DC(x,y) proportional to tau(x,y,lambda_home,lambda_away,rho) * P_Poisson(x,y) for low scores"
    ],
    limitations: [
      ...baseline.limitations,
      profile.valid
        ? "A chronology-validated Dixon-Coles profile is visible only as an offline challenger and does not change production probabilities."
        : "Dixon-Coles correction remains neutral until a chronology-validated profile with sufficient sample size is supplied."
    ]
  };
}
