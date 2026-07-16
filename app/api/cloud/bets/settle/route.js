import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  publicError
} from "../../../../../lib/api-security";
import { findScoreEventForBet, settlePaperBetFromScore } from "../../../../../lib/paper-settlement-engine.mjs";
import { SPORTS } from "../../../../../lib/sports";

export const dynamic = "force-dynamic";

const BET_SELECT =
  "id,client_ref,label,match,market,bookmaker,sport,league,home_team,away_team,odds,stake,edge,ev,confidence,status,result,profit,closing_odds,clv,raw_pick,created_at,updated_at";
const SUPPORTED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const MAX_SPORTS_PER_CHECK = 6;
const MAX_OPEN_BETS = 100;
const MAX_SETTLEMENTS_PER_CHECK = 50;

function rejectUnsafeMutation(request, requestId) {
  if (mutationOriginAllowed(request)) return null;
  return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
}

async function loadScores(sport) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return { sport, events: [], error: "Scores provider is not configured" };

  const params = new URLSearchParams({
    apiKey,
    daysFrom: "3",
    dateFormat: "iso"
  });

  try {
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sport)}/scores/?${params.toString()}`,
      {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(12000)
      }
    );

    if (!response.ok) {
      return {
        sport,
        events: [],
        error: response.status === 422
          ? "Scores are not available for this sport"
          : "Scores provider request failed"
      };
    }

    const data = await response.json();
    return {
      sport,
      events: Array.isArray(data) ? data : [],
      error: null
    };
  } catch {
    return { sport, events: [], error: "Scores provider timed out" };
  }
}

export async function POST(request) {
  const requestId = getRequestId(request);
  const unsafe = rejectUnsafeMutation(request, requestId);
  if (unsafe) return unsafe;

  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  }

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "cloud_bets_auto_settle",
    limit: 3,
    windowSeconds: 3600
  });
  if (limited) return limited;

  if (!process.env.ODDS_API_KEY) {
    return jsonResponse(
      { ok: false, error: "Automatic score settlement is not configured" },
      503,
      requestId
    );
  }

  const { data: openBets, error: loadError } = await auth.supabase
    .from("bets")
    .select(BET_SELECT)
    .eq("user_id", auth.user.id)
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(MAX_OPEN_BETS);

  if (loadError) {
    return jsonResponse(
      { ok: false, error: publicError(loadError, "Open paper bets could not be loaded") },
      500,
      requestId
    );
  }

  const bets = openBets || [];
  const requestedSports = [...new Set(
    bets
      .map((bet) => String(bet.sport || ""))
      .filter((sport) => SUPPORTED_SPORTS.has(sport))
  )];
  const checkedSports = requestedSports.slice(0, MAX_SPORTS_PER_CHECK);

  if (!checkedSports.length) {
    return jsonResponse(
      {
        ok: true,
        checked: bets.length,
        settled: 0,
        pending: bets.length,
        checkedSports: [],
        message: "No open paper bets had a supported sport key"
      },
      200,
      requestId
    );
  }

  const scoreResponses = await Promise.all(checkedSports.map(loadScores));
  const eventsBySport = new Map(scoreResponses.map((item) => [item.sport, item.events]));
  const providerWarnings = scoreResponses
    .filter((item) => item.error)
    .map((item) => ({ sport: item.sport, error: item.error }));

  const candidates = bets
    .map((bet) => {
      const events = eventsBySport.get(String(bet.sport || "")) || [];
      const event = findScoreEventForBet(bet, events);
      const settlement = event ? settlePaperBetFromScore(bet, event) : null;
      return settlement ? { bet, settlement } : null;
    })
    .filter(Boolean)
    .slice(0, MAX_SETTLEMENTS_PER_CHECK);

  const updates = await Promise.all(candidates.map(async ({ bet, settlement }) => {
    const rawPick = bet.raw_pick && typeof bet.raw_pick === "object" ? bet.raw_pick : {};
    const nextRawPick = {
      ...rawPick,
      eventId: settlement.eventId || rawPick.eventId || null,
      settlementSource: settlement.settlementSource,
      settledAt: new Date().toISOString(),
      completedAt: settlement.completedAt,
      finalScore: settlement.finalScore
    };

    const { data, error } = await auth.supabase
      .from("bets")
      .update({
        status: settlement.status,
        result: settlement.result,
        profit: settlement.profit,
        raw_pick: nextRawPick
      })
      .eq("id", bet.id)
      .eq("user_id", auth.user.id)
      .eq("status", "open")
      .select(BET_SELECT)
      .maybeSingle();

    return { data, error, betId: bet.id };
  }));

  const settledRows = updates.filter((item) => item.data && !item.error).map((item) => item.data);
  const updateFailures = updates.filter((item) => item.error).length;

  return jsonResponse(
    {
      ok: updateFailures === 0,
      checked: bets.length,
      settled: settledRows.length,
      pending: Math.max(0, bets.length - settledRows.length),
      checkedSports,
      skippedSports: requestedSports.slice(MAX_SPORTS_PER_CHECK),
      providerWarnings,
      updateFailures,
      data: settledRows
    },
    updateFailures === 0 ? 200 : 207,
    requestId
  );
}
