import { createHash } from "node:crypto";
import { TRANSPARENT_1X2_PAIRED_EVIDENCE_VERSION } from "./transparent-1x2-paired-evidence.mjs";

export const TRANSPARENT_1X2_MODEL_CANDIDATE_REGISTRY_VERSION = "scorecaster-transparent-1x2-model-candidate-registry-v1";

const REVIEW_STATES = new Set(["pending-review", "rejected", "approved-candidate"]);

const clean = (value, maximum = 180) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

const fingerprint = (value) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const validFingerprint = (value) => /^[0-9a-f]{64}$/i.test(String(value || ""));
const finite = (value) => value === null || value === undefined || value === ""
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
const round = (value, digits = 9) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

function safeReviewer(value) {
  const text = clean(value, 80);
  return /^[A-Za-z0-9._-]{1,80}$/.test(text) ? text : null;
}

function safeEvidenceRef(value) {
  const text = clean(value, 240);
  if (!text) return null;
  if (/password|passwd|secret|token=|apikey|api_key|authorization|bearer\s|private[_ -]?key/i.test(text)) return null;
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (url.username || url.password || url.search) return null;
      return url.toString().slice(0, 240);
    } catch {
      return null;
    }
  }
  return /^[A-Za-z0-9._:/#@+-]{1,240}$/.test(text) ? text : null;
}

function normalizeProfile(profile = {}) {
  const errors = [];
  const engine = clean(profile.engine, 80).toLowerCase();
  const profileId = clean(profile.profileId, 120);
  const modelVersion = clean(profile.modelVersion, 120);
  const trainingCutoff = iso(profile.trainingCutoff);
  const rho = finite(profile.rho);
  const sampleSize = Math.max(0, Math.trunc(finite(profile.sampleSize) ?? 0));
  const sport = clean(profile.scope?.sport, 80).toLowerCase() || "soccer";
  const league = clean(profile.scope?.league, 120).toLowerCase() || "all-reviewed";
  const market = clean(profile.scope?.market, 40).toLowerCase() || "h2h";

  if (engine !== "dixon-coles-1x2") errors.push("unsupported-candidate-engine");
  if (!profileId) errors.push("missing-profile-id");
  if (!modelVersion) errors.push("missing-model-version");
  if (!trainingCutoff) errors.push("missing-training-cutoff");
  if (rho === null || rho < -0.25 || rho > 0.25) errors.push("invalid-dixon-coles-rho");
  if (sampleSize < 100) errors.push("insufficient-candidate-sample");
  if (market !== "h2h") errors.push("unsupported-candidate-market");

  const value = {
    engine,
    profileId,
    modelVersion,
    trainingCutoff,
    rho: rho === null ? null : round(rho, 6),
    sampleSize,
    scope: { sport, league, market }
  };

  return {
    errors,
    value,
    profileFingerprint: fingerprint(value)
  };
}

