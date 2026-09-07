import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { GET as runCollectorRoute } from "../collector/route";
import { GET as runSportsAnalyticsRoute } from "../sports-analytics/route";
import { GET as runIntelligenceCoreRoute } from "../intelligence-core/route";
import { GET as getTopPicksRoute } from "../../top-picks/route";
import {
  SELF_DATA_ENGINE_VERSION,
  buildPointInTimeFeatureSnapshot,
  buildAutonomousDecision,
} from "../../../../lib/self-data-engine-v1.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const response = (payload, status = 200) => Response.json(payload, { status, headers: HEADERS });
const authorized = (request) => Boolean(process.env.CRON_SECRET) && request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
const clean = (value, limit = 180) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const iso = (value) => {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
};

function eventId(pick = {}) {
  return clean(pick.gameId || pick.eventId || pick.id, 180);
}

async function payloadFromResponse(routeResponse) {
  const text = await routeResponse.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 1000) }; }
}

async function runInternal(route, request) {
  try {
    const result = await route(request);
    const payload = await payloadFromResponse(result);
    return { ok: result.ok && payload?.ok !== false, status: result.status, payload };
  } catch (error) {
    return { ok: false, status: 500, payload: { error: error instanceof Error ? error.message : String(error) } };
  }
}

async function createRun(admin, startedAt) {
  const { data, error } = await admin
    .from("scorecaster_data_engine_runs_v1")
    .insert({ started_at: startedAt, status: "running", trigger_type: "scheduled", paper_only: true })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function finishRun(admin, runId, patch) {
  const { error } = await admin.from("scorecaster_data_engine_runs_v1").update(patch).eq("id", runId);
  if (error) throw error;
}

async function fetchTopPicks(origin) {
  const req = new Request(`${origin}/api/top-picks`, { method: "GET", headers: { Accept: "application/json" } });
  const res = await getTopPicksRoute(req);
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.ok === false) throw new Error(payload?.error || payload?.reason || "Top Picks unavailable");
  return { payload, picks: Array.isArray(payload?.data) ? payload.data : [] };
}

function newestFirst(left, right) {
  return Date.parse(right.observed_at || right.collected_at || 0) - Date.parse(left.observed_at || left.collected_at || 0);
}

function payloadValue(payload = {}, ...keys) {
  for (const key of keys) {
    if (payload?.[key] !== undefined && payload?.[key] !== null && payload?.[key] !== "") return payload[key];
  }
  return null;
}

function collectorGroupToPick(eventRows = [], now = Date.now()) {
  const rows = [...eventRows].sort(newestFirst);
  const identity = rows.find((row) => ["fixture_snapshot", "event_snapshot"].includes(row.metric) && row.payload) || rows[0];
  if (!identity?.event_id) return null;

  const identityPayload = identity.payload || {};
  const commenceTime = iso(payloadValue(identityPayload, "commenceTime", "commence_time", "startTime", "start_time"));
  if (!commenceTime || Date.parse(commenceTime) <= now) return null;

  const priceRow = rows.find((row) => row.metric === "best_odds") || rows.find((row) => finite(payloadValue(row.payload, "bestOdds", "best_odds", "odds", "price")) > 1);
  const probabilityRow = rows.find((row) => row.metric === "market_probability");
  const decisionRow = rows.find((row) => row.metric === "event_snapshot") || identity;
  const pricePayload = priceRow?.payload || {};
  const probabilityPayload = probabilityRow?.payload || {};
  const decisionPayload = decisionRow?.payload || {};

  const bestOdds = finite(priceRow?.value) ?? finite(payloadValue(pricePayload, "bestOdds", "best_odds", "odds", "price"));
  const marketProbability = finite(probabilityRow?.value) ?? finite(payloadValue(probabilityPayload, "marketProbability", "market_probability", "probability", "noVigProbability"));
  const selection = clean(
    payloadValue(pricePayload, "selection", "pick", "outcome") ||
    payloadValue(decisionPayload, "selection", "pick", "outcome"),
    180
  );
  const bookmakerCount = finite(payloadValue(identityPayload, "bookmakerCount", "bookmakersCount"));
  const confidence = finite(identity.confidence) ?? finite(payloadValue(decisionPayload, "confidence"));

  return {
    id: clean(identity.event_id, 180),
    eventId: clean(identity.event_id, 180),
    gameId: clean(identity.event_id, 180),
    homeTeam: clean(payloadValue(identityPayload, "homeTeam", "home_team", "home"), 140),
    awayTeam: clean(payloadValue(identityPayload, "awayTeam", "away_team", "away"), 140),
    commenceTime,
    sportKey: clean(identity.sport, 120),
    sport: clean(identity.sport, 120),
    league: clean(identity.league, 140),
    leagueTitle: clean(identity.league, 140),
    selection: selection || null,
    marketKey: clean(payloadValue(pricePayload, "market", "marketKey", "market_key") || payloadValue(identityPayload, "market") || "h2h", 80),
    odds: bestOdds,
    marketProbability,
    confidence,
    bookmakerCount,
    edge: finite(payloadValue(decisionPayload, "edge")),
    ev: finite(payloadValue(decisionPayload, "ev", "expectedValue")),
    decision: "CAUTION",
    productDecision: "CAUTION",
    fixtureSource: "collector-fixture-snapshot",
    fixtureVerifiedByProvider: true,
    paperOnly: true,
  };
}

