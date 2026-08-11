import { createHash } from "node:crypto";

export const MODEL_LINEAGE_GUARD_VERSION = "scorecaster-model-lineage-guard-v1";

const MARKET_PATTERNS = [/^market$/, /odds/, /bookmaker/, /price/, /consensus/];
const HISTORICAL_PATTERNS = [
  /^historical(?:-results)?$/,
  /(^|-)result(?:s)?($|-)/,
  /(^|-)form($|-)/,
  /(^|-)rating($|-)/,
  /(^|-)elo($|-)/,
  /(^|-)rest($|-)/,
  /schedule/
];
const EXPECTED_PATTERNS = [/^expected(?:-|$)/, /(^|-)xg($|-)/, /shot-quality/, /efficiency/, /(^|-)epa($|-)/, /xwoba/, /strokes-gained/, /expected-points/];
const TRACKING_PATTERNS = [/tracking/, /location/, /trajectory/, /speed/, /distance/, /spacing/];
const STAT_PATTERNS = [/event-stat/, /box-score/, /team-stat/, /player-stat/, /possession/, /(^|-)shot(?:s)?($|-)/, /attempt/, /pace/, /offensive-rating/, /defensive-rating/];
const CONTEXT_PATTERNS = [/availability/, /injury/, /lineup/, /weather/, /environment/, /travel/, /workload/, /context/, /officiating/];

function clean(value, limit = 120) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, limit);
}

function list(value, limit = 24) {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(source.map((item) => clean(item, 100)).filter(Boolean))].slice(0, limit);
}

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function normalizeSignalFamily(value) {
  const family = clean(value, 100).replace(/[\s_]+/g, "-");
  if (!family) return null;
  if (matchesAny(family, MARKET_PATTERNS)) return "market";
  if (matchesAny(family, HISTORICAL_PATTERNS)) return "historical-results";
  if (matchesAny(family, EXPECTED_PATTERNS)) return "expected-performance";
  if (matchesAny(family, TRACKING_PATTERNS)) return "tracking";
  if (matchesAny(family, STAT_PATTERNS)) return "performance-statistics";
  if (matchesAny(family, CONTEXT_PATTERNS)) return "context";
  return family;
}

function sportPrefix(value) {
  return clean(value || "unknown", 100).replace(/[^a-z0-9_-]/g, "-") || "unknown";
}

function lineageInputs(candidate = {}) {
  const audit = candidate.audit && typeof candidate.audit === "object" ? candidate.audit : {};
  const rawFamilies = [
    ...(Array.isArray(candidate.signalFamilies) ? candidate.signalFamilies : []),
    ...(Array.isArray(candidate.signal_families) ? candidate.signal_families : []),
    ...(Array.isArray(candidate.dataLineage?.signalFamilies) ? candidate.dataLineage.signalFamilies : []),
    ...(Array.isArray(candidate.data_lineage?.signal_families) ? candidate.data_lineage.signal_families : []),
    ...(Array.isArray(audit.signalFamilies) ? audit.signalFamilies : []),
    ...(Array.isArray(audit.signal_families) ? audit.signal_families : []),
    ...(Array.isArray(audit.dataLineage?.signalFamilies) ? audit.dataLineage.signalFamilies : []),
    ...(Array.isArray(audit.data_lineage?.signal_families) ? audit.data_lineage.signal_families : [])
  ];
  const rawProviders = [
    ...(Array.isArray(candidate.dataLineage?.providers) ? candidate.dataLineage.providers : []),
    ...(Array.isArray(candidate.data_lineage?.providers) ? candidate.data_lineage.providers : []),
    ...(Array.isArray(audit.dataLineage?.providers) ? audit.dataLineage.providers : []),
    ...(Array.isArray(audit.data_lineage?.providers) ? audit.data_lineage.providers : []),
    candidate.provider,
    candidate.source,
    audit.source
  ];
  const rawMetrics = [
    ...(Array.isArray(candidate.dataLineage?.metrics) ? candidate.dataLineage.metrics : []),
    ...(Array.isArray(candidate.data_lineage?.metrics) ? candidate.data_lineage.metrics : []),
    ...(Array.isArray(audit.dataLineage?.metrics) ? audit.dataLineage.metrics : []),
    ...(Array.isArray(audit.data_lineage?.metrics) ? audit.data_lineage.metrics : [])
  ];

  return {
    claimedDependenceGroup: clean(candidate.dependenceGroup || candidate.dependence_group || audit.dependenceGroup || audit.dependence_group, 160) || null,
    rawSignalFamilies: list(rawFamilies),
    providers: list(rawProviders, 16),
    metrics: list(rawMetrics, 40)
  };
}