function normalizePairedEvidence(pairedEvidence = {}) {
  const errors = [];
  const comparisonId = validFingerprint(pairedEvidence.comparisonId) ? String(pairedEvidence.comparisonId).toLowerCase() : null;
  const cohortFingerprint = validFingerprint(pairedEvidence.cohortFingerprint) ? String(pairedEvidence.cohortFingerprint).toLowerCase() : null;
  const configurationFingerprint = validFingerprint(pairedEvidence.configurationFingerprint) ? String(pairedEvidence.configurationFingerprint).toLowerCase() : null;
  const baselinePackageId = validFingerprint(pairedEvidence.baselinePackageId) ? String(pairedEvidence.baselinePackageId).toLowerCase() : null;
  const challengerPackageId = validFingerprint(pairedEvidence.challengerPackageId) ? String(pairedEvidence.challengerPackageId).toLowerCase() : null;
  const baselinePredictionFingerprint = validFingerprint(pairedEvidence.baselinePredictionFingerprint) ? String(pairedEvidence.baselinePredictionFingerprint).toLowerCase() : null;
  const challengerPredictionFingerprint = validFingerprint(pairedEvidence.challengerPredictionFingerprint) ? String(pairedEvidence.challengerPredictionFingerprint).toLowerCase() : null;
  const rowCount = finite(pairedEvidence.rowCount);
  const directionalVerdict = clean(pairedEvidence.metrics?.direction?.overall, 80) || null;
  const brierDelta = finite(pairedEvidence.metrics?.deltaChallengerMinusBaseline?.brier);
  const logLossDelta = finite(pairedEvidence.metrics?.deltaChallengerMinusBaseline?.logLoss);

  if (pairedEvidence.ok !== true) errors.push("paired-evidence-not-valid");
  if (pairedEvidence.version !== TRANSPARENT_1X2_PAIRED_EVIDENCE_VERSION) errors.push("unsupported-paired-evidence-version");
  if (!comparisonId) errors.push("missing-comparison-id");
  if (!cohortFingerprint) errors.push("missing-cohort-fingerprint");
  if (!configurationFingerprint) errors.push("missing-configuration-fingerprint");
  if (!baselinePackageId || !challengerPackageId) errors.push("missing-package-reference");
  if (!baselinePredictionFingerprint || !challengerPredictionFingerprint) errors.push("missing-prediction-fingerprint");
  if (rowCount === null || rowCount < 100) errors.push("insufficient-paired-row-count");
  if (pairedEvidence.evidenceAssessment?.realHistoricalPair !== true) errors.push("paired-evidence-not-real-historical");
  if (pairedEvidence.evidenceAssessment?.readyForManualReview !== true) errors.push("paired-evidence-not-ready-for-manual-review");
  if (pairedEvidence.evidenceAssessment?.label !== "paired-historical-evidence-ready-for-manual-review") errors.push("invalid-paired-evidence-label");
  if (pairedEvidence.evidenceAssessment?.statisticalSignificanceClaimed !== false) errors.push("paired-significance-boundary-invalid");
  if (pairedEvidence.automaticPromotionAllowed !== false) errors.push("paired-auto-promotion-boundary-invalid");
  if (pairedEvidence.productionProbabilityChanged !== false) errors.push("paired-production-change-boundary-invalid");
  if (pairedEvidence.paperOnly !== true) errors.push("paired-paper-only-boundary-invalid");

  return {
    errors,
    value: {
      comparisonId,
      cohortFingerprint,
      configurationFingerprint,
      baselinePackageId,
      challengerPackageId,
      baselinePredictionFingerprint,
      challengerPredictionFingerprint,
      rowCount: rowCount === null ? null : Math.trunc(rowCount),
      directionalVerdict,
      brierDelta: brierDelta === null ? null : round(brierDelta),
      logLossDelta: logLossDelta === null ? null : round(logLossDelta),
      statisticalSignificanceClaimed: false
    }
  };
}

function normalizeReview(review = {}) {
  const errors = [];
  const state = clean(review.state, 40).toLowerCase();
  const reviewedAt = iso(review.reviewedAt);
  const reviewedBy = safeReviewer(review.reviewedBy);
  const evidenceRef = safeEvidenceRef(review.evidenceRef);
  const note = clean(review.note, 320) || null;

  if (!REVIEW_STATES.has(state)) errors.push("invalid-review-state");
  if (state === "pending-review") {
    if (reviewedAt || reviewedBy || evidenceRef) errors.push("pending-review-must-not-claim-human-approval");
  } else {
    if (!reviewedAt) errors.push("missing-review-timestamp");
    if (!reviewedBy) errors.push("missing-reviewer");
    if (!evidenceRef) errors.push("missing-review-evidence-reference");
  }

  return {
    errors,
    value: {
      state,
      reviewedAt,
      reviewedBy,
      evidenceRef,
      note
    }
  };
}

