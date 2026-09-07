import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { getCollectorSource, sourceCanCollect } from "../../../../lib/collector-source-registry.mjs";
import { resolveMarketMicrostructureActivation } from "../../../../lib/market-microstructure-activation.mjs";
import { normalizeMarketProviderGames } from "../../../../lib/market-microstructure-v2.mjs";
import { SPORTS } from "../../../../lib/sports.js";
import { GET as getOddsRoute } from "../../odds/route.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const ALLOWED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const ALLOWED_MARKETS = new Set(["h2h", "spreads", "totals"]);
const CORE_DEFAULTS = [
  "icehockey_nhl",
  "basketball_nba",
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one"
];
const SUMMER_DEFAULTS = [
  "baseball_mlb",
  "basketball_wnba",
  "soccer_usa_mls",
  "soccer_finland_veikkausliiga",
  "soccer_sweden_allsvenskan",
  "soccer_norway_eliteserien"
];
const TRANSITION_DEFAULTS = [...new Set([...SUMMER_DEFAULTS, ...CORE_DEFAULTS])];
const WRITE_BATCH_SIZE = 1000;

const response = (body, status = 200) => Response.json(body, { status, headers: HEADERS });
const clean = (value, maximum = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function seasonDefaults(now = new Date()) {
  const month = now.getUTCMonth();
  if (month === 8) return TRANSITION_DEFAULTS;
  return month >= 4 && month <= 7 ? SUMMER_DEFAULTS : CORE_DEFAULTS;
}

function configuredSports() {
  const requested = String(process.env.MARKET_MICROSTRUCTURE_SPORTS || "")
    .split(",")
    .map((value) => clean(value, 100))
    .filter((value) => ALLOWED_SPORTS.has(value));
  return [...new Set(requested.length ? requested : seasonDefaults())].slice(0, 16);
}

function configuredMarkets() {
  const requested = String(process.env.MARKET_MICROSTRUCTURE_MARKETS || "h2h,spreads,totals")
    .split(",")
    .map((value) => clean(value, 40).toLowerCase())
    .filter((value) => ALLOWED_MARKETS.has(value));
  return [...new Set(requested.length ? requested : ["h2h"])].sort().slice(0, 3);
}

function gamesFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["data", "games", "events"]) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}

function keepSupportedMarkets(games = []) {
  return games.map((game) => ({
    ...game,
    bookmakers: (Array.isArray(game?.bookmakers) ? game.bookmakers : []).map((bookmaker) => ({
      ...bookmaker,
      markets: (Array.isArray(bookmaker?.markets) ? bookmaker.markets : []).filter((market) => ALLOWED_MARKETS.has(String(market?.key || "").toLowerCase()))
    }))
  }));
}

function splitCaptureWindow(games = [], capturedAt) {
  const captureMs = Date.parse(capturedAt);
  const preStart = [];
  const ignoredPostStart = [];
  for (const game of Array.isArray(games) ? games : []) {
    const commenceMs = Date.parse(String(game?.commence_time ?? game?.commenceTime ?? ""));
    if (Number.isFinite(captureMs) && Number.isFinite(commenceMs) && captureMs >= commenceMs) {
      ignoredPostStart.push(game);
    } else {
      preStart.push(game);
    }
  }
  return { preStart, ignoredPostStart };
}

async function fetchLeague(request, sport, markets) {
  const target = new URL("/api/odds", request.url);
  target.search = new URLSearchParams({ sport, markets: markets.join(",") }).toString();
  const result = await getOddsRoute(new Request(target, {
    method: "GET",
    headers: { Accept: "application/json", "x-market-microstructure-request": "1" }
  }));
  const payload = await result.json().catch(() => null);
  return {
    sport,
    ok: result.ok && payload?.ok !== false,
    status: result.status,
    mode: payload?.mode || payload?.source || null,
    reason: payload?.reason || payload?.error || null,
    servedMarkets: String(payload?.markets || markets.join(",")),
    games: result.ok ? gamesFromPayload(payload) : []
  };
}

