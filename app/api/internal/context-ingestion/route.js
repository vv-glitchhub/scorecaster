import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { fetchContextJsonRecords } from "../../../../lib/context-json-provider";
import { contextProviderConfiguration } from "../../../../lib/context-ingestion.mjs";
import { GET as getTopPicks } from "../../top-picks/route";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

const response = (body, status = 200) => Response.json(body, { status, headers: HEADERS });
const clean = (value, max = 180) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);
const timestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function missingMigration(error) {
  return error?.code === "42P01" || /context_evidence_v1|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

function eventFromPick(pick = {}) {
  const eventId = clean(pick.eventId ?? pick.gameId ?? pick.id);
  const kickoffAt = timestamp(pick.kickoffAt ?? pick.commenceTime ?? pick.commence_time);
  if (!eventId || !kickoffAt) return null;
  const kickoffMs = Date.parse(kickoffAt);
  const now = Date.now();
  if (kickoffMs <= now || kickoffMs > now + 14 * 24 * 60 * 60 * 1000) return null;
  return {
    eventId,
    sport: clean(pick.sport ?? pick.sportKey ?? pick.sport_key, 100) || null,
    league: clean(pick.league ?? pick.leagueTitle ?? pick.sportTitle ?? pick.sport_title, 140) || null,
    homeTeam: clean(pick.homeTeam ?? pick.home_team, 140) || null,
    awayTeam: clean(pick.awayTeam ?? pick.away_team, 140) || null,
    kickoffAt
  };
}

function uniqueEvents(picks = []) {
  const events = new Map();
  for (const pick of Array.isArray(picks) ? picks : []) {
    const event = eventFromPick(pick);
    if (event) events.set(event.eventId, event);
  }
  return [...events.values()].slice(0, 250);
}

async function loadUpcomingEvents(request) {
  const url = new URL("/api/top-picks", request.url);
  const topPicksResponse = await getTopPicks(new Request(url, { method: "GET" }));
  const payload = await topPicksResponse.json().catch(() => null);
  if (!topPicksResponse.ok || payload?.ok === false) {
    return { ok: false, status: topPicksResponse.status, error: payload?.error || "top-picks-unavailable", events: [] };
  }
  const picks = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.picks)
      ? payload.picks
      : Array.isArray(payload)
        ? payload
        : [];
  return { ok: true, status: topPicksResponse.status, events: uniqueEvents(picks) };
}

async function existingEvidence(admin, eventIds) {
  if (!eventIds.length) return [];
  const { data, error } = await admin
    .from("context_evidence_v1")
    .select("id,event_id,source_id,source_reference")
    .in("event_id", eventIds.slice(0, 250))
    .not("source_reference", "is", null)
    .limit(10_000);
  if (error) throw error;
  return data || [];
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "Context worker secret is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);

  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);

  const startedAt = new Date().toISOString();
  try {
    const fixtureState = await loadUpcomingEvents(request);
    if (!fixtureState.ok) {
      return response({
        ok: false,
        version: "scorecaster-context-worker-v1",
        status: "fixture-source-unavailable",
        fixtureStatus: fixtureState.status,
        error: fixtureState.error,
        paperOnly: true
      }, 503);
    }

    const events = fixtureState.events;
    const provider = await fetchContextJsonRecords(events, { timeoutMs: 30_000 });
    const accepted = provider.normalized?.accepted || [];
    const existing = await existingEvidence(admin, events.map((event) => event.eventId));
    const existingByReference = new Map(existing.map((row) => [`${row.source_id}:${row.source_reference}`, row]));
    const rows = [];
    let duplicates = 0;

    for (const item of accepted) {
      const key = `${item.row.source_id}:${item.sourceReference}`;
      if (existingByReference.has(key)) {
        duplicates += 1;
        continue;
      }
      const superseded = item.supersedesSourceReference
        ? existingByReference.get(`${item.row.source_id}:${item.supersedesSourceReference}`)
        : null;
      rows.push({
        ...item.row,
        ...(superseded?.id ? { supersedes_id: superseded.id } : {})
      });
    }

    let inserted = [];
    if (rows.length) {
      const { data, error } = await admin
        .from("context_evidence_v1")
        .upsert(rows.slice(0, 2000), { onConflict: "id", ignoreDuplicates: true })
        .select("id,event_id,source_id,source_reference");
      if (error) throw error;
      inserted = data || [];
    }

    const completedAt = new Date().toISOString();
    return response({
      ok: provider.ok !== false,
      version: "scorecaster-context-worker-v1",
      startedAt,
      completedAt,
      status: provider.mode,
      eventsRequested: events.length,
      providerRecordsReceived: Number(provider.received || provider.normalized?.received || 0),
      accepted: accepted.length,
      rejected: provider.normalized?.rejected?.length || 0,
      duplicates,
      stored: inserted.length,
      sourceId: provider.sourceId,
      provider: provider.configuration || contextProviderConfiguration(),
      probabilityChanged: false,
      rawPayloadStored: false,
      realMoneyExecution: false,
      paperOnly: true
    }, provider.ok === false ? 503 : 200);
  } catch (error) {
    return response({
      ok: false,
      version: "scorecaster-context-worker-v1",
      error: missingMigration(error)
        ? "Context Engine production patch is not active"
        : process.env.NODE_ENV === "production" ? "Context ingestion failed" : String(error),
      requiredPatch: missingMigration(error) ? "scripts/apply-context-engine-v1.sql" : undefined,
      paperOnly: true
    }, missingMigration(error) ? 503 : 500);
  }
}