async function loadCollectorEventCandidates(admin, collectorRunId, now = Date.now()) {
  if (!collectorRunId) return [];
  const { data, error } = await admin
    .from("collector_records")
    .select("run_id,event_id,sport,league,metric,value,observed_at,collected_at,confidence,payload")
    .eq("run_id", collectorRunId)
    .not("event_id", "is", null)
    .in("metric", ["fixture_snapshot", "event_snapshot", "best_odds", "market_probability"])
    .order("observed_at", { ascending: false })
    .limit(10000);
  if (error) throw error;

  const groups = new Map();
  for (const row of data || []) {
    const id = clean(row.event_id, 180);
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }

  return [...groups.values()]
    .map((rows) => collectorGroupToPick(rows, now))
    .filter(Boolean)
    .sort((left, right) => Date.parse(left.commenceTime) - Date.parse(right.commenceTime))
    .slice(0, 80);
}

async function loadPointInTimeRows(admin, eventIds, asOf) {
  if (!eventIds.length) return { collectorRows: [], observationRows: [] };

  const [collectorResult, analyticsResult] = await Promise.all([
    admin
      .from("collector_records")
      .select("event_id,entity_id,source_id,metric,value,observed_at,collected_at,commercial_use_allowed,publishable,payload")
      .in("event_id", eventIds)
      .lte("observed_at", asOf)
      .lte("collected_at", asOf)
      .order("observed_at", { ascending: false })
      .limit(10000),
    admin
      .from("sports_analytics_observations")
      .select("event_id,participant_id,family,metric,value,unit,observed_at,captured_at,provider,source_trust,confidence,metadata")
      .in("event_id", eventIds)
      .lte("observed_at", asOf)
      .lte("captured_at", asOf)
      .order("observed_at", { ascending: false })
      .limit(10000),
  ]);

  if (collectorResult.error) throw collectorResult.error;
  if (analyticsResult.error) throw analyticsResult.error;
  return {
    collectorRows: Array.isArray(collectorResult.data) ? collectorResult.data : [],
    observationRows: Array.isArray(analyticsResult.data) ? analyticsResult.data : [],
  };
}

