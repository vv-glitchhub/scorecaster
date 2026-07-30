import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { collectorRegistrySummary } from "../../../../lib/collector-source-registry.mjs";
import {
  normalizeCollectorBatch,
  scorecasterPicksToCollectorRecords,
} from "../../../../lib/collector-normalize.mjs";
import {
  collectorJsonProviderConfiguration,
  fetchCollectorJsonRecords,
} from "../../../../lib/collector-json-provider";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const FALLBACK_LEAGUES = [
  "baseball_mlb",
  "basketball_wnba",
  "soccer_usa_mls",
  "soccer_finland_veikkausliiga",
  "soccer_sweden_allsvenskan",
  "soccer_norway_eliteserien",
];

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: HEADERS });
}

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function migrationMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("collector_") && (text.includes("does not exist") || text.includes("schema cache"));
}

function mergeRecords(groups = []) {
  const rows = new Map();
  for (const group of groups) {
    for (const record of Array.isArray(group) ? group : []) rows.set(record.fingerprint, record);
  }
  return [...rows.values()].slice(0, 10_000);
}

function gamesFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.games)) return payload.games;
  if (Array.isArray(payload?.events)) return payload.events;
  return [];
}

async function collectFixtureSnapshots(origin, collectedAt) {
  const rows = [];
  const diagnostics = [];

  for (const league of FALLBACK_LEAGUES) {
    try {
      const oddsResponse = await fetch(
        `${origin}/api/odds?sport=${encodeURIComponent(league)}&markets=h2h`,
        { cache: "no-store", signal: AbortSignal.timeout(15_000) }
      );
      const payload = await oddsResponse.json().catch(() => null);
      const games = oddsResponse.ok && payload?.ok !== false ? gamesFromPayload(payload) : [];

      diagnostics.push({
        league,
        ok: oddsResponse.ok && payload?.ok !== false,
        status: oddsResponse.status,
        games: games.length,
      });

      for (const game of games.slice(0, 30)) {
        const eventId = game?.id || game?.gameId || game?.eventId;
        if (!eventId) continue;

        rows.push({
          eventId,
          sport: game?.sport_key || game?.sportKey || league,
          league: game?.sport_title || game?.sportTitle || league,
          observedAt: game?.last_update || game?.lastUpdate || collectedAt,
          metric: "fixture_snapshot",
          confidence: 0.75,
          sourceTrust: 0.9,
          payload: {
            homeTeam: game?.home_team || game?.homeTeam || null,
            awayTeam: game?.away_team || game?.awayTeam || null,
            commenceTime: game?.commence_time || game?.commenceTime || null,
            bookmakerCount: Array.isArray(game?.bookmakers) ? game.bookmakers.length : 0,
            market: "h2h",
            fallbackObservation: true,
          },
        });
      }
    } catch (error) {
      diagnostics.push({ league, ok: false, error: String(error) });
    }
  }

  return {
    normalized: normalizeCollectorBatch(rows, {
      sourceId: "scorecaster_internal",
      collectedAt,
    }),
    diagnostics,
  };
}

