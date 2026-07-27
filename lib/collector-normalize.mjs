import { createHash } from "node:crypto";
import { getCollectorSource, sourceCanPublish } from "./collector-source-registry.mjs";

function clean(value, limit = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function safeIso(value, fallback = null) {
  const date = new Date(value || "");
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function canonicalSport(value) {
  const key = clean(value, 80).toLowerCase().replace(/[\s-]+/g, "_");
  const aliases = {
    nhl: "ice_hockey",
    hockey: "ice_hockey",
    basketball_nba: "basketball",
    nba: "basketball",
    soccer: "soccer",
    football: "soccer",
    golf: "golf",
    tennis: "tennis",
    baseball: "baseball",
    mlb: "baseball"
  };
  return aliases[key] || key || "unknown";
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

function fingerprint(parts) {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function normalizeCollectorRecord(input = {}, options = {}) {
  const collectedAt = safeIso(options.collectedAt || input.collectedAt, new Date().toISOString());
  const observedAt = safeIso(input.observedAt || input.commenceTime || input.timestamp, collectedAt);
  const sourceId = clean(options.sourceId || input.sourceId, 80).toLowerCase();
  const source = getCollectorSource(sourceId, options.env || process.env);
  if (!source) return { ok: false, error: "unknown-source", record: null };

  const eventId = clean(input.eventId || input.gameId || input.id, 180);
  const entityId = clean(input.entityId || input.participantId || input.teamId || input.playerId, 180) || null;
  const metric = clean(input.metric || input.type || "event_snapshot", 120).toLowerCase().replace(/[^a-z0-9_.-]/g, "_");
  const sport = canonicalSport(input.sport || input.sportKey || input.league);
  const league = clean(input.league || input.leagueTitle, 120) || null;
  const unit = clean(input.unit, 40) || null;
  const value = finite(input.value);
  const payload = input.payload && typeof input.payload === "object" ? stableObject(input.payload) : {};
  const publication = sourceCanPublish(source);

  if (!eventId) return { ok: false, error: "missing-event-id", record: null };
  if (!metric) return { ok: false, error: "missing-metric", record: null };
  if (!observedAt || new Date(observedAt).getTime() > Date.now() + 10 * 60 * 1000) {
    return { ok: false, error: "invalid-observed-at", record: null };
  }

  const recordFingerprint = fingerprint([
    source.id,
    eventId,
    entityId || "",
    metric,
    observedAt,
    value === null ? "" : String(value),
    JSON.stringify(payload)
  ]);

  return {
    ok: true,
    error: null,
    record: {
      fingerprint: recordFingerprint,
      source_id: source.id,
      source_type: source.type,
      license: source.license,
      access_mode: source.accessMode,
      commercial_use_allowed: source.commercialUseAllowed,
      redistribution_allowed: source.redistributionAllowed,
      attribution_required: source.attributionRequired,
      attribution: source.attribution,
      publishable: publication.allowed,
      publication_block_reason: publication.reason,
      event_id: eventId,
      entity_id: entityId,
      sport,
      league,
      metric,
      value,
      unit,
      observed_at: observedAt,
      collected_at: collectedAt,
      payload,
      confidence: Math.max(0, Math.min(1, finite(input.confidence) ?? 0.7)),
      source_trust: Math.max(0, Math.min(1, finite(input.sourceTrust) ?? 0.7)),
      paper_only: true
    }
  };
}

export function normalizeCollectorBatch(inputs = [], options = {}) {
  const records = [];
  const rejected = [];
  const seen = new Set();
  for (const input of Array.isArray(inputs) ? inputs.slice(0, 5000) : []) {
    const result = normalizeCollectorRecord(input, options);
    if (!result.ok) {
      rejected.push({ error: result.error, eventId: clean(input?.eventId || input?.gameId || input?.id, 180) || null });
      continue;
    }
    if (seen.has(result.record.fingerprint)) continue;
    seen.add(result.record.fingerprint);
    records.push(result.record);
  }
  return {
    records,
    rejected,
    received: Array.isArray(inputs) ? inputs.length : 0,
    accepted: records.length,
    rejectedCount: rejected.length,
    publishable: records.filter((record) => record.publishable).length,
    researchOnly: records.filter((record) => !record.publishable).length
  };
}

export function scorecasterPicksToCollectorRecords(picks = [], collectedAt = new Date().toISOString()) {
  const rows = [];
  for (const pick of Array.isArray(picks) ? picks.slice(0, 100) : []) {
    const eventId = pick.gameId || pick.eventId || pick.id;
    if (!eventId) continue;
    const base = {
      eventId,
      sport: pick.sportKey || pick.sportTitle,
      league: pick.league || pick.leagueTitle,
      observedAt: pick.commenceTime || collectedAt,
      confidence: pick.dataConfidence ?? pick.confidence ?? 0.7,
      sourceTrust: 0.9
    };
    rows.push({
      ...base,
      metric: "event_snapshot",
      payload: {
        homeTeam: clean(pick.homeTeam, 140),
        awayTeam: clean(pick.awayTeam, 140),
        commenceTime: safeIso(pick.commenceTime),
        market: clean(pick.market || pick.marketType, 80) || null,
        selection: clean(pick.selection || pick.pick, 140) || null,
        bestOdds: finite(pick.bestOdds || pick.odds),
        impliedProbability: finite(pick.impliedProbability || pick.marketProbability),
        decision: clean(pick.decision || pick.verdict, 40) || null
      }
    });
    const odds = finite(pick.bestOdds || pick.odds);
    if (odds !== null) rows.push({ ...base, metric: "best_odds", value: odds, unit: "decimal_odds" });
    const probability = finite(pick.impliedProbability || pick.marketProbability);
    if (probability !== null) rows.push({ ...base, metric: "market_probability", value: probability, unit: "probability" });
  }
  return normalizeCollectorBatch(rows, { sourceId: "scorecaster_internal", collectedAt });
}
