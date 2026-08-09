import { normalizeStoredProviderObservation } from "./provider-observation-normalization-v1.mjs";

const HALF_HOUR_MS = 30 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function clean(value, limit = 220) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  const number = finite(value, 0);
  return Math.max(min, Math.min(max, number));
}

function round(value, digits = 4) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(digits));
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDecision(value) {
  const decision = clean(value, 30).toUpperCase();
  if (decision === "BET") return "PLAY";
  if (decision === "PASS") return "SKIP";
  return ["PLAY", "CAUTION", "SKIP"].includes(decision) ? decision : "CAUTION";
}

export function unifiedDataCaptureBucket(value = Date.now()) {
  const date = new Date(typeof value === "number" ? value : timestamp(value) ?? Date.now());
  const bucket = Math.floor(date.getTime() / HALF_HOUR_MS) * HALF_HOUR_MS;
  return new Date(bucket).toISOString();
}

function oddsFactor(ledger = {}) {
  return (ledger.factors || []).find((factor) => factor.key === "odds-consensus") || null;
}

function factorStatuses(ledger = {}) {
  return Object.fromEntries((ledger.factors || []).map((factor) => [factor.key, {
    status: factor.status,
    usedByAi: Boolean(factor.usedByAi),
    useMode: factor.useMode,
    confidence: round(factor.confidence, 3),
    trust: round(factor.trust, 3),
    impact: round(factor.impact, 4),
    direction: factor.direction,
    downgradeEligible: Boolean(factor.downgradeEligible)
  }]));
}

function providerSummary(pick = {}, ledger = {}) {
  const providers = pick.unifiedDataProviders || {};
  const summary = {};
  for (const [key, value] of Object.entries(providers)) {
    summary[key] = {
      source: clean(value?.source || key, 100),
      mode: clean(value?.mode || "unknown", 40),
      ok: value?.ok !== false && value?.mode !== "fetch_error" && value?.mode !== "api_error"
    };
  }
  summary.sourceCount = Number(ledger.coverage?.sourceCount || 0);
  summary.independentOddsProviders = Number(ledger.coverage?.independentOddsProviders || 1);
  return summary;
}

export function buildUnifiedDataSnapshot(pick = {}, { capturedAt = new Date().toISOString() } = {}) {
  const ledger = pick.unifiedSportsData || {};
  const odds = oddsFactor(ledger);
  const evidence = Array.isArray(odds?.evidence) ? odds.evidence : [];
  const disagreement = evidence.find((item) => item.label === "providerDisagreement")?.value;
  const eventId = clean(pick.gameId || pick.eventId || pick.id || ledger.eventId, 180);
  const selection = clean(pick.selection || pick.label || ledger.selection, 160);
  if (!eventId || !selection) return null;

  const safetyAction = ledger.safetyRecommendation?.action === "DOWNGRADE_TO_CAUTION"
    ? "downgrade"
    : normalizeDecision(pick.productDecision || pick.decision) === "SKIP"
      ? "blocked"
      : "retain";

  return {
    capture_bucket: unifiedDataCaptureBucket(capturedAt),
    captured_at: capturedAt,
    event_id: eventId,
    sport_key: clean(pick.sportKey || pick.league, 120) || null,
    league: clean(pick.leagueTitle || pick.league, 140) || null,
    commence_time: pick.commenceTime || pick.commence_time || null,
    home_team: clean(pick.homeTeam, 140) || null,
    away_team: clean(pick.awayTeam, 140) || null,
    selection,
    decision: normalizeDecision(pick.productDecision || pick.decision),
    odds: finite(pick.odds),
    market_probability: finite(pick.consensusProbability ?? pick.modelProbability),
    provider_count: Math.max(0, Number(ledger.coverage?.independentOddsProviders || 1)),
    provider_disagreement: round(disagreement, 4),
    coverage_score: round(ledger.coverage?.coverageRate || 0, 3),
    used_factor_count: Math.max(0, Number(ledger.coverage?.usedFamilies || ledger.aiExplanation?.dataUsed?.length || 0)),
    total_context_impact: round(ledger.totalBoundedContextImpact || 0, 4),
    safety_action: safetyAction,
    missing_families: [...new Set((ledger.missingData || []).map((item) => clean(item.factor, 80)).filter(Boolean))],
    factor_statuses: factorStatuses(ledger),
    provider_summary: providerSummary(pick, ledger),
    ledger
  };
}

function providerFamily(key) {
  if (/odds/i.test(key)) return "odds";
  if (/injur/i.test(key)) return "injuries";
  if (/lineup/i.test(key)) return "lineups";
  if (/weather/i.test(key)) return "weather";
  if (/news/i.test(key)) return "news";
  if (/context/i.test(key)) return "context";
  return "other";
}

