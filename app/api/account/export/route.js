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

  const [profileResult, betsResult, bankrollResult, watchlistResult, notificationsResult, notificationSettingsResult] = await Promise.all([
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
      .maybeSingle(),
    auth.supabase
      .from("watchlist_items")
      .select("id,event_id,sport,league,market,selection,home_team,away_team,match,commence_time,added_odds,added_decision,alert_move_percent,alert_before_minutes,active,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(500),
    auth.supabase
      .from("notification_items")
      .select("id,source_key,source_type,notification_type,severity,watchlist_id,event_id,match,selection,commence_time,payload,first_seen_at,last_seen_at,read_at,dismissed_at,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .order("last_seen_at", { ascending: false })
      .limit(1000),
    auth.supabase
      .from("notification_settings")
      .select("in_app_enabled,minimum_severity,kickoff_enabled,price_enabled,decision_enabled,availability_enabled,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .maybeSingle()
  ]);

  const optionalResults = [watchlistResult, notificationsResult, notificationSettingsResult];
  const errors = [profileResult.error, betsResult.error, bankrollResult.error].filter(Boolean);
  optionalResults.forEach((result) => {
    if (result.error && !isMissingTable(result.error)) errors.push(result.error);
  });
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
      dataClassification: "paper-tracking, verified watchlist, in-app Notification Center and account data; no payment data",
      account: {
        id: auth.user.id,
        email: auth.user.email || null,
        createdAt: auth.user.created_at || null
      },
      profile: profileResult.data || null,
      bankroll: bankrollResult.data || null,
      paperBets: betsResult.data || [],
      watchlist: watchlistResult.error ? [] : watchlistResult.data || [],
      notificationSettings: notificationSettingsResult.error ? null : notificationSettingsResult.data || null,
      notifications: notificationsResult.error ? [] : notificationsResult.data || []
    },
    200,
    requestId
  );
}
