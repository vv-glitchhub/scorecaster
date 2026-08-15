import { getSupabaseAdmin } from "./supabase-admin.js";

export const UNIFIED_CAPTURE_MARKET_HISTORY_VERSION = "scorecaster-unified-capture-market-history-v1";

const MIN_SNAPSHOTS = 3;
const MIN_SPAN_MINUTES = 30;
const MAX_SNAPSHOTS = 160;

function clean(value, limit = 180) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function odds(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 1.001 && number < 1000 ? number : null;
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function snapshotRows(rows = [], cutoff) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      capturedAt: clean(row?.captured_at, 80),
      capturedAtMs: timestamp(row?.captured_at),
      odds: odds(row?.odds)
    }))
    .filter((row) => row.capturedAtMs !== null && row.odds !== null && row.capturedAtMs < cutoff)
    .sort((left, right) => left.capturedAtMs - right.capturedAtMs)
    .filter((row) => {
      const key = `${row.capturedAt}:${row.odds}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-MAX_SNAPSHOTS);
}

export function buildVerifiedMarketHistory({ pick = {}, rows = [], now = Date.now() } = {}) {
  const eventId = clean(pick.gameId || pick.eventId || pick.id, 180);
  const selection = clean(pick.selection || pick.label, 180);
  const commenceTime = clean(pick.commenceTime || pick.commence_time, 80);
  const kickoff = timestamp(commenceTime);
  const currentOdds = odds(pick.odds);
  const cutoff = Math.min(Number.isFinite(kickoff) ? kickoff : Infinity, now);
  const history = snapshotRows(rows, cutoff);

  if (!eventId || !selection || currentOdds === null || !Number.isFinite(kickoff) || kickoff <= now) {
    return {
      ok: true,
      source: "scorecaster-market-history",
      mode: "not_applicable",
      snapshotCount: history.length,
      openingOdds: null,
      currentOdds,
      spanMinutes: null,
      paperOnly: true
    };
  }

  if (history.length < MIN_SNAPSHOTS) {
    return {
      ok: true,
      source: "scorecaster-market-history",
      mode: "insufficient_history",
      snapshotCount: history.length,
      openingOdds: history[0]?.odds ?? null,
      currentOdds,
      openingCapturedAt: history[0]?.capturedAt ?? null,
      latestHistoricalCapturedAt: history.at(-1)?.capturedAt ?? null,
      spanMinutes: history.length > 1 ? Number(((history.at(-1).capturedAtMs - history[0].capturedAtMs) / 60_000).toFixed(2)) : null,
      paperOnly: true
    };
  }

  const opening = history[0];
  const latest = history.at(-1);
  const spanMinutes = (latest.capturedAtMs - opening.capturedAtMs) / 60_000;
  if (spanMinutes < MIN_SPAN_MINUTES) {
    return {
      ok: true,
      source: "scorecaster-market-history",
      mode: "insufficient_span",
      snapshotCount: history.length,
      openingOdds: opening.odds,
      currentOdds,
      openingCapturedAt: opening.capturedAt,
      latestHistoricalCapturedAt: latest.capturedAt,
      spanMinutes: Number(spanMinutes.toFixed(2)),
      paperOnly: true
    };
  }

  const movementPct = ((currentOdds - opening.odds) / opening.odds) * 100;
  return {
    ok: true,
    source: "scorecaster-market-history",
    mode: "live",
    snapshotCount: history.length,
    openingOdds: opening.odds,
    currentOdds,
    openingCapturedAt: opening.capturedAt,
    latestHistoricalCapturedAt: latest.capturedAt,
    spanMinutes: Number(spanMinutes.toFixed(2)),
    movementPct: Number(movementPct.toFixed(4)),
    chronologySafe: true,
    sameEventSelection: true,
    externalProviderRequestMade: false,
    paperOnly: true
  };
}

export async function loadVerifiedMarketHistory(pick = {}, { now = Date.now(), admin = getSupabaseAdmin() } = {}) {
  const eventId = clean(pick.gameId || pick.eventId || pick.id, 180);
  const selection = clean(pick.selection || pick.label, 180);
  const kickoff = timestamp(pick.commenceTime || pick.commence_time);
  if (!admin || !eventId || !selection || !Number.isFinite(kickoff) || kickoff <= now) {
    return buildVerifiedMarketHistory({ pick, rows: [], now });
  }

  const before = new Date(Math.min(kickoff, now)).toISOString();
  const { data, error } = await admin
    .from("unified_data_snapshots")
    .select("captured_at,odds")
    .eq("event_id", eventId)
    .eq("selection", selection)
    .lt("captured_at", before)
    .order("captured_at", { ascending: true })
    .limit(MAX_SNAPSHOTS);

  if (error) {
    return {
      ok: false,
      source: "scorecaster-market-history",
      mode: "history_query_error",
      snapshotCount: 0,
      openingOdds: null,
      currentOdds: odds(pick.odds),
      externalProviderRequestMade: false,
      paperOnly: true
    };
  }
  return buildVerifiedMarketHistory({ pick, rows: data || [], now });
}

export const UNIFIED_CAPTURE_MARKET_HISTORY_POLICY = Object.freeze({
  minimumSnapshots: MIN_SNAPSHOTS,
  minimumSpanMinutes: MIN_SPAN_MINUTES,
  maximumSnapshots: MAX_SNAPSHOTS,
  requiresPregameFixture: true,
  requiresSameEventSelection: true,
  chronologySafe: true,
  externalProviderRequestMade: false,
  probabilityChanged: false,
  decisionChanged: false,
  stakeChanged: false,
  paperOnly: true
});
