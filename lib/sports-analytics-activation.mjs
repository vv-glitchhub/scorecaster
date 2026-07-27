import { getSportsAnalyticsDefinition } from "./sports-analytics-catalog.mjs";

const FAMILY_WEIGHTS = Object.freeze({
  expected: 1,
  tracking: 0.96,
  availability: 0.92,
  player: 0.88,
  team: 0.84,
  event: 0.8,
  workload: 0.76,
  environment: 0.72,
  tactical: 0.7,
  officiating: 0.62,
  counterfactual: 0.6,
  quality: 0.55,
  identity: 0.45,
  market: 0.4,
  result: 0.35
});

function clean(value, limit = 160) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function latestByEvent(rows = []) {
  const latest = new Map();
  for (const row of rows || []) {
    const eventId = clean(row.event_id || row.eventId, 180);
    const at = timestamp(row.captured_at || row.capturedAt);
    if (!eventId || at === null) continue;
    const current = latest.get(eventId);
    if (!current || at > current.at) latest.set(eventId, { at, row });
  }
  return [...latest.values()].map((item) => item.row);
}

function sourceTypeForFamily(family) {
  if (family === "tracking") return "tracking feed";
  if (family === "expected" || family === "counterfactual") return "advanced event model";
  if (family === "availability") return "lineup and injury feed";
  if (family === "player" || family === "team") return "player and team statistics feed";
  if (family === "event" || family === "tactical") return "play-by-play event feed";
  if (family === "environment") return "venue and weather feed";
  if (family === "officiating") return "officials feed";
  if (family === "workload") return "schedule and workload feed";
  return "sport data feed";
}

export function buildSportCoverageMatrix(snapshots = []) {
  const sports = new Map();
  for (const row of latestByEvent(snapshots)) {
    const sport = clean(row.canonical_sport || row.canonicalSport, 60);
    if (!sport) continue;
    if (!sports.has(sport)) sports.set(sport, { sport, events: 0, metrics: new Set(), providers: 0, families: new Map(), latestCapturedAt: null });
    const item = sports.get(sport);
    item.events += 1;
    item.providers = Math.max(item.providers, Number(row.provider_count ?? row.providerCount ?? 0));
    for (const metric of row.available_metrics || row.availableMetrics || []) item.metrics.add(clean(metric, 120));
    const capturedAt = row.captured_at || row.capturedAt || null;
    if (capturedAt && (!item.latestCapturedAt || timestamp(capturedAt) > timestamp(item.latestCapturedAt))) item.latestCapturedAt = capturedAt;
  }

  return [...sports.values()].map((item) => {
    const definition = getSportsAnalyticsDefinition(item.sport);
    const families = Object.entries(definition?.families || {}).map(([family, requiredMetrics]) => {
      const availableMetrics = requiredMetrics.filter((metric) => item.metrics.has(metric));
      return {
        family,
        required: requiredMetrics.length,
        available: availableMetrics.length,
        coverage: requiredMetrics.length ? round(availableMetrics.length / requiredMetrics.length) : null,
        availableMetrics,
        missingMetrics: requiredMetrics.filter((metric) => !item.metrics.has(metric))
      };
    });
    const required = families.reduce((sum, row) => sum + row.required, 0);
    const available = families.reduce((sum, row) => sum + row.available, 0);
    return {
      sport: item.sport,
      events: item.events,
      providers: item.providers,
      availableMetrics: item.metrics.size,
      requiredMetrics: required,
      coverage: required ? round(available / required) : 0,
      latestCapturedAt: item.latestCapturedAt,
      families
    };
  }).sort((a, b) => b.events - a.events || b.coverage - a.coverage);
}

export function buildMetricActivationPriorities(snapshots = [], { maxItems = 80 } = {}) {
  const matrix = buildSportCoverageMatrix(snapshots);
  const priorities = [];
  for (const sport of matrix) {
    for (const family of sport.families) {
      const familyWeight = FAMILY_WEIGHTS[family.family] ?? 0.5;
      const gap = family.required ? 1 - family.available / family.required : 0;
      for (const metric of family.missingMetrics) {
        const eventWeight = 1 + Math.log1p(sport.events);
        const providerPenalty = sport.providers > 1 ? 0.95 : 1.05;
        const score = familyWeight * eventWeight * (0.7 + gap * 0.3) * providerPenalty;
        priorities.push({
          sport: sport.sport,
          family: family.family,
          metric,
          priorityScore: round(score),
          currentFamilyCoverage: family.coverage,
          eventCount: sport.events,
          currentProviders: sport.providers,
          requiredSourceType: sourceTypeForFamily(family.family),
          reason: `${family.family} coverage is ${Math.round((family.coverage || 0) * 100)}% across ${sport.events} current event(s).`
        });
      }
    }
  }
  return priorities.sort((a, b) => b.priorityScore - a.priorityScore || b.eventCount - a.eventCount || a.metric.localeCompare(b.metric)).slice(0, maxItems);
}

export function buildSportsAnalyticsActivationPlan(snapshots = []) {
  const coverageMatrix = buildSportCoverageMatrix(snapshots);
  return {
    generatedAt: new Date().toISOString(),
    coverageMatrix,
    priorities: buildMetricActivationPriorities(snapshots),
    policy: {
      recommendationOnly: true,
      automaticProviderPurchase: false,
      automaticProbabilityChange: false,
      missingDataInvented: false
    }
  };
}