function missingPatch(error) {
  return error?.code === "42P01" || /market_(capture_runs|provider_snapshots)_v2|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

async function createRun(admin, runId, startedAt) {
  const { error } = await admin.from("market_capture_runs_v2").insert({
    id: runId,
    started_at: startedAt,
    status: "running",
    source_id: "the_odds_api",
    paper_only: true
  });
  if (error) throw error;
}

async function finishRun(admin, runId, changes) {
  const { error } = await admin.from("market_capture_runs_v2").update(changes).eq("id", runId);
  if (error) throw error;
}

async function storeRecords(admin, records) {
  const inserted = [];
  for (let index = 0; index < records.length; index += WRITE_BATCH_SIZE) {
    const batch = records.slice(index, index + WRITE_BATCH_SIZE);
    const { data, error } = await admin
      .from("market_provider_snapshots_v2")
      .upsert(batch, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    inserted.push(...(data || []));
  }
  return inserted;
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "CRON_SECRET is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);

  const source = getCollectorSource("the_odds_api");
  const permission = sourceCanCollect(source, { production: process.env.NODE_ENV === "production" });
  if (!permission.allowed) {
    return response({ ok: false, status: "source-blocked", reason: permission.reason, paperOnly: true }, 503);
  }

  const activation = resolveMarketMicrostructureActivation();
  if (!activation.enabled) {
    return response({
      ok: true,
      version: "scorecaster-market-microstructure-worker-v2.2",
      status: "disabled",
      reason: activation.mode,
      activationMode: activation.mode,
      emergencyStopAvailable: activation.emergencyStopAvailable,
      sourceId: "the_odds_api",
      probabilityChanged: false,
      realMoneyExecution: false,
      paperOnly: true
    });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);

  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const sports = configuredSports();
  const markets = configuredMarkets();
  let runCreated = false;

  try {
    await createRun(admin, runId, startedAt);
    runCreated = true;
    const results = await Promise.allSettled(sports.map((sport) => fetchLeague(request, sport, markets)));
    const diagnostics = [];
    const records = [];
    const rejected = [];
    const eventIds = new Set();
    let ignoredPostStartGames = 0;

    for (let index = 0; index < results.length; index += 1) {
      const settled = results[index];
      const sport = sports[index];
      if (settled.status === "rejected") {
        diagnostics.push({ sport, ok: false, reason: "request-rejected" });
        continue;
      }
      const result = settled.value;
      if (!result.ok) {
        diagnostics.push({ sport, ok: false, status: result.status, mode: result.mode, reason: result.reason, servedMarkets: result.servedMarkets, games: result.games.length });
        continue;
      }

      const captureWindow = splitCaptureWindow(result.games, startedAt);
      ignoredPostStartGames += captureWindow.ignoredPostStart.length;
      diagnostics.push({
        sport,
        ok: true,
        status: result.status,
        mode: result.mode,
        reason: result.reason,
        servedMarkets: result.servedMarkets,
        games: result.games.length,
        preStartGames: captureWindow.preStart.length,
        ignoredPostStartGames: captureWindow.ignoredPostStart.length
      });

      const normalized = normalizeMarketProviderGames(keepSupportedMarkets(captureWindow.preStart), {
        capturedAt: startedAt,
        sourceId: "the_odds_api",
        captureId: runId
      });
      records.push(...normalized.records);
      rejected.push(...normalized.rejected.map((item) => ({ sport, ...item })));
      for (const row of normalized.records) eventIds.add(row.event_id);
    }

    const inserted = records.length ? await storeRecords(admin, records) : [];
    const successfulSources = diagnostics.filter((item) => item.ok).length;
    const status = successfulSources === 0 ? "failed" : successfulSources < sports.length || rejected.length ? "partial" : "success";
    const completedAt = new Date().toISOString();
    await finishRun(admin, runId, {
      completed_at: completedAt,
      status,
      league_count: sports.length,
      event_count: eventIds.size,
      record_count: inserted.length,
      rejected_count: rejected.length,
      duplicate_count: Math.max(0, records.length - inserted.length),
      diagnostics: [...diagnostics, ...rejected.slice(0, 100)]
    });

    return response({
      ok: status !== "failed",
      version: "scorecaster-market-microstructure-worker-v2.2",
      runId,
      startedAt,
      completedAt,
      status,
      activationMode: activation.mode,
      emergencyStopAvailable: activation.emergencyStopAvailable,
      sports,
      markets,
      events: eventIds.size,
      normalizedRecords: records.length,
      stored: inserted.length,
      writeBatches: Math.ceil(records.length / WRITE_BATCH_SIZE),
      duplicates: Math.max(0, records.length - inserted.length),
      rejected: rejected.length,
      ignoredPostStartGames,
      diagnostics,
      sourceId: "the_odds_api",
      sourceAttribution: source?.attribution || "Market odds: The Odds API",
      rawPayloadStored: false,
      probabilityChanged: false,
      closingInjectedIntoPrematchModel: false,
      realMoneyExecution: false,
      paperOnly: true
    }, status === "failed" ? 503 : 200);
  } catch (error) {
    if (runCreated) {
      await finishRun(admin, runId, {
        completed_at: new Date().toISOString(),
        status: "failed",
        diagnostics: [{ error: missingPatch(error) ? "production-patch-missing" : "capture-failed" }]
      }).catch(() => null);
    }
    return response({
      ok: false,
      version: "scorecaster-market-microstructure-worker-v2.2",
      error: missingPatch(error)
        ? "Market Microstructure V2 production patch is not active"
        : process.env.NODE_ENV === "production" ? "Market capture failed" : String(error),
      requiredPatch: missingPatch(error) ? "scripts/apply-market-microstructure-v2.sql" : undefined,
      activationMode: activation.mode,
      emergencyStopAvailable: activation.emergencyStopAvailable,
      realMoneyExecution: false,
      paperOnly: true
    }, missingPatch(error) ? 503 : 500);
  }
}