function recordIdentity(record) {
  return {
    schemaVersion: record.schemaVersion,
    candidateId: record.candidateId,
    createdAt: record.createdAt,
    pairedEvidence: record.pairedEvidence,
    profile: record.profile,
    profileFingerprint: record.profileFingerprint,
    review: record.review,
    safety: record.safety
  };
}

export function buildTransparent1X2ModelCandidate({ candidateId, createdAt, pairedEvidence, profile, review = { state: "pending-review" } } = {}) {
  const errors = [];
  const normalizedCandidateId = clean(candidateId, 120);
  const normalizedCreatedAt = iso(createdAt);
  const paired = normalizePairedEvidence(pairedEvidence);
  const normalizedProfile = normalizeProfile(profile);
  const normalizedReview = normalizeReview(review);
  errors.push(...paired.errors, ...normalizedProfile.errors, ...normalizedReview.errors);
  if (!normalizedCandidateId || !/^[a-z0-9][a-z0-9._-]{2,119}$/i.test(normalizedCandidateId)) errors.push("invalid-candidate-id");
  if (!normalizedCreatedAt) errors.push("missing-candidate-created-at");
  if (normalizedCreatedAt && normalizedProfile.value.trainingCutoff && Date.parse(normalizedProfile.value.trainingCutoff) > Date.parse(normalizedCreatedAt)) errors.push("training-cutoff-after-candidate-creation");

  const candidate = {
    schemaVersion: 1,
    candidateId: normalizedCandidateId,
    createdAt: normalizedCreatedAt,
    pairedEvidence: paired.value,
    profile: normalizedProfile.value,
    profileFingerprint: normalizedProfile.profileFingerprint,
    review: normalizedReview.value,
    safety: {
      automaticPromotionAllowed: false,
      runtimeLoadingAllowed: false,
      productionActivationAllowed: false,
      productionProbabilityChanged: false,
      paperOnly: true
    }
  };
  const recordFingerprint = fingerprint(recordIdentity(candidate));

  return {
    ok: errors.length === 0,
    version: TRANSPARENT_1X2_MODEL_CANDIDATE_REGISTRY_VERSION,
    candidate: { ...candidate, recordFingerprint },
    errors: [...new Set(errors)].sort(),
    eligibleForFutureManualProfileChange: errors.length === 0 && normalizedReview.value.state === "approved-candidate",
    automaticPromotionAllowed: false,
    runtimeLoadingAllowed: false,
    productionActivationAllowed: false,
    productionProbabilityChanged: false,
    paperOnly: true
  };
}

