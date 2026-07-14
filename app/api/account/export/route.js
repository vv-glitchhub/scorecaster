import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  publicError
} from "../../../../lib/api-security";

export const dynamic = "force-dynamic";

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

  const [profileResult, betsResult, bankrollResult] = await Promise.all([
    auth.supabase
      .from("profiles")
      .select("id,email,display_name,created_at,updated_at")
      .eq("id", auth.user.id)
      .maybeSingle(),
    auth.supabase
      .from("bets")
      .select("id,client_ref,label,match,market,bookmaker,sport,league,home_team,away_team,odds,stake,edge,ev,confidence,status,result,profit,closing_odds,clv,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(5000),
    auth.supabase
      .from("bankroll_settings")
      .select("bankroll,max_stake_percent,max_daily_exposure_percent,max_single_league_exposure_percent,min_edge,min_confidence,paper_trading_mode,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .maybeSingle()
  ]);

  const firstError = profileResult.error || betsResult.error || bankrollResult.error;
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
      dataClassification: "paper-tracking and account data; no payment data",
      account: {
        id: auth.user.id,
        email: auth.user.email || null,
        createdAt: auth.user.created_at || null
      },
      profile: profileResult.data || null,
      bankroll: bankrollResult.data || null,
      paperBets: betsResult.data || []
    },
    200,
    requestId
  );
}
