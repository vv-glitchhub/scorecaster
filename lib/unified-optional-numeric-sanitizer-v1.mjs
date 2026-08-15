export const UNIFIED_OPTIONAL_NUMERIC_SANITIZER_VERSION = "scorecaster-unified-optional-numeric-sanitizer-v1";

const OPTIONAL_NUMERIC_KEYS = new Set([
  "ageHours",
  "average",
  "awayDistanceKm",
  "awayTravelKm",
  "best",
  "confidence",
  "consensusProbability",
  "congestionScore",
  "distanceKm",
  "divergence",
  "divergenceFromPrimary",
  "formStrength",
  "gamesLast14Days",
  "gamesLast7Days",
  "homeDistanceKm",
  "homeTravelKm",
  "importance",
  "latitude",
  "lineMovement",
  "longitude",
  "marketAverageOdds",
  "modelProbability",
  "movementPct",
  "normalizedScoreMargin",
  "odds",
  "precipitationMm",
  "priceMovement",
  "rainMm",
  "restDays",
  "restHours",
  "restScore",
  "sampleSize",
  "severity",
  "sourceTrust",
  "temperatureC",
  "trust",
  "volatilityScore",
  "weightedResultRate",
  "windKph",
  "windSpeedKph"
]);

function missing(value) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function sanitize(value, key = null, depth = 0) {
  if (key && OPTIONAL_NUMERIC_KEYS.has(key) && missing(value)) return undefined;
  if (depth > 12 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => sanitize(item, null, depth + 1));
  if (typeof value !== "object") return value;

  const output = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    output[childKey] = sanitize(childValue, childKey, depth + 1);
  }
  return output;
}

export function sanitizeUnifiedOptionalNumerics(value) {
  return sanitize(value);
}

export const UNIFIED_OPTIONAL_NUMERIC_SANITIZER_POLICY = Object.freeze({
  version: UNIFIED_OPTIONAL_NUMERIC_SANITIZER_VERSION,
  optionalNumericKeys: [...OPTIONAL_NUMERIC_KEYS].sort(),
  nullBecomesUndefined: true,
  emptyStringBecomesUndefined: true,
  numericZeroPreserved: true,
  nonNumericNullSemanticsPreserved: true,
  maximumDepth: 12,
  probabilityChanged: false,
  decisionChanged: false,
  stakeChanged: false,
  paperOnly: true
});