async function createRun(admin, startedAt) {
  const { data, error } = await admin
    .from("collector_runs")
    .insert({ started_at: startedAt, status: "running", trigger_type: "scheduled", paper_only: true })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function finishRun(admin, runId, payload) {
  const { error } = await admin.from("collector_runs").update(payload).eq("id", runId);
  if (error) throw error;
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "Collector cron secret is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);

  const startedAt = new Date().toISOString();
  let runId = null;
  try {
    runId = await createRun(admin, startedAt);
    const origin = new URL(request.url).origin;
    const sourceStatus = [];
    const errors = [];
    let internal = { records: [], received: 0, accepted: 0, rejectedCount: 0, publishable: 0, researchOnly: 0 };
    let eventIds = [];
    let sports = [];

    try {
      const topPicksResponse = await fetch(`${origin}/api/top-picks`, {
        cache: "no-store",
        signal: AbortSignal.timeout(75_000),
      });
      const topPicks = await topPicksResponse.json().catch(() => null);
      if (!topPicksResponse.ok || topPicks?.ok === false) {
        throw new Error(topPicks?.error || topPicks?.reason || "Top Picks unavailable");
      }

      const picks = Array.isArray(topPicks?.data) ? topPicks.data : [];
      internal = scorecasterPicksToCollectorRecords(picks, startedAt);

      if (!internal.records.length) {
        const fallback = await collectFixtureSnapshots(origin, startedAt);
        internal = fallback.normalized;
        console.log("[collector] Top Picks empty; fixture fallback used", {
          records: internal.records.length,
          diagnostics: fallback.diagnostics,
        });
      }

      eventIds = [...new Set(internal.records.map((record) => record.event_id))];
      sports = [...new Set(internal.records.map((record) => record.sport))];
      sourceStatus.push({
        sourceId: "scorecaster_internal",
        mode: internal.records.length ? "live" : "live-empty",
        ok: true,
        records: internal.records.length,
      });
    } catch (error) {
      errors.push({ sourceId: "scorecaster_internal", error: "internal-source-unavailable" });
      sourceStatus.push({ sourceId: "scorecaster_internal", mode: "error", ok: false, records: 0 });
      console.error("[collector] Internal source failed", error);
    }

    const external = await fetchCollectorJsonRecords({
      eventIds,
      sports,
      since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });
    sourceStatus.push({
      sourceId: external.source,
      mode: external.mode,
      ok: external.ok,
      records: Array.isArray(external.records) ? external.records.length : 0,
      reason: external.reason || null,
    });
    if (!external.ok) errors.push({ sourceId: external.source, error: external.reason || "external-source-failed" });

    const records = mergeRecords([internal.records, external.records]);
    if (records.length) {
      const rows = records.map((record) => ({ ...record, run_id: runId }));
      const { error } = await admin
        .from("collector_records")
        .upsert(rows, { onConflict: "fingerprint", ignoreDuplicates: true });
      if (error) throw error;
    }

    const received = Number(internal.received || 0) + Number(external.received || 0);
    const rejected = Number(internal.rejectedCount || 0) + Number(external.rejectedCount || 0);
    const publishable = records.filter((record) => record.publishable).length;
    const researchOnly = records.length - publishable;
    const status = errors.length ? (records.length ? "partial" : "failed") : "success";
    const completedAt = new Date().toISOString();

    await finishRun(admin, runId, {
      completed_at: completedAt,
      status,
      source_count: sourceStatus.length,
      received_count: received,
      accepted_count: records.length,
      rejected_count: rejected,
      publishable_count: publishable,
      research_only_count: researchOnly,
      source_status: sourceStatus,
      errors,
      paper_only: true,
    });

    return response(
      {
        ok: status !== "failed",
        version: "scorecaster-collector-v2",
        runId,
        startedAt,
        completedAt,
        status,
        recordsStored: records.length,
        publishable,
        researchOnly,
        rejected,
        sources: sourceStatus,
        registry: collectorRegistrySummary(),
        genericProvider: collectorJsonProviderConfiguration(),
        probabilityChanged: false,
        paperOnly: true,
      },
      status === "failed" ? 503 : 200
    );
  } catch (error) {
    if (runId) {
      await finishRun(admin, runId, {
        completed_at: new Date().toISOString(),
        status: "failed",
        errors: [{ error: migrationMissing(error) ? "migration-not-active" : "collector-failed" }],
      }).catch(() => null);
    }
    return response(
      {
        ok: false,
        error: migrationMissing(error)
          ? "Collector migration is not active"
          : process.env.NODE_ENV === "production"
            ? "Collector capture failed"
            : String(error),
        migrationRequired: migrationMissing(error) ? "supabase/scorecaster_collector_v1.sql" : undefined,
      },
      migrationMissing(error) ? 503 : 500
    );
  }
}
