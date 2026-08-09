export const PROVIDER_OBSERVATION_NORMALIZATION_VERSION = "scorecaster-provider-observation-normalization-v1";

const UNUSABLE_ODDS_MODES = new Set([
  "api_error",
  "fetch_error",
  "timeout",
  "no_match",
  "low_match_confidence",
  "unsupported_league",
  "not_configured",
  "not_verified",
  "unavailable"
]);

function clean(value, fallback = "unknown") {
  const text = String(value ?? "").trim().toLowerCase();
  return text || fallback;
}

function boundedConfidence(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) return null;
  return Number(number.toFixed(3));
}

function suppliedMatchConfidence(row = {}) {
  const details = row.details && typeof row.details === "object" ? row.details : {};
  const nested = details.data && typeof details.data === "object" ? details.data : {};
  return boundedConfidence(
    details.matchConfidence
      ?? details.match_confidence
      ?? nested.matchConfidence
      ?? nested.match_confidence
      ?? row.confidence
  );
}

export function normalizeStoredProviderObservation(row = {}) {
  const family = clean(row.family, "other");
  const mode = clean(row.mode, "unknown");
  const confidence = family === "odds" ? suppliedMatchConfidence(row) : boundedConfidence(row.confidence);
  const ok = family === "odds" && UNUSABLE_ODDS_MODES.has(mode)
    ? false
    : row.ok === true;

  return {
    ...row,
    ok,
    confidence
  };
}

export function normalizeStoredProviderObservations(rows = []) {
  return (Array.isArray(rows) ? rows : []).map(normalizeStoredProviderObservation);
}

export const PROVIDER_OBSERVATION_UNUSABLE_ODDS_MODES = Object.freeze([...UNUSABLE_ODDS_MODES]);
