import { getSupabaseAdmin } from "./supabase-admin";

const TABLE_NAME = "closing_line_history";
const memoryClosingLines = [];

export async function saveClosingLineSnapshot(snapshot = {}) {
  const record = normalizeSnapshot(snapshot);
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    memoryClosingLines.unshift(record);
    return { ok: true, mode: "memory", record };
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(record)
    .select("*")
    .single();

  if (error) {
    memoryClosingLines.unshift(record);
    return { ok: false, mode: "fallback_memory", error: error.message, record };
  }

  return { ok: true, mode: "supabase", record: data };
}

export async function loadClosingLineHistory({ limit = 500, gameId = null, sportKey = null } = {}) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return filterMemory({ limit, gameId, sportKey });
  }

  let query = supabase
    .from(TABLE_NAME)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (gameId) query = query.eq("game_id", gameId);
  if (sportKey) query = query.eq("sport_key", sportKey);

  const { data, error } = await query;

  if (error) {
    return {
      ok: false,
      mode: "fallback_memory",
      error: error.message,
      records: filterMemory({ limit, gameId, sportKey }).records
    };
  }

  return { ok: true, mode: "supabase", records: data || [] };
}

export function summarizeClosingLineHistory(records = []) {
  const safe = Array.isArray(records) ? records : [];
  const withClosing = safe.filter((item) => Number(item.closing_odds || item.closingOdds || 0) > 1);
  const movements = safe.map((item) => calculateMovement(item));
  const averageMovement = average(movements);
  const positiveCount = movements.filter((value) => value > 0).length;

  return {
    count: safe.length,
    withClosing: withClosing.length,
    averageMovement,
    positiveMovementRate: movements.length ? positiveCount / movements.length : 0,
    biggestMoves: safe
      .map((item) => ({ ...item, movement: calculateMovement(item) }))
      .sort((a, b) => Math.abs(b.movement) - Math.abs(a.movement))
      .slice(0, 10)
  };
}

function normalizeSnapshot(snapshot) {
  const openingOdds = Number(snapshot.openingOdds || snapshot.opening_odds || 0);
  const currentOdds = Number(snapshot.currentOdds || snapshot.current_odds || snapshot.odds || 0);
  const closingOdds = Number(snapshot.closingOdds || snapshot.closing_odds || 0);

  return {
    created_at: new Date().toISOString(),
    game_id: snapshot.gameId || snapshot.game_id || snapshot.id || null,
    sport_key: snapshot.sportKey || snapshot.sport_key || null,
    league: snapshot.league || snapshot.leagueTitle || snapshot.sportTitle || null,
    market_key: snapshot.marketKey || snapshot.market_key || snapshot.market || null,
    selection: snapshot.selection || null,
    bookmaker: snapshot.bookmaker || null,
    opening_odds: openingOdds || null,
    current_odds: currentOdds || null,
    closing_odds: closingOdds || null,
    movement: calculateMovement({ openingOdds, currentOdds, closingOdds }),
    raw_payload: snapshot
  };
}

function calculateMovement(item = {}) {
  const opening = Number(item.opening_odds || item.openingOdds || 0);
  const current = Number(item.closing_odds || item.closingOdds || item.current_odds || item.currentOdds || 0);

  if (!opening || !current || opening <= 1 || current <= 1) return 0;
  return (current - opening) / opening;
}

function filterMemory({ limit, gameId, sportKey }) {
  const records = memoryClosingLines
    .filter((item) => !gameId || item.game_id === gameId)
    .filter((item) => !sportKey || item.sport_key === sportKey)
    .slice(0, limit);

  return { ok: true, mode: "memory", records };
}

function average(values = []) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}
