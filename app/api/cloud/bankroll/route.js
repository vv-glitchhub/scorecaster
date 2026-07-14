import {
  boundedNumber,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  publicError,
  readJsonBody
} from "../../../../lib/api-security";

export const dynamic = "force-dynamic";

const SELECT =
  "bankroll,max_stake_percent,max_daily_exposure_percent,max_single_league_exposure_percent,min_edge,min_confidence,paper_trading_mode,created_at,updated_at";

const DEFAULTS = {
  bankroll: 1000,
  max_stake_percent: 2,
  max_daily_exposure_percent: 8,
  max_single_league_exposure_percent: 4,
  min_edge: 0.025,
  min_confidence: 0.58,
  paper_trading_mode: true
};

async function requireAuth(request, requestId) {
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) {
    return { error: jsonResponse({ ok: false, error: auth.error }, auth.status, requestId) };
  }
  return auth;
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "cloud_bankroll_read",
    limit: 120,
    windowSeconds: 60
  });
  if (limited) return limited;

  const { data, error } = await auth.supabase
    .from("bankroll_settings")
    .select(SELECT)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return jsonResponse(
      { ok: false, error: publicError(error, "Paper bankroll settings could not be loaded") },
      500,
      requestId
    );
  }

  return jsonResponse({ ok: true, data: data || DEFAULTS }, 200, requestId);
}

export async function PUT(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }

  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "cloud_bankroll_update",
    limit: 30,
    windowSeconds: 60
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 16 * 1024);
  if (!body.ok) {
    return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  }

  const row = {
    user_id: auth.user.id,
    bankroll: boundedNumber(body.data?.bankroll, { min: 0, max: 10000000, fallback: DEFAULTS.bankroll }),
    max_stake_percent: boundedNumber(body.data?.maxStakePercent ?? body.data?.max_stake_percent, {
      min: 0.1,
      max: 10,
      fallback: DEFAULTS.max_stake_percent
    }),
    max_daily_exposure_percent: boundedNumber(
      body.data?.maxDailyExposurePercent ?? body.data?.max_daily_exposure_percent,
      { min: 0.5, max: 50, fallback: DEFAULTS.max_daily_exposure_percent }
    ),
    max_single_league_exposure_percent: boundedNumber(
      body.data?.maxSingleLeagueExposurePercent ?? body.data?.max_single_league_exposure_percent,
      { min: 0.5, max: 25, fallback: DEFAULTS.max_single_league_exposure_percent }
    ),
    min_edge: boundedNumber(body.data?.minEdge ?? body.data?.min_edge, {
      min: 0,
      max: 0.5,
      fallback: DEFAULTS.min_edge
    }),
    min_confidence: boundedNumber(body.data?.minConfidence ?? body.data?.min_confidence, {
      min: 0,
      max: 1,
      fallback: DEFAULTS.min_confidence
    }),
    paper_trading_mode: true
  };

  const { data, error } = await auth.supabase
    .from("bankroll_settings")
    .upsert(row, { onConflict: "user_id" })
    .select(SELECT)
    .single();

  if (error) {
    return jsonResponse(
      { ok: false, error: publicError(error, "Paper bankroll settings could not be saved") },
      500,
      requestId
    );
  }

  return jsonResponse({ ok: true, data }, 200, requestId);
}