export function auditTransparent1X2ModelCandidateRegistry(registry = {}) {
  const failures = [];
  const candidates = Array.isArray(registry.candidates) ? registry.candidates : [];
  if (registry.schemaVersion !== 1) failures.push("invalid-registry-schema-version");
  if (registry.product !== "Scorecaster") failures.push("invalid-registry-product");
  if (registry.modelSurface !== "transparent-1x2") failures.push("invalid-model-surface");
  if (registry.automaticPromotionAllowed !== false) failures.push("registry-auto-promotion-must-be-false");
  if (registry.runtimeLoadingAllowed !== false) failures.push("registry-runtime-loading-must-be-false");

  const candidateIds = new Set();
  const profileIds = new Set();
  const audited = [];

  for (const raw of candidates) {
    const id = clean(raw?.candidateId, 120);
    const profileId = clean(raw?.profile?.profileId, 120);
    const recordFailures = [];
    if (!id || candidateIds.has(id)) recordFailures.push("duplicate-or-missing-candidate-id");
    candidateIds.add(id);
    if (!profileId || profileIds.has(profileId)) recordFailures.push("duplicate-or-missing-profile-id");
    profileIds.add(profileId);

    const rebuilt = buildTransparent1X2ModelCandidate({
      candidateId: raw?.candidateId,
      createdAt: raw?.createdAt,
      pairedEvidence: {
        ok: true,
        version: TRANSPARENT_1X2_PAIRED_EVIDENCE_VERSION,
        comparisonId: raw?.pairedEvidence?.comparisonId,
        cohortFingerprint: raw?.pairedEvidence?.cohortFingerprint,
        configurationFingerprint: raw?.pairedEvidence?.configurationFingerprint,
        baselinePackageId: raw?.pairedEvidence?.baselinePackageId,
        challengerPackageId: raw?.pairedEvidence?.challengerPackageId,
        baselinePredictionFingerprint: raw?.pairedEvidence?.baselinePredictionFingerprint,
        challengerPredictionFingerprint: raw?.pairedEvidence?.challengerPredictionFingerprint,
        rowCount: raw?.pairedEvidence?.rowCount,
        metrics: {
          direction: { overall: raw?.pairedEvidence?.directionalVerdict },
          deltaChallengerMinusBaseline: {
            brier: raw?.pairedEvidence?.brierDelta,
            logLoss: raw?.pairedEvidence?.logLossDelta
          }
        },
        evidenceAssessment: {
          realHistoricalPair: true,
          readyForManualReview: true,
          label: "paired-historical-evidence-ready-for-manual-review",
          statisticalSignificanceClaimed: false
        },
        automaticPromotionAllowed: false,
        productionProbabilityChanged: false,
        paperOnly: true
      },
      profile: raw?.profile,
      review: raw?.review
    });

    recordFailures.push(...rebuilt.errors);
    if (!validFingerprint(raw?.profileFingerprint) || raw.profileFingerprint !== rebuilt.candidate.profileFingerprint) recordFailures.push("profile-fingerprint-mismatch");
    if (!validFingerprint(raw?.recordFingerprint) || raw.recordFingerprint !== rebuilt.candidate.recordFingerprint) recordFailures.push("record-fingerprint-mismatch");
    if (raw?.safety?.automaticPromotionAllowed !== false
      || raw?.safety?.runtimeLoadingAllowed !== false
      || raw?.safety?.productionActivationAllowed !== false
      || raw?.safety?.productionProbabilityChanged !== false
      || raw?.safety?.paperOnly !== true) recordFailures.push("candidate-safety-boundary-invalid");

    audited.push({
      candidateId: id || null,
      profileId: profileId || null,
      reviewState: clean(raw?.review?.state, 40).toLowerCase() || null,
      recordFingerprint: validFingerprint(raw?.recordFingerprint) ? raw.recordFingerprint : null,
      passed: recordFailures.length === 0,
      failures: [...new Set(recordFailures)].sort()
    });
    failures.push(...recordFailures.map((failure) => `${id || "unknown"}:${failure}`));
  }

  const approvedCandidateCount = audited.filter((item) => item.passed && item.reviewState === "approved-candidate").length;
  const rejectedCandidateCount = audited.filter((item) => item.passed && item.reviewState === "rejected").length;
  const pendingCandidateCount = audited.filter((item) => item.passed && item.reviewState === "pending-review").length;

  return {
    ok: failures.length === 0,
    version: TRANSPARENT_1X2_MODEL_CANDIDATE_REGISTRY_VERSION,
    candidateCount: candidates.length,
    approvedCandidateCount,
    rejectedCandidateCount,
    pendingCandidateCount,
    candidates: audited,
    registryFingerprint: fingerprint({
      schemaVersion: registry.schemaVersion,
      product: registry.product,
      modelSurface: registry.modelSurface,
      automaticPromotionAllowed: registry.automaticPromotionAllowed,
      runtimeLoadingAllowed: registry.runtimeLoadingAllowed,
      candidates
    }),
    failures: [...new Set(failures)].sort(),
    productionActivationEligible: false,
    automaticPromotionAllowed: false,
    runtimeLoadingAllowed: false,
    productionProbabilityChanged: false,
    paperOnly: true
  };
}
