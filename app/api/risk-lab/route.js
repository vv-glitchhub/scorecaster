import {
  KELLY_MULTIPLIERS,
  RISK_LAB_ABSOLUTE_CAPS,
  RISK_LAB_DEFAULTS,
  RISK_LAB_VERSION,
  RISK_PROFILES,
  runRiskLab
} from "../../../lib/risk-lab-v1.mjs";
import {
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  readJsonBody
} from "../../../lib/api-security";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const methodology = {
  version: RISK_LAB_VERSION,
  paperOnly: true,
  defaults: RISK_LAB_DEFAULTS,
  hardCaps: RISK_LAB_ABSOLUTE_CAPS,
  riskProfiles: RISK_PROFILES,
  kellyMultipliers: KELLY_MULTIPLIERS,
  formulas: {
    kelly: "f* = ((decimal_odds - 1) * p - (1 - p)) / (decimal_odds - 1)",
    fractionalKelly: "stake_fraction = max(0, f*) * selected_multiplier",
    drawdown: "(running_peak - bankroll) / running_peak",
    riskOfRuin: "share of simulations crossing the configured bankroll threshold"
  },
  boundaries: {
    hardCapsCanBeOverridden: false,
    correlationCanIncreaseStake: false,
    bookmakerAccountConnection: false,
    realMoneyExecution: false,
    guaranteedProfitClaim: false
  }
};

export function GET() {
  return jsonResponse({ ok: true, ...methodology }, 200, null, {
    "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
  });
}

export async function POST(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }

  const body = await readJsonBody(request, 96 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  const result = runRiskLab(body.data || {});
  if (!result.stakePlan?.eligible) {
    return jsonResponse({
      ...result,
      ok: false,
      error: "At least one valid paper selection with decimal odds, event identity and probability is required"
    }, 422, requestId);
  }

  return jsonResponse(result, 200, requestId);
}