function sourceTrustForProvider(ledger = {}, providerKey = "") {
  const rows = (ledger.sources || []).filter((source) => clean(source.provider, 120).toLowerCase().includes(providerKey.toLowerCase()));
  if (!rows.length) return null;
  return round(rows.reduce((sum, row) => sum + Number(row.trust || 0), 0) / rows.length, 3);
}

export function buildProviderObservations(pick = {}, snapshotId, { capturedAt = new Date().toISOString() } = {}) {
  const ledger = pick.unifiedSportsData || {};
  const providers = pick.unifiedDataProviders || {};
  const odds = oddsFactor(ledger);
  const disagreement = (odds?.evidence || []).find((item) => item.label === "providerDisagreement")?.value;
  const eventId = clean(pick.gameId || pick.eventId || pick.id || ledger.eventId, 180);
  const selection = clean(pick.selection || pick.label || ledger.selection, 160);
  if (!eventId || !selection || !snapshotId) return [];

  const observations = [];
  for (const [key, value] of Object.entries(providers)) {
    const mode = clean(value?.mode || "unknown", 40);
    const ok = value?.ok !== false && !["api_error", "fetch_error", "not_configured", "not_verified", "unavailable"].includes(mode);
    observations.push(normalizeStoredProviderObservation({
      snapshot_id: snapshotId,
      event_id: eventId,
      selection,
      provider_key: clean(value?.source || key, 100),
      family: providerFamily(key),
      mode,
      ok,
      trust: sourceTrustForProvider(ledger, clean(value?.source || key, 100)),
      confidence: null,
      observed_at: value?.observedAt || value?.retrievedAt || null,
      age_hours: value?.observedAt || value?.retrievedAt
        ? round(Math.max(0, (timestamp(capturedAt) - timestamp(value.observedAt || value.retrievedAt)) / HOUR_MS), 2)
        : null,
      divergence_from_primary: providerFamily(key) === "odds" && /secondary/i.test(key) ? round(disagreement, 4) : null,
      details: { key, ...value },
      captured_at: capturedAt
    }));
  }
  return observations;
}

export function buildClosingRecord(snapshotRows = [], { now = Date.now() } = {}) {
  const eligible = snapshotRows
    .filter((row) => timestamp(row.commence_time) !== null && timestamp(row.commence_time) <= now)
    .filter((row) => timestamp(row.captured_at) !== null && timestamp(row.captured_at) <= timestamp(row.commence_time))
    .filter((row) => finite(row.odds) !== null && finite(row.odds) > 1)
    .sort((left, right) => timestamp(left.captured_at) - timestamp(right.captured_at));
  if (!eligible.length) return null;

  const opening = eligible[0];
  const closing = eligible.at(-1);
  const openingOdds = finite(opening.odds);
  const closingOdds = finite(closing.odds);
  if (!closingOdds) return null;
  return {
    event_id: clean(closing.event_id, 180),
    selection: clean(closing.selection, 160),
    sport_key: clean(closing.sport_key, 120) || null,
    league: clean(closing.league, 140) || null,
    commence_time: closing.commence_time,
    opening_odds: openingOdds,
    opening_captured_at: opening.captured_at,
    closing_odds: closingOdds,
    closing_captured_at: closing.captured_at,
    price_clv: openingOdds && closingOdds ? round(openingOdds / closingOdds - 1, 4) : null,
    opening_snapshot_id: opening.id || null,
    closing_snapshot_id: closing.id || null,
    source: "scorecaster-prestart-snapshot",
    finalized_at: new Date(now).toISOString()
  };
}

export function summarizeProviderQuality(observations = []) {
  const groups = new Map();
  for (const row of observations) {
    const key = clean(row.provider_key, 100) || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([provider, rows]) => {
    const available = rows.filter((row) => row.ok === true).length;
    const trustValues = rows.map((row) => finite(row.trust)).filter((value) => value !== null);
    const ageValues = rows.map((row) => finite(row.age_hours)).filter((value) => value !== null);
    const divergences = rows.map((row) => finite(row.divergence_from_primary)).filter((value) => value !== null);
    return {
      provider,
      family: rows[0]?.family || "other",
      samples: rows.length,
      availabilityRate: round(available / rows.length, 3),
      averageTrust: trustValues.length ? round(trustValues.reduce((sum, value) => sum + value, 0) / trustValues.length, 3) : null,
      averageAgeHours: ageValues.length ? round(ageValues.reduce((sum, value) => sum + value, 0) / ageValues.length, 2) : null,
      averageDivergence: divergences.length ? round(divergences.reduce((sum, value) => sum + value, 0) / divergences.length, 4) : null,
      status: available === rows.length ? "healthy" : available === 0 ? "offline" : "degraded"
    };
  }).sort((left, right) => left.provider.localeCompare(right.provider));
}