function deriveDependenceGroup(signalFamilies, sportKey) {
  const prefix = sportPrefix(sportKey);
  if (signalFamilies.includes("historical-results")) return `${prefix}-historical-results-family`;
  if (signalFamilies.includes("expected-performance")) return `${prefix}-expected-performance-family`;
  if (signalFamilies.includes("tracking")) return `${prefix}-tracking-family`;
  if (signalFamilies.includes("performance-statistics")) return `${prefix}-performance-statistics-family`;
  if (signalFamilies.includes("context")) return `${prefix}-context-derived-family`;
  if (signalFamilies.length === 1) return `${prefix}-${signalFamilies[0]}-family`;
  if (signalFamilies.length > 1) {
    const signature = createHash("sha256").update(signalFamilies.toSorted().join("|")).digest("hex").slice(0, 12);
    return `${prefix}-mixed-${signature}-family`;
  }
  return null;
}

function predictiveCoreFamilies(signalFamilies) {
  return signalFamilies.filter((family) => !["market", "context"].includes(family));
}

export function auditModelLineageV1(candidate = {}, { sportKey, requireLineage = true } = {}) {
  const inputs = lineageInputs(candidate);
  const signalFamilies = [...new Set(inputs.rawSignalFamilies.map(normalizeSignalFamily).filter(Boolean))].sort();
  const errors = [];
  const warnings = [];

  if (requireLineage && signalFamilies.length === 0) errors.push("missing-signal-lineage");
  if (signalFamilies.includes("market")) errors.push("market-derived-signal-not-independent");
  if (signalFamilies.length > 0 && predictiveCoreFamilies(signalFamilies).length === 0) errors.push("context-only-signal-not-independent");

  const dependenceGroup = deriveDependenceGroup(signalFamilies, sportKey);
  if (requireLineage && !dependenceGroup) errors.push("dependence-group-could-not-be-derived");
  if (inputs.claimedDependenceGroup && dependenceGroup && inputs.claimedDependenceGroup !== dependenceGroup) {
    warnings.push("claimed-dependence-group-overridden-by-lineage");
  }

  const lineageFingerprint = createHash("sha256").update(JSON.stringify({
    sportKey: sportPrefix(sportKey),
    signalFamilies,
    providers: inputs.providers.toSorted(),
    metrics: inputs.metrics.toSorted(),
    dependenceGroup
  })).digest("hex");

  return {
    ok: errors.length === 0,
    version: MODEL_LINEAGE_GUARD_VERSION,
    signalFamilies,
    providers: inputs.providers,
    metrics: inputs.metrics,
    dependenceGroup,
    claimedDependenceGroup: inputs.claimedDependenceGroup,
    lineageFingerprint,
    errors: [...new Set(errors)].sort(),
    warnings: [...new Set(warnings)].sort(),
    policy: {
      dependenceGroupSelfDeclared: false,
      marketDerivedIndependentModelAllowed: false,
      contextOnlyIndependentModelAllowed: false,
      mixedLineageUsesConservativePrecedence: true,
      historicalSignalDominatesMixedDependenceGrouping: true,
      paperOnly: true
    }
  };
}

export const MODEL_SIGNAL_FAMILY_EXAMPLES = Object.freeze({
  historicalResults: ["historical-results", "form", "elo", "rating", "rest"],
  expectedPerformance: ["expected-performance", "xg", "shot-quality", "efficiency", "epa", "xwoba", "strokes-gained"],
  performanceStatistics: ["event-stats", "box-score", "team-stats", "player-stats", "pace", "shots"],
  tracking: ["tracking", "player-location", "puck-location", "ball-trajectory", "spacing"],
  context: ["availability", "injury", "lineup", "weather", "travel", "workload"],
  market: ["market", "odds", "bookmaker", "price", "consensus"]
});
