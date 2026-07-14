import {
  boundedNumber,
  cleanText,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  publicError,
  readJsonBody
} from "../../../../lib/api-security";

export const dynamic = "force-dynamic";

const BET_SELECT =
  "id,client_ref,label,match,market,bookmaker,sport,league,home_team,away_team,odds,stake,edge,ev,confidence,status,result,profit,closing_odds,clv,created_at,updated_at";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = new Set(["open", "won", "lost", "void", "push"]);

function safeRawPick(bet) {
  return {
    source: cleanText(bet?.source, 60, "manual"),
    eventId: cleanText(bet?.eventId || bet?.event_id, 180),
    modelProbability: boundedNumber(bet?.modelProbability ?? bet?.model_probability, {
      min: 0,
      max: 1
    }),
    impliedProbability: boundedNumber(bet?.impliedProbability ?? bet?.implied_probability, {
      min: 0,
      max: 1
    }),
    decision: cleanText(bet?.decision, 20),
    qualityGrade: cleanText(bet?.qualityGrade, 8),
    qualityScore: boundedNumber(bet?.qualityScore, { min: 0, max: 100 })
  };
}

function normalizeBet(bet, userId, index) {
  const match = cleanText(bet?.match, 240);
  const selection = cleanText(bet?.selection || bet?.label, 160);
  const odds = boundedNumber(bet?.odds, { min: 1.001, max: 10000 });

  if (!match || !selection || odds === null) return null;

  const clientRef = cleanText(
    bet?.id || bet?.client_ref || `${match}-${selection}-${odds}-${index}`,
    240
  );

  if (!clientRef) return null;

  return {
    user_id: userId,
    client_ref: clientRef,
    label: selection,
    match,
    market: cleanText(bet?.market, 80, "h2h"),
    bookmaker: cleanText(bet?.bookmaker, 120, "manual"),
    sport: cleanText(bet?.sport, 120, "manual"),
    league: cleanText(bet?.league, 120, "manual"),
    home_team: cleanText(bet?.home_team, 160),
    away_team: cleanText(bet?.away_team, 160),
    odds,
    stake: boundedNumber(bet?.stake, { min: 0, max: 10000000, fallback: 0 }),
    edge: boundedNumber(bet?.edge, { min: -1, max: 1 }),
    ev: boundedNumber(bet?.ev, { min: -10, max: 100 }),
    confidence: boundedNumber(bet?.confidence, { min: 0, max: 1 }),
    status: "open",
    raw_pick: safeRawPick(bet)
  };
}

function calculateSettlement({ status, odds, stake, closingOdds }) {
  let profit = null;
  if (status === "won") profit = stake * (odds - 1);
  if (status === "lost") profit = -stake;
  if (status === "void" || status === "push") profit = 0;

  const clv = closingOdds && closingOdds > 1
    ? ((odds / closingOdds) - 1) * 100
    : null;

  return {
    profit: profit === null ? null : Number(profit.toFixed(4)),
    clv: clv === null ? null : Number(clv.toFixed(4))
  };
}

async function requireAuth(request, requestId) {
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) {
    return { error: jsonResponse({ ok: false, error: auth.error }, auth.status, requestId) };
  }
  return auth;
}

function rejectUnsafeMutation(request, requestId) {
  if (mutationOriginAllowed(request)) return null;
  return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "cloud_bets_read",
    limit: 120,
    windowSeconds: 60
  });
  if (limited) return limited;

  const { data, error } = await auth.supabase
    .from("bets")
    .select(BET_SELECT)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return jsonResponse(
      { ok: false, error: publicError(error, "Cloud history could not be loaded") },
      500,
      requestId
    );
  }

  return jsonResponse({ ok: true, count: data?.length || 0, data: data || [] }, 200, requestId);
}

export async function POST(request) {
  const requestId = getRequestId(request);
  const unsafe = rejectUnsafeMutation(request, requestId);
  if (unsafe) return unsafe;

  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "cloud_bets_create",
    limit: 30,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 96 * 1024);
  if (!body.ok) {
    return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  }

  const sourceBets = Array.isArray(body.data?.bets) ? body.data.bets.slice(0, 50) : [];
  const rows = sourceBets
    .map((bet, index) => normalizeBet(bet, auth.user.id, index))
    .filter(Boolean);

  if (!rows.length) {
    return jsonResponse({ ok: false, error: "No valid paper bets supplied" }, 400, requestId);
  }

  const { data, error } = await auth.supabase
    .from("bets")
    .upsert(rows, { onConflict: "user_id,client_ref" })
    .select(BET_SELECT);

  if (error) {
    return jsonResponse(
      { ok: false, error: publicError(error, "Paper bets could not be saved") },
      500,
      requestId
    );
  }

  return jsonResponse({ ok: true, synced: data?.length || 0, data: data || [] }, 200, requestId);
}

export async function PATCH(request) {
  const requestId = getRequestId(request);
  const unsafe = rejectUnsafeMutation(request, requestId);
  if (unsafe) return unsafe;

  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "cloud_bets_update",
    limit: 60,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 16 * 1024);
  if (!body.ok) {
    return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  }

  const id = cleanText(body.data?.id, 36);
  const status = cleanText(body.data?.status, 20).toLowerCase();
  const closingOdds = boundedNumber(body.data?.closingOdds ?? body.data?.closing_odds, {
    min: 1.001,
    max: 10000
  });

  if (!UUID_PATTERN.test(id) || !ALLOWED_STATUSES.has(status)) {
    return jsonResponse({ ok: false, error: "Invalid paper bet update" }, 400, requestId);
  }

  const { data: existing, error: loadError } = await auth.supabase
    .from("bets")
    .select("id,odds,stake")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (loadError || !existing) {
    return jsonResponse({ ok: false, error: "Paper bet was not found" }, 404, requestId);
  }

  const settlement = calculateSettlement({
    status,
    odds: Number(existing.odds),
    stake: Number(existing.stake),
    closingOdds
  });

  const update = {
    status,
    result: status === "open" ? null : cleanText(body.data?.result, 80, status),
    profit: status === "open" ? null : settlement.profit,
    closing_odds: closingOdds,
    clv: closingOdds ? settlement.clv : null
  };

  const { data, error } = await auth.supabase
    .from("bets")
    .update(update)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select(BET_SELECT)
    .single();

  if (error) {
    return jsonResponse(
      { ok: false, error: publicError(error, "Paper bet could not be updated") },
      500,
      requestId
    );
  }

  return jsonResponse({ ok: true, data }, 200, requestId);
}

export async function DELETE(request) {
  const requestId = getRequestId(request);
  const unsafe = rejectUnsafeMutation(request, requestId);
  if (unsafe) return unsafe;

  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "cloud_bets_delete",
    limit: 20,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 16 * 1024);
  if (!body.ok) {
    return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  }

  const ids = Array.isArray(body.data?.ids)
    ? [...new Set(body.data.ids.map((id) => cleanText(id, 36)).filter((id) => UUID_PATTERN.test(id)))].slice(0, 50)
    : [];

  if (!ids.length) {
    return jsonResponse({ ok: false, error: "No valid paper bet ids supplied" }, 400, requestId);
  }

  const { data, error } = await auth.supabase
    .from("bets")
    .delete()
    .eq("user_id", auth.user.id)
    .in("id", ids)
    .select("id");

  if (error) {
    return jsonResponse(
      { ok: false, error: publicError(error, "Paper bets could not be deleted") },
      500,
      requestId
    );
  }

  return jsonResponse({ ok: true, deleted: data?.length || 0 }, 200, requestId);
}
