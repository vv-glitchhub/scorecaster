import { createHash } from "node:crypto";
import { getSportsAnalyticsCoverage, getSportsAnalyticsDefinition } from "./sports-analytics-catalog.mjs";
import { buildGolfProximityProfile, normalizeAnalyticsObservation } from "./expected-performance-engine.mjs";

const FAMILY_NAMES = new Set([
  "identity", "market", "result", "event", "tracking", "player", "team", "availability",
  "workload", "environment", "officiating", "tactical", "expected", "counterfactual", "quality"
]);

const FACTOR_FAMILIES = Object.freeze({
  "odds-consensus": "market",
  injuries: "availability",
  "lineups-and-starters": "availability",
  "recent-form": "team",
  rest: "workload",
  travel: "workload",
  weather: "environment",
  "market-movement": "market",
  "closing-line": "result",
  news: "quality"
});

const BASE_METRIC_FAMILIES = Object.freeze({
  "selected-odds": "market",
  "market-probability": "market",
  "fair-odds": "market",
  edge: "market",
  "expected-value": "market",
  "bookmaker-count": "market",
  "provider-count": "quality",
  "provider-disagreement": "quality",
  "data-confidence": "quality",
  "source-trust": "quality",
  "trust-score": "quality",
  "verified-coverage": "quality",
  "context-impact": "quality",
  "commence-time": "identity",
  "injury-record-count": "availability",
  "lineup-record-count": "availability",
  "news-record-count": "quality",
  "intelligence-conflict-count": "quality",
  "polymarket-probability": "market"
});

