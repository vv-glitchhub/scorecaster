import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  publicError
} from "../../../../lib/api-security";

export const dynamic = "force-dynamic";

function isMissingTable(error) {
  return error?.code === "42P01" || /does not exist/i.test(error?.message || "");
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);

  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  }

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "account_export",
    limit: 5,
    windowSeconds: 3600
  });
  if (limited) return limited;

  const [profileResult, betsResult, bankrollResult, watchlistResult] = await Promise.all([
    auth.supabase
      .from("profiles")
      .select("id,email,display_name,created_at,updated_at")
      .eq("id", auth.user.id)
      .maybeSingle(),
    auth.supabase
      .from("bets")
      .select("id,client_ref,label,match,market,bookmaker,sport,league,home_team,away_team,odds,stake,edge,ev,confidence,status,result,profit,closing_odds,clv,raw_pick,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(5000),
    auth.supabase
      .from("bankroll_settings")
      .select("bankroll,max_stake_percent,max_daily_exposure_percent,max_single_league_exposure_percent,min_edge,min_confidence,paper_trading_mode,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .maybeSingle(),
    auth.supabase
      .from("watchlist_items")
      .select("id,event_id,sport,league,market,selection,home_team,away_team,match,commence_time,added_odds,added_decision,alert_move_percent,alert_before_minutes,active,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(500)
  ]);

  const errors = [profileResult.error, betsResult.error, bankrollResult.error]
    .filter(Boolean);
  if (watchlistResult.error && !isMissingTable(watchlistResult.error)) errors.push(watchlistResult.error);
  const firstError = errors[0] || null;

  if (firstError) {
    return jsonResponse(
      { ok: false, error: publicError(firstError, "Account data could not be exported") },
      500,
      requestId
    );
  }

  return jsonResponse(
    {
      ok: true,
      exportedAt: new Date().toISOString(),
      product: "Scorecaster",
      dataClassification: "paper-tracking, model-audit snapshots, verified watchlist and account data; no payment data",
      account: {
        id: auth.user.id,
        email: auth.user.email || null,
        createdAt: auth.user.created_at || null
      },
      profile: profileResult.data || null,
      bankroll: bankrollResult.data || null,
      paperBets: betsResult.data || [],
      watchlist: watchlistResult.error ? [] : watchlistResult.data || []
    },
    200,
    requestId
  );
}
