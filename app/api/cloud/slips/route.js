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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LEGS = 20;
const MAX_TOTAL_ODDS = 1_000_000_000;
const SLIP_SELECT = "id,status,total_stake,potential_return,potential_profit,decision,warnings,blockers,created_at,updated_at,slip_type,total_odds,settled_at";
const ITEM_SELECT = "id,bet_slip_id,source_bet_id,sport,league,match,market,selection,bookmaker,odds,stake,edge,ev,confidence,model_probability,implied_probability,decision,risk_warnings,risk_blockers,commence_time,created_at";
const BET_SELECT = "id,label,match,market,bookmaker,sport,league,home_team,away_team,commence_time,odds,stake,edge,ev,confidence,status,result,raw_pick,created_at";

function rejectUnsafeMutation(request, requestId) {
  if (mutationOriginAllowed(request)) return null;
  return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
}

async function requireAuth(request, requestId) {
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return { error: jsonResponse({ ok: false, error: auth.error }, auth.status, requestId) };
  return auth;
}

function round(value, digits = 4) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function normalizedLegStatus(status) {
  const value = String(status || "open").toLowerCase();
  if (value === "won") return "won";
  if (value === "lost") return "lost";
  if (value === "push" || value === "void") return "push";
  return "open";
}

function deriveSlipStatus(legs) {
  if (!legs.length) return "open";
  if (legs.some((leg) => leg.status === "lost")) return "lost";
  if (legs.some((leg) => leg.status === "open")) return "open";
  if (legs.every((leg) => leg.status === "push")) return "push";
  return "won";
}

function serializeCoupon(slip, items, sourceBets) {
  const legs = items.map((item, index) => {
    const source = item.source_bet_id ? sourceBets.get(item.source_bet_id) : null;
    return {
      id: item.id,
      sourceBetId: item.source_bet_id || null,
      order: index + 1,
      sport: item.sport || source?.sport || null,
      league: item.league || source?.league || null,
      match: item.match || source?.match || "Paper pick",
      market: item.market || source?.market || "h2h",
      selection: item.selection || source?.label || "—",
      bookmaker: item.bookmaker || source?.bookmaker || null,
      odds: Number(item.odds || source?.odds || 0),
      edge: item.edge ?? source?.edge ?? null,
      ev: item.ev ?? source?.ev ?? null,
      confidence: item.confidence ?? source?.confidence ?? null,
      commenceTime: item.commence_time || source?.commence_time || null,
      status: normalizedLegStatus(source?.status),
      result: source?.result || null
    };
  });

  const status = deriveSlipStatus(legs);
  const stake = Number(slip.total_stake || 0);
  const settledOdds = legs.reduce((product, leg) => {
    if (leg.status === "won") return product * Math.max(1, Number(leg.odds || 1));
    if (leg.status === "push") return product;
    return product;
  }, 1);
  const currentReturn = status === "lost"
    ? 0
    : status === "won"
      ? stake * settledOdds
      : status === "push"
        ? stake
        : Number(slip.potential_return || 0);

  return {
    id: slip.id,
    type: slip.slip_type || "accumulator",
    status,
    storedStatus: slip.status,
    stake,
    totalOdds: Number(slip.total_odds || 1),
    potentialReturn: Number(slip.potential_return || 0),
    potentialProfit: Number(slip.potential_profit || 0),
    currentReturn: round(currentReturn),
    currentProfit: round(currentReturn - stake),
    createdAt: slip.created_at,
    updatedAt: slip.updated_at,
    settledAt: slip.settled_at || null,
    warnings: Array.isArray(slip.warnings) ? slip.warnings : [],
    blockers: Array.isArray(slip.blockers) ? slip.blockers : [],
    legs
  };
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "paper_coupons_read",
    limit: 90,
    windowSeconds: 60
  });
  if (limited) return limited;

  const { data: slips, error: slipError } = await auth.supabase
    .from("bet_slips")
    .select(SLIP_SELECT)
    .eq("user_id", auth.user.id)
    .eq("slip_type", "accumulator")
    .order("created_at", { ascending: false })
    .limit(50);

  if (slipError) {
    return jsonResponse({ ok: false, error: publicError(slipError, "Paper coupons could not be loaded") }, 500, requestId);
  }

  if (!slips?.length) return jsonResponse({ ok: true, count: 0, data: [] }, 200, requestId);

  const slipIds = slips.map((slip) => slip.id);
  const { data: items, error: itemError } = await auth.supabase
    .from("bet_slip_items")
    .select(ITEM_SELECT)
    .eq("user_id", auth.user.id)
    .in("bet_slip_id", slipIds)
    .order("created_at", { ascending: true });

  if (itemError) {
    return jsonResponse({ ok: false, error: publicError(itemError, "Paper coupon legs could not be loaded") }, 500, requestId);
  }

  const sourceIds = [...new Set((items || []).map((item) => item.source_bet_id).filter(Boolean))];
  const sourceBets = new Map();
  if (sourceIds.length) {
    const { data: currentBets, error: betError } = await auth.supabase
      .from("bets")
      .select(BET_SELECT)
      .eq("user_id", auth.user.id)
      .in("id", sourceIds);

    if (betError) {
      return jsonResponse({ ok: false, error: publicError(betError, "Paper coupon results could not be loaded") }, 500, requestId);
    }
    (currentBets || []).forEach((bet) => sourceBets.set(bet.id, bet));
  }

  const itemsBySlip = new Map();
  (items || []).forEach((item) => {
    const current = itemsBySlip.get(item.bet_slip_id) || [];
    current.push(item);
    itemsBySlip.set(item.bet_slip_id, current);
  });

  const data = slips.map((slip) => serializeCoupon(slip, itemsBySlip.get(slip.id) || [], sourceBets));
  return jsonResponse({ ok: true, count: data.length, data }, 200, requestId);
}