function clean(value, limit = 180) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function metricName(value) {
  return clean(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function iso(value, fallback = null) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function safeMetadata(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return null;
  if (["string", "number", "boolean"].includes(typeof value)) {
    return typeof value === "string" ? clean(value, 500) : value;
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => safeMetadata(item, depth + 1)).filter((item) => item !== null);
  if (typeof value !== "object") return null;
  const output = {};
  for (const [key, entry] of Object.entries(value).slice(0, 80)) {
    if (/secret|token|password|authorization|api[_-]?key|credential/i.test(key)) continue;
    const safe = safeMetadata(entry, depth + 1);
    if (safe !== null) output[clean(key, 80)] = safe;
  }
  return output;
}

function firstFinite(...values) {
  for (const value of values) {
    const number = finite(value);
    if (number !== null) return number;
  }
  return null;
}

export function canonicalSportFromKey(value) {
  const key = clean(value, 120).toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return "unknown";
  if (key.startsWith("icehockey") || key.includes("hockey")) return "ice_hockey";
  if (key.startsWith("soccer") || key.includes("football_soccer")) return "soccer";
  if (key.startsWith("basketball")) return "basketball";
  if (key.startsWith("americanfootball") || key.startsWith("american_football") || key.includes("nfl")) return "american_football";
  if (key.startsWith("baseball")) return "baseball";
  if (key.startsWith("tennis")) return "tennis";
  if (key.startsWith("golf")) return "golf";
  if (key.startsWith("handball")) return "handball";
  if (key.startsWith("volleyball")) return "volleyball";
  if (key.startsWith("floorball")) return "floorball";
  if (key.startsWith("rugby")) return "rugby";
  if (key.startsWith("cricket")) return "cricket";
  if (key.startsWith("mma") || key.startsWith("boxing") || key.includes("ufc")) return "combat_sports";
  if (key.startsWith("motorsport") || key.includes("formula") || key.includes("nascar")) return "motorsport";
  if (key.startsWith("esports")) return "esports";
  return key;
}

export function analyticsCaptureBucket(value = Date.now(), minutes = 30) {
  const timestamp = typeof value === "number" ? value : Date.parse(String(value || ""));
  const valid = Number.isFinite(timestamp) ? timestamp : Date.now();
  const bucketMs = Math.max(1, minutes) * 60_000;
  return new Date(Math.floor(valid / bucketMs) * bucketMs).toISOString();
}

export function observationFingerprint(observation = {}) {
  const parts = [
    observation.eventId,
    observation.participantId,
    observation.family,
    observation.metric,
    observation.provider,
    observation.observedAt,
    observation.value,
    observation.unit,
    observation.metadata?.shotId || observation.metadata?.playId || ""
  ];
  return createHash("sha256").update(parts.map((value) => String(value ?? "")).join("|")).digest("hex");
}

function familyForMetric(sport, metric, requestedFamily = "") {
  const family = clean(requestedFamily, 40).toLowerCase();
  if (FAMILY_NAMES.has(family)) return family;
  if (BASE_METRIC_FAMILIES[metric]) return BASE_METRIC_FAMILIES[metric];
  const definition = getSportsAnalyticsDefinition(sport);
  for (const [name, metrics] of Object.entries(definition?.families || {})) {
    if (metrics.includes(metric)) return name;
  }
  return "event";
}

function makeObservation(input = {}, defaults = {}) {
  const normalized = normalizeAnalyticsObservation({
    ...input,
    sport: input.sport || defaults.sport,
    eventId: input.eventId || defaults.eventId,
    participantId: input.participantId || defaults.participantId,
    observedAt: input.observedAt || defaults.observedAt,
    provider: input.provider || defaults.provider,
    sourceTrust: input.sourceTrust ?? defaults.sourceTrust,
    confidence: input.confidence ?? defaults.confidence,
    metadata: safeMetadata(input.metadata || {})
  });
  if (!normalized.eventId || !normalized.metric || normalized.value === null) return null;
  const family = familyForMetric(normalized.sport, normalized.metric, input.family || defaults.family);
  const observation = {
    ...normalized,
    family,
    league: clean(input.league || defaults.league, 140),
    capturedAt: iso(input.capturedAt || defaults.capturedAt, new Date().toISOString()),
    metadata: safeMetadata(input.metadata || {}) || {}
  };
  return { ...observation, fingerprint: observationFingerprint(observation) };
}

function addNumeric(rows, metric, value, defaults, extra = {}) {
  const number = finite(value);
  if (number === null) return;
  const row = makeObservation({ metric, value: number, ...extra }, defaults);
  if (row) rows.push(row);
}

function evidenceMetric(factorKey, label) {
  const normalized = metricName(label);
  const aliases = {
    selectedodds: "selected-odds",
    primarymarketaverage: "market-average-odds",
    secondarymarketaverage: "secondary-market-average-odds",
    primarybookmakers: "bookmaker-count",
    independentoddsproviders: "provider-count",
    providerdisagreement: "provider-disagreement",
    openingodds: "opening-odds",
    closingodds: "closing-odds",
    priceclv: "clv"
  };
  const compact = normalized.replace(/-/g, "");
  return aliases[compact] || `${metricName(factorKey)}-${normalized}`;
}

export function buildAutomaticObservationsFromPick(pick = {}, { capturedAt = new Date().toISOString() } = {}) {
  const eventId = clean(pick.gameId || pick.eventId || pick.id, 180);
  const sport = canonicalSportFromKey(pick.sportKey || pick.league || pick.sportTitle);
  const defaults = {
    sport,
    eventId,
    league: pick.leagueTitle || pick.league,
    participantId: pick.selection || pick.label,
    observedAt: pick.lastUpdate || pick.updatedAt || capturedAt,
    capturedAt,
    provider: "scorecaster-unified-data",
    sourceTrust: firstFinite(pick.sourceTrust, pick.confidence, 0.55),
    confidence: firstFinite(pick.confidence, 0.35)
  };
  if (!eventId) return [];

  const rows = [];
  addNumeric(rows, "selected-odds", pick.odds, defaults, { family: "market", unit: "decimal-odds" });
  addNumeric(rows, "market-probability", firstFinite(pick.marketProbability, pick.consensusProbability, pick.probability), defaults, { family: "market", unit: "probability" });
  addNumeric(rows, "fair-odds", pick.fairOdds, defaults, { family: "market", unit: "decimal-odds" });
  addNumeric(rows, "edge", pick.edge, defaults, { family: "market", unit: "probability-difference" });
  addNumeric(rows, "expected-value", pick.ev, defaults, { family: "market", unit: "return-per-unit" });
  addNumeric(rows, "bookmaker-count", pick.bookmakerCount, defaults, { family: "market", unit: "count" });
  addNumeric(rows, "data-confidence", pick.confidence, defaults, { family: "quality", unit: "score-0-1" });
  addNumeric(rows, "source-trust", pick.sourceTrust, defaults, { family: "quality", unit: "score-0-1" });
  addNumeric(rows, "trust-score", pick.trustScore, defaults, { family: "quality", unit: "score-0-100" });
  addNumeric(rows, "context-impact", pick.contextImpact, defaults, { family: "quality", unit: "probability-difference" });
  addNumeric(rows, "polymarket-probability", firstFinite(pick.polymarketProbability, pick.polymarketIntelligence?.probability), defaults, { family: "market", unit: "probability", provider: "polymarket" });

  const ledger = pick.unifiedSportsData || {};
  addNumeric(rows, "verified-coverage", ledger.coverage?.verifiedCoverageRate, defaults, { family: "quality", unit: "score-0-1" });
  addNumeric(rows, "provider-count", ledger.coverage?.independentOddsProviders, defaults, { family: "quality", unit: "count" });

  for (const factor of Array.isArray(ledger.factors) ? ledger.factors : []) {
    const factorKey = metricName(factor.key || factor.title || "factor");
    const family = FACTOR_FAMILIES[factor.key] || "quality";
    const factorDefaults = {
      ...defaults,
      provider: factor.sources?.[0]?.provider || defaults.provider,
      sourceTrust: firstFinite(factor.trust, defaults.sourceTrust),
      confidence: firstFinite(factor.confidence, defaults.confidence),
      observedAt: factor.sources?.[0]?.observedAt || defaults.observedAt
    };
    addNumeric(rows, `${factorKey}-confidence`, factor.confidence, factorDefaults, { family, unit: "score-0-1" });
    addNumeric(rows, `${factorKey}-trust`, factor.trust, factorDefaults, { family: "quality", unit: "score-0-1" });
    addNumeric(rows, `${factorKey}-impact`, factor.impact, factorDefaults, { family, unit: "probability-difference" });
    for (const evidence of Array.isArray(factor.evidence) ? factor.evidence : []) {
      for (const [label, value] of Object.entries(evidence || {})) {
        const number = finite(value);
        if (number === null) continue;
        addNumeric(rows, evidenceMetric(factor.key || factorKey, label), number, factorDefaults, {
          family,
          metadata: { factor: factor.key || factorKey, evidenceLabel: label }
        });
      }
    }
  }

  const report = pick.sportsIntelligence || {};
  addNumeric(rows, "injury-record-count", report.injuries?.length, defaults, { family: "availability", unit: "count" });
  addNumeric(rows, "lineup-record-count", report.lineups?.length, defaults, { family: "availability", unit: "count" });
  addNumeric(rows, "news-record-count", report.news?.length, defaults, { family: "quality", unit: "count" });
  addNumeric(rows, "intelligence-conflict-count", report.conflicts?.length, defaults, { family: "quality", unit: "count" });

  const deduped = new Map();
  for (const row of rows) deduped.set(row.fingerprint, row);
  return [...deduped.values()];
}

export function normalizeExternalAnalyticsPayload(payload, defaults = {}) {
  const provider = clean(payload?.provider || payload?.source || defaults.provider || "external-sports-analytics", 80);
  const observedAt = payload?.observedAt || payload?.generatedAt || defaults.observedAt || new Date().toISOString();
  const rawRows = Array.isArray(payload) ? payload : Array.isArray(payload?.observations) ? payload.observations : Array.isArray(payload?.data) ? payload.data : [];
  const observations = [];

  for (const input of rawRows.slice(0, 1000)) {
    const row = makeObservation({
      ...input,
      provider: input.provider || provider,
      observedAt: input.observedAt || observedAt,
      metadata: safeMetadata(input.metadata || input.context || {})
    }, defaults);
    if (row) observations.push(row);
  }

  const golfShots = [];
  for (const [index, shot] of (Array.isArray(payload?.shots) ? payload.shots : []).slice(0, 500).entries()) {
    const startDistanceMeters = finite(shot.startDistanceMeters);
    const endDistanceMeters = finite(shot.endDistanceMeters);
    if (startDistanceMeters === null || endDistanceMeters === null) continue;
    const shotId = clean(shot.shotId || shot.id || `${defaults.eventId || "event"}-${index}`, 120);
    const normalizedShot = {
      shotId,
      participantId: clean(shot.participantId || shot.playerId || shot.player || defaults.participantId, 120),
      startDistanceMeters,
      endDistanceMeters,
      expectedEndDistanceMeters: finite(shot.expectedEndDistanceMeters),
      greenHit: typeof shot.greenHit === "boolean" ? shot.greenHit : null,
      club: clean(shot.club, 60),
      lie: clean(shot.lie || shot.startLie, 60),
      observedAt: iso(shot.observedAt, observedAt)
    };
    golfShots.push(normalizedShot);
    for (const [metric, value, unit] of [
      ["shot-start-distance", startDistanceMeters, "m"],
      ["shot-end-distance", endDistanceMeters, "m"],
      ["expected-proximity", normalizedShot.expectedEndDistanceMeters, "m"],
      ["green-hit", normalizedShot.greenHit === null ? null : normalizedShot.greenHit ? 1 : 0, "boolean"]
    ]) {
      if (value === null) continue;
      const row = makeObservation({
        sport: "golf",
        eventId: defaults.eventId,
        participantId: normalizedShot.participantId,
        family: metric === "expected-proximity" ? "expected" : "event",
        metric,
        value,
        unit,
        observedAt: normalizedShot.observedAt,
        provider,
        sourceTrust: defaults.sourceTrust ?? payload?.sourceTrust ?? 0.75,
        confidence: defaults.confidence ?? payload?.confidence ?? 0.7,
        metadata: { shotId, club: normalizedShot.club, lie: normalizedShot.lie }
      }, defaults);
      if (row) observations.push(row);
    }
  }

  const deduped = new Map();
  for (const row of observations) deduped.set(row.fingerprint, row);
  return { provider, observations: [...deduped.values()], golfShots };
}

export function mergeAnalyticsObservations(...collections) {
  const rows = new Map();
  for (const collection of collections) {
    for (const row of Array.isArray(collection) ? collection : []) {
      if (row?.fingerprint) rows.set(row.fingerprint, row);
    }
  }
  return [...rows.values()];
}

export function buildSportsAnalyticsSnapshot({ pick = {}, observations = [], golfShots = [], providerStatus = {}, capturedAt = new Date().toISOString() } = {}) {
  const eventId = clean(pick.gameId || pick.eventId || pick.id, 180);
  const sportKey = clean(pick.sportKey || pick.league || pick.sportTitle, 120);
  const canonicalSport = canonicalSportFromKey(sportKey);
  const availableMetrics = [...new Set(observations.map((row) => row.metric).filter(Boolean))].sort();
  const coverage = getSportsAnalyticsCoverage(canonicalSport, availableMetrics);
  const providerNames = [...new Set(observations.map((row) => row.provider).filter(Boolean))];
  const familyObserved = new Map();
  for (const row of observations) familyObserved.set(row.family, (familyObserved.get(row.family) || 0) + 1);
  const familyCoverage = (coverage?.families || []).map((row) => ({
    ...row,
    observedRows: familyObserved.get(row.family) || 0
  }));
  const golfProfile = canonicalSport === "golf" ? buildGolfProximityProfile(golfShots) : [];

  return {
    event_id: eventId,
    sport_key: sportKey,
    canonical_sport: canonicalSport,
    league: clean(pick.leagueTitle || pick.league, 140),
    match: clean(pick.match || `${pick.homeTeam || "Home"} vs ${pick.awayTeam || "Away"}`, 240),
    commence_time: iso(pick.commenceTime || pick.commence_time),
    captured_at: iso(capturedAt, new Date().toISOString()),
    capture_bucket: analyticsCaptureBucket(capturedAt),
    observation_count: observations.length,
    provider_count: providerNames.length,
    coverage_score: coverage?.coverage === null || coverage?.coverage === undefined ? 0 : clamp(coverage.coverage, 0, 1),
    available_metrics: availableMetrics,
    missing_metrics: (coverage?.families || []).flatMap((row) => row.missingMetrics || []),
    family_coverage: familyCoverage,
    provider_status: safeMetadata({ ...providerStatus, observedProviders: providerNames }),
    golf_profile: golfProfile,
    raw_summary: {
      catalogMetricCount: coverage?.requiredMetricCount || 0,
      catalogAvailableMetricCount: coverage?.availableMetricCount || 0,
      observedFamilies: Object.fromEntries(familyObserved),
      productDecision: clean(pick.productDecision || pick.decision, 30),
      probabilityChanged: false,
      paperOnly: true
    },
    paper_only: true
  };
}

export function toSportsAnalyticsObservationRows(snapshotId, snapshot, observations = []) {
  return observations.map((row) => ({
    fingerprint: row.fingerprint,
    snapshot_id: snapshotId,
    event_id: snapshot.event_id,
    sport_key: snapshot.sport_key,
    canonical_sport: snapshot.canonical_sport,
    league: snapshot.league,
    participant_id: row.participantId || null,
    family: row.family,
    metric: row.metric,
    value: row.value,
    unit: row.unit || null,
    observed_at: row.observedAt || snapshot.captured_at,
    captured_at: snapshot.captured_at,
    provider: row.provider || "unknown",
    source_trust: clamp(finite(row.sourceTrust) ?? 0, 0, 1),
    confidence: clamp(finite(row.confidence) ?? 0, 0, 1),
    metadata: safeMetadata(row.metadata || {}),
    paper_only: true
  }));
}

export function summarizeSportsAnalyticsSnapshots(rows = []) {
  const latestByEvent = new Map();
  for (const row of rows) {
    const current = latestByEvent.get(row.event_id);
    if (!current || Date.parse(row.captured_at) > Date.parse(current.captured_at)) latestByEvent.set(row.event_id, row);
  }
  const latest = [...latestByEvent.values()];
  const bySport = new Map();
  for (const row of latest) {
    const key = row.canonical_sport || "unknown";
    if (!bySport.has(key)) bySport.set(key, { sport: key, events: 0, observations: 0, providers: 0, coverageTotal: 0, latestCapturedAt: null });
    const item = bySport.get(key);
    item.events += 1;
    item.observations += Number(row.observation_count || 0);
    item.providers = Math.max(item.providers, Number(row.provider_count || 0));
    item.coverageTotal += Number(row.coverage_score || 0);
    if (!item.latestCapturedAt || Date.parse(row.captured_at) > Date.parse(item.latestCapturedAt)) item.latestCapturedAt = row.captured_at;
  }
  const sports = [...bySport.values()].map((item) => ({
    sport: item.sport,
    events: item.events,
    observations: item.observations,
    providers: item.providers,
    coverage: item.events ? Number((item.coverageTotal / item.events).toFixed(4)) : 0,
    latestCapturedAt: item.latestCapturedAt
  })).sort((a, b) => b.observations - a.observations);
  return {
    eventCount: latest.length,
    observationCount: latest.reduce((sum, row) => sum + Number(row.observation_count || 0), 0),
    providerCount: latest.reduce((max, row) => Math.max(max, Number(row.provider_count || 0)), 0),
    overallCoverage: latest.length ? Number((latest.reduce((sum, row) => sum + Number(row.coverage_score || 0), 0) / latest.length).toFixed(4)) : 0,
    latestCapturedAt: latest.reduce((latestAt, row) => !latestAt || Date.parse(row.captured_at) > Date.parse(latestAt) ? row.captured_at : latestAt, null),
    sports
  };
}
