import {
  cleanText,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  publicError,
  readJsonBody
} from "../../../../lib/api-security";
import {
  buildMarketTimeline,
  currentSnapshotFromPick,
  initialSnapshotFromWatchlist,
  materiallyDifferentSnapshot
} from "../../../../lib/market-timeline.mjs";
import { SPORTS } from "../../../../lib/sports.js";
import { GET as getTopPicks } from "../../top-picks/route.js";

export const dynamic = "force-dynamic";

const SUPPORTED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const WATCHLIST_SELECT = "id,user_id,event_id,sport,league,market,selection,match,added_odds,added_decision,raw_pick,created_at,commence_time,active";
const SNAPSHOT_SELECT = "id,watchlist_id,event_id,sport,league,market,selection,odds,decision,consensus_probability,edge,ev,confidence,bookmaker,source,captured_at";
const MAX_POINTS = 200;
const MIN_REFRESH_MS = 15 * 60 * 1000;

function missingTable(error) {
  return error?.code === "42P01" || /does not exist/i.test(error?.message || "");
}

function sameSelection(pick, eventId, selection) {
  const pickEvent = cleanText(pick?.gameId || pick?.eventId || pick?.id, 180);
  const pickSelection = cleanText(pick?.selection || pick?.label, 160).toLowerCase();
  return pickEvent === eventId && pickSelection === selection.toLowerCase();
}

async function watchlistRow(auth, eventId, selection) {
  const { data, error } = await auth.supabase
    .from("watchlist_items")
    .select(WATCHLIST_SELECT)
    .eq("user_id", auth.user.id)
    .eq("event_id", eventId)
    .eq("selection", selection)
    .maybeSingle();
  return { data, error };
}

async function currentPick(request, sport, eventId, selection) {
  const target = new URL("/api/top-picks", request.url);
  target.searchParams.set("sports", sport);
  const response = await getTopPicks(new Request(target, { method: "GET" }));
  const payload = await response.json();
  if (!response.ok) return { ok: false, status: response.status, error: payload?.error || "Current analysis could not be loaded" };
  const pick = (Array.isArray(payload.data) ? payload.data : []).find((item) => sameSelection(item, eventId, selection));
  return pick
    ? { ok: true, pick }
    : { ok: false, status: 409, error: "The watched selection is not present in the current verified analysis" };
}

async function loadRows(auth, eventId, selection) {
  return auth.supabase
    .from("market_timeline_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("user_id", auth.user.id)
    .eq("event_id", eventId)
    .eq("selection", selection)
    .order("captured_at", { ascending: true })
    .limit(MAX_POINTS);
}

function parseQuery(request) {
  const url = new URL(request.url);
  const unknown = [...url.searchParams.keys()].filter((key) => !["eventId", "selection"].includes(key));
  return {
    unknown,
    eventId: cleanText(url.searchParams.get("eventId"), 180),
    selection: cleanText(url.searchParams.get("selection"), 160)
  };
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);

  const limited = await enforceRateLimit(auth, requestId, { bucket: "market_timeline_read", limit: 60, windowSeconds: 60 });
  if (limited) return limited;

  const query = parseQuery(request);
  if (query.unknown.length || !query.eventId || !query.selection) {
    return jsonResponse({ ok: false, error: "A watched event ID and selection are required" }, 400, requestId);
  }

  const watch = await watchlistRow(auth, query.eventId, query.selection);
  if (watch.error) return jsonResponse({ ok: false, error: publicError(watch.error, "Watchlist item could not be loaded") }, 500, requestId);
  if (!watch.data) return jsonResponse({ ok: false, error: "Add the selection to your watchlist before creating a timeline" }, 404, requestId);

  const snapshots = await loadRows(auth, query.eventId, query.selection);
  if (snapshots.error && missingTable(snapshots.error)) {
    const initial = initialSnapshotFromWatchlist(watch.data);
    return jsonResponse({
      ok: true,
      available: false,
      warning: "Market Timeline storage migration is not active",
      timeline: buildMarketTimeline(initial ? [initial] : [])
    }, 200, requestId);
  }
  if (snapshots.error) return jsonResponse({ ok: false, error: publicError(snapshots.error, "Market timeline could not be loaded") }, 500, requestId);

  const rows = snapshots.data?.length ? snapshots.data : [initialSnapshotFromWatchlist(watch.data)].filter(Boolean);
  return jsonResponse({ ok: true, available: true, timeline: buildMarketTimeline(rows) }, 200, requestId);
}

export async function POST(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);

  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  const limited = await enforceRateLimit(auth, requestId, { bucket: "market_timeline_capture", limit: 20, windowSeconds: 300 });
  if (limited) return limited;

  const body = await readJsonBody(request, 8 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  const eventId = cleanText(body.data?.eventId, 180);
  const selection = cleanText(body.data?.selection, 160);
  const sport = cleanText(body.data?.sport, 120);
  if (!eventId || !selection || !SUPPORTED_SPORTS.has(sport)) {
    return jsonResponse({ ok: false, error: "A supported watched selection is required" }, 400, requestId);
  }

  const watch = await watchlistRow(auth, eventId, selection);
  if (watch.error) return jsonResponse({ ok: false, error: publicError(watch.error, "Watchlist item could not be loaded") }, 500, requestId);
  if (!watch.data || watch.data.sport !== sport) return jsonResponse({ ok: false, error: "Add the verified selection to your watchlist before capturing prices" }, 404, requestId);

  const current = await currentPick(request, sport, eventId, selection);
  if (!current.ok) return jsonResponse({ ok: false, error: current.error }, current.status, requestId);

  const existing = await loadRows(auth, eventId, selection);
  if (existing.error && missingTable(existing.error)) {
    return jsonResponse({ ok: false, available: false, error: "Market Timeline storage migration is not active" }, 503, requestId);
  }
  if (existing.error) return jsonResponse({ ok: false, error: publicError(existing.error, "Market timeline could not be loaded") }, 500, requestId);

  const now = new Date().toISOString();
  const currentRow = currentSnapshotFromPick(current.pick, watch.data, now);
  if (!currentRow) return jsonResponse({ ok: false, error: "The verified analysis is missing a valid current price" }, 409, requestId);

  const rows = existing.data || [];
  const inserts = [];
  if (!rows.length) {
    const initial = initialSnapshotFromWatchlist(watch.data);
    if (initial) inserts.push(initial);
  }
  const latest = rows.at(-1) || inserts.at(-1) || null;
  const latestTime = latest ? Date.parse(latest.captured_at || latest.capturedAt || "") : 0;
  if (!latest || materiallyDifferentSnapshot(latest, currentRow) || Date.now() - latestTime >= MIN_REFRESH_MS) {
    inserts.push(currentRow);
  }

  if (inserts.length) {
    const { error } = await auth.supabase.from("market_timeline_snapshots").insert(inserts);
    if (error) return jsonResponse({ ok: false, error: publicError(error, "Verified price snapshot could not be stored") }, 500, requestId);
  }

  const refreshed = await loadRows(auth, eventId, selection);
  if (refreshed.error) return jsonResponse({ ok: false, error: publicError(refreshed.error, "Market timeline could not be reloaded") }, 500, requestId);
  return jsonResponse({
    ok: true,
    available: true,
    captured: inserts.length,
    duplicateSuppressed: inserts.length === 0,
    timeline: buildMarketTimeline(refreshed.data || [])
  }, 200, requestId);
}
