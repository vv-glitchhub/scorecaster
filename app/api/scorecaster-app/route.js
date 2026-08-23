import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildProductionControlCenter } from "../../../lib/production-control-center.mjs";
import { buildIntelligenceBundle } from "../../../lib/intelligence-v3.mjs";
import { buildIntelligenceV4 } from "../../../lib/intelligence-v4.mjs";
import {
  buildDecisionTransparency,
  OPEN_METHODOLOGY,
  publicRecord,
  publicSourceCatalogue
} from "../../../lib/decision-transparency.mjs";
import { buildVisibleObservations, withVisibleDailyTop3 } from "../../../lib/visible-observations.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const json = (body, status = 200) => Response.json(body, { status, headers: HEADERS });
const clampInt = (value, fallback, min, max) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
};
const cleanSport = (value, limit = 80) => String(value || "")
  .replace(/[^a-zA-Z0-9_-]/g, "")
  .slice(0, limit)
  .toLowerCase();
const cleanEventId = (value, limit = 180) => String(value || "")
  .replace(/[^a-zA-Z0-9_.:-]/g, "")
  .slice(0, limit);
const cleanText = (value, limit = 180) => String(value || "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

function latestRecord(records = [], metric = null) {
  return [...records]
    .filter((record) => !metric || record.metric === metric)
    .sort((a, b) => new Date(b.observedAt || 0) - new Date(a.observedAt || 0))[0] || null;
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function eventIdentity(records = []) {
  const snapshot = latestRecord(records, "event_snapshot")?.payload || {};
  const newestPayload = latestRecord(records)?.payload || {};
  const payload = { ...newestPayload, ...snapshot };
  return {
    homeTeam: cleanText(payload.homeTeam || payload.home_team || payload.home || payload.team_home),
    awayTeam: cleanText(payload.awayTeam || payload.away_team || payload.away || payload.team_away),
    eventName: cleanText(payload.eventName || payload.event_name || payload.name || payload.title),
    startTime: payload.startTime || payload.start_time || payload.commenceTime || payload.commence_time || null,
    selection: cleanText(payload.selection || payload.pick || payload.outcome),
    market: cleanText(payload.market || payload.marketKey || payload.market_key, 80),
    bookmaker: cleanText(payload.bookmaker || payload.bookmakerName || payload.bookmaker_name, 120),
    snapshotOdds: finite(payload.bestOdds ?? payload.best_odds ?? payload.odds)
  };
}

function enrichDailyCards(controlCenter = {}, events = []) {
  const eventMap = new Map(events.map((event) => [event.eventId, event]));
  const dailyTop3 = (controlCenter.dailyTop3 || []).map((pick) => {
    const event = eventMap.get(pick.eventId) || {};
    const bestOdds = finite(pick.bestOdds) ?? finite(event.snapshotOdds);
    return {
      ...pick,
      homeTeam: event.homeTeam || null,
      awayTeam: event.awayTeam || null,
      commenceTime: event.startTime || null,
      sport: event.sport || null,
      league: event.league || null,
      market: event.market || null,
      selection: event.selection || null,
      bookmaker: event.bookmaker || null,
      bestOdds,
      actionableSelection: Boolean(event.selection && bestOdds !== null && bestOdds > 1)
    };
  });
  return { ...controlCenter, dailyTop3 };
}

function groupEvents(records = []) {
  const map = new Map();
  for (const row of records) {
    if (!row.eventId) continue;
    const current = map.get(row.eventId) || { eventId: row.eventId, sport: row.sport, league: row.league, records: [] };
    current.records.push(row);
    if (!current.sport && row.sport) current.sport = row.sport;
    if (!current.league && row.league) current.league = row.league;
    map.set(row.eventId, current);
  }

  return [...map.values()].map((event) => {
    const latest = latestRecord(event.records);
    const sources = new Set(event.records.map((row) => row.sourceId).filter(Boolean));
    const metrics = [...new Set(event.records.map((row) => row.metric).filter(Boolean))].sort();
    return {
      ...event,
      ...eventIdentity(event.records),
      latestAt: latest?.observedAt || null,
      sources: [...sources].sort(),
      metrics
    };
  }).sort((a, b) => new Date(b.latestAt || 0) - new Date(a.latestAt || 0));
}

function settledSamples(records = []) {
  const map = new Map();
  for (const row of records) {
    if (!row.eventId) continue;
    const item = map.get(row.eventId) || {};
    if (row.metric === "model_probability" || (!Number.isFinite(item.probability) && row.metric === "market_probability")) {
      item.probability = Number(row.value);
    }
    if (["result", "event_result", "won"].includes(row.metric)) item.result = Number(row.value);
    map.set(row.eventId, item);
  }
  return [...map.values()].filter((item) => Number.isFinite(item.probability) && [0, 1].includes(item.result));
}

export async function GET(request) {
  const admin = getSupabaseAdmin();
  if (!admin) return json({ ok: false, error: "Production database is not configured" }, 503);

  const url = new URL(request.url);
  const allowed = new Set(["hours", "sport", "limit", "eventId", "view"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return json({ ok: false, error: "Unsupported query parameter" }, 400);
  }

  const hours = clampInt(url.searchParams.get("hours"), 2160, 24, 8760);
  const limit = clampInt(url.searchParams.get("limit"), 10000, 100, 10000);
  const sport = cleanSport(url.searchParams.get("sport"));
  const selectedEventId = cleanEventId(url.searchParams.get("eventId"));
  const view = cleanText(url.searchParams.get("view"), 20).toLowerCase() || "full";
  if (!new Set(["full", "summary"]).has(view)) {
    return json({ ok: false, error: "Unsupported view" }, 400);
  }
  const since = new Date(Date.now() - hours * 3600000).toISOString();

  try {
    let query = admin.from("collector_records")
      .select("source_id,event_id,entity_id,sport,league,metric,value,unit,observed_at,collected_at,confidence,source_trust,payload")
      .eq("publishable", true)
      .gte("collected_at", since)
      .order("observed_at", { ascending: false })
      .limit(limit);
    if (sport) query = query.eq("sport", sport);

    const [{ data, error }, latestRun] = await Promise.all([
      query,
      admin.from("collector_runs")
        .select("status,started_at,completed_at,accepted_count,rejected_count,publishable_count")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);
    if (error) throw error;
    if (latestRun.error) throw latestRun.error;

    const records = (data || []).map((row) => ({
      sourceId: row.source_id,
      eventId: row.event_id,
      entityId: row.entity_id,
      sport: row.sport,
      league: row.league,
      metric: row.metric,
      value: row.value === null ? null : Number(row.value),
      unit: row.unit,
      observedAt: row.observed_at,
      collectedAt: row.collected_at,
      confidence: Number(row.confidence || 0),
      sourceTrust: Number(row.source_trust || 0),
      payload: row.payload || {}
    }));

    const events = groupEvents(records);
    const last = latestRun.data;
    const collectorHealth = last
      ? {
          status: last.status === "failed"
            ? "degraded"
            : Date.now() - new Date(last.started_at).getTime() > 90 * 60000
              ? "stale"
              : "healthy",
          lastRun: last
        }
      : { status: "not-activated", lastRun: null };

    const strictControlCenter = buildProductionControlCenter({
      records,
      settledSamples: settledSamples(records),
      collectorHealth
    });
    const visibleObservations = buildVisibleObservations(events, { now: Date.now(), limit: 12 });
    const visibleControlCenter = withVisibleDailyTop3(strictControlCenter, visibleObservations);
    const controlCenter = enrichDailyCards(visibleControlCenter, events);
    if (view === "summary") {
      const topEventIds = new Set(controlCenter.dailyTop3.map((pick) => pick.eventId));
      const summaryEvents = events
        .filter((event) => topEventIds.has(event.eventId))
        .map(({ records: eventRecords, ...event }) => ({
          ...event,
          recordCount: eventRecords.length,
          explanationAvailable: true,
          transparencyUrl: `/api/transparency?eventId=${encodeURIComponent(event.eventId)}`
        }));
      return json({
        ok: true,
        generatedAt: new Date().toISOString(),
        filters: { hours, sport: sport || null, limit, view },
        collectorHealth,
        controlCenter,
        strictDailyTop3Count: strictControlCenter.dailyTop3?.length || 0,
        fallbackActive: Boolean(controlCenter.fallbackActive),
        events: summaryEvents,
        paperOnly: true
      });
    }
    const intelligenceV4 = buildIntelligenceV4(events, { iterations: 10000, bankroll: 1000 });
    const selected = events.find((event) => event.eventId === selectedEventId) || events[0] || null;
    const intelligenceV3 = selected
      ? buildIntelligenceBundle(selected.records, { eventId: selected.eventId, iterations: 10000, bankroll: 1000 })
      : null;
    const selectedTransparency = selected
      ? buildDecisionTransparency(selected.records, { eventId: selected.eventId }, Date.now())
      : null;

    const sourceRegistry = publicSourceCatalogue();
    const usedSourceIds = [...new Set(records.map((row) => row.sourceId).filter(Boolean))].sort();
    const sourceDetails = usedSourceIds.map((id) => sourceRegistry.find((source) => source.id === id) || {
      id,
      name: id,
      license: "not listed in public registry",
      termsUrl: null,
      redistributionAllowed: false
    });

    const catalogue = {
      sports: [...new Set(records.map((row) => row.sport).filter(Boolean))].sort(),
      leagues: [...new Set(records.map((row) => row.league).filter(Boolean))].sort(),
      sources: usedSourceIds,
      sourceDetails,
      metrics: [...new Set(records.map((row) => row.metric).filter(Boolean))].sort()
    };

    const topPickByEvent = new Map(controlCenter.dailyTop3.map((pick) => [pick.eventId, pick]));
    const publicEvents = events.map(({ records: eventRecords, ...event }) => {
      const pick = topPickByEvent.get(event.eventId);
      return {
        ...event,
        recordCount: eventRecords.length,
        decision: pick?.decision || null,
        rankingScore: pick?.score ?? null,
        quality: pick?.quality ?? null,
        explanationAvailable: true,
        transparencyUrl: `/api/transparency?eventId=${encodeURIComponent(event.eventId)}`
      };
    });

    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      filters: { hours, sport: sport || null, limit },
      collectorHealth,
      controlCenter,
      visibleObservations,
      strictDailyTop3Count: strictControlCenter.dailyTop3?.length || 0,
      fallbackActive: Boolean(controlCenter.fallbackActive),
      intelligenceV4,
      intelligenceV3,
      selectedTransparency,
      selectedEventId: selected?.eventId || null,
      catalogue,
      methodology: OPEN_METHODOLOGY,
      openAccess: {
        formulasPublic: true,
        decisionThresholdsPublic: true,
        normalizedPublishableInputsPublic: true,
        sourceAttributionPublic: true,
        publicApi: "/api/transparency",
        authenticationRequired: false,
        rawLicensedPayloadsPublic: false,
        reasonRawPayloadsAreNotPublic: "Scorecaster cannot redistribute data that a source has not licensed for redistribution, and it never exposes credentials or personal data."
      },
      events: publicEvents,
      records: records.map(publicRecord)
    });
  } catch (error) {
    const text = String(error?.message || error || "").toLowerCase();
    const migrationMissing = text.includes("collector_") && (text.includes("does not exist") || text.includes("schema cache"));
    return json({
      ok: false,
      error: migrationMissing
        ? "Collector migration is not active"
        : process.env.NODE_ENV === "production"
          ? "Scorecaster app data could not be loaded"
          : String(error),
      migrationRequired: migrationMissing ? "supabase/scorecaster_collector_v1.sql" : undefined
    }, migrationMissing ? 503 : 500);
  }
}