async function storeFeatureAndDecision(admin, { pick, collectorRows, observationRows, runId, asOf }) {
  const feature = buildPointInTimeFeatureSnapshot({ pick, collectorRows, observationRows, runId, asOf });
  if (!feature.event_id || !feature.commence_time) return null;

  const { data: storedFeature, error: featureError } = await admin
    .from("scorecaster_pit_feature_snapshots_v1")
    .upsert(feature, { onConflict: "event_id,as_of_bucket,feature_schema_version" })
    .select("id,event_id,input_hash,eligible_for_model,leakage_guard_passed,data_quality,as_of_bucket")
    .single();
  if (featureError) throw featureError;

  const decision = buildAutonomousDecision({
    pick,
    featureSnapshot: { ...feature, ...storedFeature },
    featureSnapshotId: storedFeature.id,
    runId,
    asOf,
  });

  const { data: storedDecision, error: decisionError } = await admin
    .from("scorecaster_autonomous_decisions_v1")
    .upsert(decision, { onConflict: "decision_hash" })
    .select("id,event_id,decision,selection,reason_codes,decision_hash")
    .single();
  if (decisionError) throw decisionError;

  return {
    eventId: storedFeature.event_id,
    featureSnapshotId: storedFeature.id,
    inputHash: storedFeature.input_hash,
    eligibleForModel: storedFeature.eligible_for_model,
    leakageGuardPassed: storedFeature.leakage_guard_passed,
    dataQuality: storedFeature.data_quality,
    decision: storedDecision.decision,
    selection: storedDecision.selection,
    reasons: storedDecision.reason_codes,
  };
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "CRON_SECRET is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);

  const startedAt = new Date().toISOString();
  let runId = null;
  try {
    runId = await createRun(admin, startedAt);
    const origin = new URL(request.url).origin;
    const errors = [];

    const collector = await runInternal(runCollectorRoute, request);
    if (!collector.ok) errors.push({ stage: "collector", error: collector.payload?.error || `HTTP ${collector.status}` });

    const analytics = await runInternal(runSportsAnalyticsRoute, request);
    if (!analytics.ok) errors.push({ stage: "sports-analytics", error: analytics.payload?.error || `HTTP ${analytics.status}` });

    let topPicksPayload = null;
    let topPicks = [];
    try {
      const topPicksResult = await fetchTopPicks(origin);
      topPicksPayload = topPicksResult.payload;
      topPicks = topPicksResult.picks;
    } catch (error) {
      errors.push({ stage: "recommendation-feed", error: error instanceof Error ? error.message : String(error) });
    }

    let collectorCandidates = [];
    try {
      collectorCandidates = await loadCollectorEventCandidates(admin, collector.payload?.runId, Date.parse(startedAt));
    } catch (error) {
      errors.push({ stage: "collector-candidate-load", error: error instanceof Error ? error.message : String(error) });
    }

    const unique = new Map();
    for (const pick of [...topPicks, ...collectorCandidates]) {
      const id = eventId(pick);
      if (id && !unique.has(id)) unique.set(id, pick);
      if (unique.size >= 60) break;
    }
    const eventPicks = [...unique.values()];
    const eventIds = eventPicks.map(eventId);
    const rows = await loadPointInTimeRows(admin, eventIds, startedAt);

    const settled = await Promise.allSettled(eventPicks.map((pick) => storeFeatureAndDecision(admin, {
      pick,
      collectorRows: rows.collectorRows,
      observationRows: rows.observationRows,
      runId,
      asOf: startedAt,
    })));

    const stored = settled.filter((item) => item.status === "fulfilled" && item.value).map((item) => item.value);
    for (const item of settled) {
      if (item.status === "rejected") errors.push({ stage: "feature-decision", error: item.reason instanceof Error ? item.reason.message : String(item.reason) });
    }

    const intelligence = await runInternal(runIntelligenceCoreRoute, request);
    if (!intelligence.ok) errors.push({ stage: "intelligence-core", error: intelligence.payload?.error || `HTTP ${intelligence.status}` });

    const idle = eventPicks.length === 0;
    const status = idle
      ? (errors.length ? "partial" : "success")
      : stored.length === 0
        ? "failed"
        : errors.length
          ? "partial"
          : "success";
    const completedAt = new Date().toISOString();
    const sourceStatus = {
      collector: { ok: collector.ok, status: collector.status, runId: collector.payload?.runId || null, recordsStored: collector.payload?.recordsStored || 0 },
      sportsAnalytics: { ok: analytics.ok, status: analytics.status, eventsStored: analytics.payload?.eventsStored || 0, observationsStored: analytics.payload?.observationsStored || 0 },
      recommendationFeed: {
        ok: topPicksPayload?.ok === true,
        version: topPicksPayload?.version || null,
        topPickEvents: new Set(topPicks.map(eventId).filter(Boolean)).size,
        collectorFixtureEvents: collectorCandidates.length,
        materializationCandidates: eventPicks.length,
      },
      intelligenceCore: {
        ok: intelligence.ok,
        status: intelligence.status,
        version: intelligence.payload?.version || null,
        canonicalFactsPrepared: intelligence.payload?.canonicalFactsPrepared || 0,
        finalOutcomesAvailable: intelligence.payload?.finalOutcomesAvailable || 0,
        teamStatesMaterialized: intelligence.payload?.teamStatesMaterialized || 0,
        predictionsPrepared: intelligence.payload?.predictionsPrepared || 0,
        learningExamplesPrepared: intelligence.payload?.learningExamplesPrepared || 0,
        trainingEligiblePrepared: intelligence.payload?.trainingEligiblePrepared || 0,
      },
    };

    await finishRun(admin, runId, {
      completed_at: completedAt,
      status,
      collector_run_id: collector.payload?.runId || null,
      events_seen: eventPicks.length,
      feature_snapshots: stored.length,
      decisions_written: stored.length,
      source_status: sourceStatus,
      errors,
      paper_only: true,
    });

    return response({
      ok: status !== "failed",
      version: `${SELF_DATA_ENGINE_VERSION}-learning-repair-v1`,
      runId,
      startedAt,
      completedAt,
      status,
      idle,
      eventsSeen: eventPicks.length,
      topPickEvents: new Set(topPicks.map(eventId).filter(Boolean)).size,
      collectorFixtureEvents: collectorCandidates.length,
      featureSnapshots: stored.length,
      decisionsWritten: stored.length,
      eligibleForModel: stored.filter((item) => item.eligibleForModel).length,
      leakageGuardPassed: stored.filter((item) => item.leakageGuardPassed).length,
      decisions: {
        PLAY: stored.filter((item) => item.decision === "PLAY").length,
        CAUTION: stored.filter((item) => item.decision === "CAUTION").length,
        SKIP: stored.filter((item) => item.decision === "SKIP").length,
      },
      intelligence: intelligence.payload || null,
      sources: sourceStatus,
      errors,
      sample: stored.slice(0, 5),
      autonomousCollection: true,
      pointInTimeFeatures: true,
      learnsFromCollectorFixturesWhenRecommendationsAreEmpty: true,
      ownIntelligenceCore: true,
      automaticUpgradeBySelfDataLayer: false,
      productionProbabilityChanged: false,
      realMoneyActionAvailable: false,
      paperOnly: true,
    }, status === "failed" ? 503 : 200);
  } catch (error) {
    if (runId) {
      await finishRun(admin, runId, {
        completed_at: new Date().toISOString(),
        status: "failed",
        errors: [{ stage: "fatal", error: error instanceof Error ? error.message : String(error) }],
      }).catch(() => null);
    }
    return response({ ok: false, version: SELF_DATA_ENGINE_VERSION, error: process.env.NODE_ENV === "production" ? "Self data engine failed" : String(error), paperOnly: true }, 500);
  }
}