export async function POST(request) {
  const requestId = getRequestId(request);
  const unsafe = rejectUnsafeMutation(request, requestId);
  if (unsafe) return unsafe;

  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "paper_coupons_create",
    limit: 20,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 24 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  const betIds = Array.isArray(body.data?.betIds)
    ? [...new Set(body.data.betIds.map((id) => cleanText(id, 36)).filter((id) => UUID_PATTERN.test(id)))].slice(0, MAX_LEGS)
    : [];
  const stake = boundedNumber(body.data?.stake, { min: 0.1, max: 10_000_000 });

  if (betIds.length < 2) {
    return jsonResponse({ ok: false, error: "Select at least two paper picks for a coupon" }, 400, requestId);
  }
  if (stake === null) {
    return jsonResponse({ ok: false, error: "Invalid paper coupon stake" }, 400, requestId);
  }

  const [{ data: settings, error: settingsError }, { data: bets, error: betsError }] = await Promise.all([
    auth.supabase
      .from("bankroll_settings")
      .select("bankroll,max_stake_percent")
      .eq("user_id", auth.user.id)
      .maybeSingle(),
    auth.supabase
      .from("bets")
      .select(BET_SELECT)
      .eq("user_id", auth.user.id)
      .in("id", betIds)
  ]);

  if (settingsError) {
    return jsonResponse({ ok: false, error: publicError(settingsError, "Paper bankroll limits could not be checked") }, 500, requestId);
  }
  if (betsError) {
    return jsonResponse({ ok: false, error: publicError(betsError, "Paper picks could not be loaded") }, 500, requestId);
  }
  if ((bets || []).length !== betIds.length) {
    return jsonResponse({ ok: false, error: "One or more paper picks were not found" }, 400, requestId);
  }
  if ((bets || []).some((bet) => String(bet.status || "open") !== "open")) {
    return jsonResponse({ ok: false, error: "Only open paper picks can be added to a new coupon" }, 400, requestId);
  }

  const matchKeys = (bets || []).map((bet) => String(bet.match || `${bet.home_team || ""}-${bet.away_team || ""}`).trim().toLowerCase());
  if (new Set(matchKeys).size !== matchKeys.length) {
    return jsonResponse({ ok: false, error: "Use at most one selection from the same match in a paper coupon" }, 400, requestId);
  }

  const bankroll = Number(settings?.bankroll ?? 1000);
  const maxStakePercent = Number(settings?.max_stake_percent ?? 2);
  const maxPaperStake = round(Math.max(0, bankroll * maxStakePercent / 100));
  if (stake > maxPaperStake + 0.0001) {
    return jsonResponse({ ok: false, error: "Paper coupon stake exceeds the configured virtual-bankroll limit", maxPaperStake }, 400, requestId);
  }

  const totalOdds = (bets || []).reduce((product, bet) => product * Number(bet.odds || 1), 1);
  if (!Number.isFinite(totalOdds) || totalOdds <= 1 || totalOdds > MAX_TOTAL_ODDS) {
    return jsonResponse({ ok: false, error: "Paper coupon total odds are outside the supported range" }, 400, requestId);
  }

  const potentialReturn = round(stake * totalOdds);
  const warnings = [];
  if (betIds.length >= 8) warnings.push("High-leg coupon: every leg must settle without a loss.");
  if (totalOdds >= 100) warnings.push("Very high combined odds: treat the coupon as high variance even in paper mode.");

  const { data: slip, error: slipError } = await auth.supabase
    .from("bet_slips")
    .insert({
      user_id: auth.user.id,
      status: "open",
      slip_type: "accumulator",
      total_stake: round(stake),
      total_odds: round(totalOdds, 6),
      potential_return: potentialReturn,
      potential_profit: round(potentialReturn - stake),
      decision: "PAPER",
      warnings,
      blockers: []
    })
    .select(SLIP_SELECT)
    .single();

  if (slipError || !slip) {
    return jsonResponse({ ok: false, error: publicError(slipError, "Paper coupon could not be created") }, 500, requestId);
  }

  const betMap = new Map((bets || []).map((bet) => [bet.id, bet]));
  const itemRows = betIds.map((betId) => {
    const bet = betMap.get(betId);
    const raw = bet?.raw_pick && typeof bet.raw_pick === "object" ? bet.raw_pick : {};
    return {
      bet_slip_id: slip.id,
      user_id: auth.user.id,
      source_bet_id: bet.id,
      sport: cleanText(bet.sport, 120),
      league: cleanText(bet.league, 120),
      match: cleanText(bet.match || [bet.home_team, bet.away_team].filter(Boolean).join(" – "), 240, "Paper pick"),
      market: cleanText(bet.market, 80, "h2h"),
      selection: cleanText(bet.label, 160, "Paper pick"),
      bookmaker: cleanText(bet.bookmaker, 120),
      odds: Number(bet.odds),
      stake: 0,
      edge: bet.edge,
      ev: bet.ev,
      confidence: bet.confidence,
      model_probability: boundedNumber(raw.modelProbability, { min: 0, max: 1 }),
      implied_probability: boundedNumber(raw.entryMarketProbability ?? raw.impliedProbability, { min: 0, max: 1 }),
      decision: cleanText(raw.decision, 20, "PAPER"),
      risk_warnings: [],
      risk_blockers: [],
      commence_time: bet.commence_time || null
    };
  });

  const { data: items, error: itemError } = await auth.supabase
    .from("bet_slip_items")
    .insert(itemRows)
    .select(ITEM_SELECT);

  if (itemError) {
    await auth.supabase.from("bet_slips").delete().eq("id", slip.id).eq("user_id", auth.user.id);
    return jsonResponse({ ok: false, error: publicError(itemError, "Paper coupon legs could not be saved") }, 500, requestId);
  }

  const sourceBets = new Map((bets || []).map((bet) => [bet.id, bet]));
  return jsonResponse({ ok: true, data: serializeCoupon(slip, items || [], sourceBets) }, 201, requestId);
}

export async function DELETE(request) {
  const requestId = getRequestId(request);
  const unsafe = rejectUnsafeMutation(request, requestId);
  if (unsafe) return unsafe;

  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "paper_coupons_delete",
    limit: 20,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 8 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  const id = cleanText(body.data?.id, 36);
  if (!UUID_PATTERN.test(id)) return jsonResponse({ ok: false, error: "Invalid paper coupon id" }, 400, requestId);

  const { data, error } = await auth.supabase
    .from("bet_slips")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .eq("slip_type", "accumulator")
    .select("id")
    .maybeSingle();

  if (error) return jsonResponse({ ok: false, error: publicError(error, "Paper coupon could not be deleted") }, 500, requestId);
  if (!data) return jsonResponse({ ok: false, error: "Paper coupon was not found" }, 404, requestId);

  return jsonResponse({ ok: true, deleted: id }, 200, requestId);
}