function incident({ fingerprint, incidentType, severity, title, message, eventId = null, providerKey = null, details = {} }) {
  return { fingerprint, incidentType, severity, title, message, eventId, providerKey, details };
}

export function evaluateUnifiedDataIncidents(currentSnapshots = [], providerQuality = []) {
  const incidents = [];
  for (const row of currentSnapshots) {
    const eventId = clean(row.event_id, 180);
    const selection = clean(row.selection, 160);
    const divergence = finite(row.provider_disagreement);
    if (divergence !== null && divergence >= 0.12) {
      incidents.push(incident({
        fingerprint: `provider-divergence:${eventId}:${selection}`,
        incidentType: "provider_divergence",
        severity: divergence >= 0.2 ? "high" : "medium",
        title: "Odds providers disagree",
        message: `${eventId} / ${selection} has ${(divergence * 100).toFixed(1)}% relative provider disagreement.`,
        eventId,
        details: { selection, divergence }
      }));
    }
    if (Number(row.coverage_score || 0) < 0.4) {
      incidents.push(incident({
        fingerprint: `low-coverage:${eventId}:${selection}`,
        incidentType: "low_data_coverage",
        severity: "medium",
        title: "Unified data coverage is weak",
        message: `${eventId} / ${selection} has ${(Number(row.coverage_score || 0) * 100).toFixed(0)}% configured-family coverage.`,
        eventId,
        details: { selection, coverageScore: Number(row.coverage_score || 0), missingFamilies: row.missing_families || [] }
      }));
    }
    if (Number(row.total_context_impact || 0) <= -0.03) {
      incidents.push(incident({
        fingerprint: `adverse-context:${eventId}:${selection}`,
        incidentType: "adverse_verified_context",
        severity: row.safety_action === "downgrade" ? "high" : "medium",
        title: "Adverse contextual evidence",
        message: `${eventId} / ${selection} has ${(Number(row.total_context_impact) * 100).toFixed(2)} percentage points of bounded contextual risk.`,
        eventId,
        details: { selection, contextImpact: Number(row.total_context_impact), safetyAction: row.safety_action }
      }));
    }
  }

  for (const provider of providerQuality) {
    if (provider.samples >= 4 && provider.availabilityRate < 0.5) {
      incidents.push(incident({
        fingerprint: `provider-health:${provider.provider}`,
        incidentType: "provider_health",
        severity: provider.availabilityRate === 0 ? "high" : "medium",
        title: `${provider.provider} is degraded`,
        message: `${provider.provider} availability is ${(provider.availabilityRate * 100).toFixed(0)}% across ${provider.samples} recent observations.`,
        providerKey: provider.provider,
        details: provider
      }));
    }
  }
  return incidents;
}

export function buildUnifiedDataHistory({ snapshots = [], observations = [], closingRecords = [], incidents = [] } = {}) {
  const ordered = [...snapshots].sort((left, right) => timestamp(left.captured_at) - timestamp(right.captured_at));
  const providerQuality = summarizeProviderQuality(observations);
  const buckets = new Map();
  for (const row of ordered) {
    const key = unifiedDataCaptureBucket(row.captured_at);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  const trend = [...buckets.entries()].map(([capturedAt, rows]) => ({
    capturedAt,
    selections: rows.length,
    averageCoverage: round(rows.reduce((sum, row) => sum + Number(row.coverage_score || 0), 0) / rows.length, 3),
    averageProviderCount: round(rows.reduce((sum, row) => sum + Number(row.provider_count || 0), 0) / rows.length, 2),
    averageContextImpact: round(rows.reduce((sum, row) => sum + Number(row.total_context_impact || 0), 0) / rows.length, 4),
    downgradeCount: rows.filter((row) => row.safety_action === "downgrade").length,
    providerDisagreementCount: rows.filter((row) => Number(row.provider_disagreement || 0) >= 0.12).length
  }));

  const latestBySelection = new Map();
  for (const row of ordered) latestBySelection.set(`${row.event_id}:${row.selection}`, row);
  const latest = [...latestBySelection.values()];
  return {
    version: "unified-sports-data-history-v2",
    generatedAt: new Date().toISOString(),
    summary: {
      snapshotCount: snapshots.length,
      currentSelections: latest.length,
      closingRecordCount: closingRecords.length,
      activeIncidentCount: incidents.filter((row) => row.active !== false).length,
      averageCurrentCoverage: latest.length ? round(latest.reduce((sum, row) => sum + Number(row.coverage_score || 0), 0) / latest.length, 3) : 0,
      multiProviderSelections: latest.filter((row) => Number(row.provider_count || 0) >= 2).length
    },
    trend,
    providerQuality,
    closingRecords,
    incidents,
    latest
  };
}

export const UNIFIED_DATA_CAPTURE_INTERVAL_MINUTES = 30;