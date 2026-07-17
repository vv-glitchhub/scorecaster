import {
  boundedNumber,
  cleanText,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  readJsonBody
} from "../../../../lib/api-security";
import { calculateAgentPerformance } from "../../../../lib/agent-learning.js";
import { buildAgentV9Portfolio } from "../../../../lib/agent-v9-engine.mjs";
import {
  agentDecisionSigningConfigured,
  createAgentDecisionTicket
} from "../../../../lib/agent-decision-ticket.mjs";
import { GET as getTopPicks } from "../../top-picks/route.js";
import { SPORTS } from "../../../../lib/sports.js";

export const dynamic = "force-dynamic";

const SUPPORTED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const MAX_SPORTS = 6;
const MAX_HISTORY = 500;

function parseSports(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, 120)).filter((item) => SUPPORTED_SPORTS.has(item)))]
    .sort()
    .slice(0, MAX_SPORTS);
}

function normalizeSettings(value = {}) {
  return {
    bankroll: boundedNumber(value.bankroll, { min: 0, max: 10_000_000, fallback: 1000 }),
    maxStakePercent: boundedNumber(value.maxStakePercent, { min: 0.1, max: 5, fallback: 1 }),
    maxTotalExposurePercent: boundedNumber(value.maxTotalExposurePercent, { min: 0.5, max: 20, fallback: 4 }),
    maxLeagueExposurePercent: boundedNumber(value.maxLeagueExposurePercent, { min: 0.25, max: 10, fallback: 2 })
  };
}

function mapCloudBet(row) {
  const result = row.status === "won"
    ? "win"
    : row.status === "lost"
      ? "loss"
      : row.status === "push" || row.status === "void"
        ? "push"
        : "pending";

  return {
    id: row.id,
    result,
    stake: Number(row.stake || 0),
    odds: Number(row.odds || 0),
    closingOdds: row.closing_odds === null ? null : Number(row.closing_odds),
    sportKey: row.sport || row.league || "unknown",
    league: row.league || row.sport || "unknown",
    marketKey: row.market || "h2h",
    modelProbability: row.raw_pick?.modelProbability ?? null
  };
}

async function loadLearning(auth) {
  const { data, error } = await auth.supabase
    .from("bets")
    .select("id,status,stake,odds,closing_odds,sport,league,market,raw_pick")
    .eq("user_id", auth.user.id)
    .neq("status", "open")
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY);

  if (error) return { learning: null, warning: "Paper history could not be included" };
  return {
    learning: calculateAgentPerformance((data || []).map(mapCloudBet)),
    warning: null
  };
}

async function loadTopPicks(request, sports) {
  const target = new URL("/api/top-picks", request.url);
  if (sports.length) target.searchParams.set("sports", sports.join(","));
  const response = await getTopPicks(new Request(target, { method: "GET" }));
  const payload = await response.json();
  if (!response.ok) {
    return { ok: false, status: response.status, error: payload?.error || "Agent source data could not be loaded" };
  }
  return { ok: true, payload };
}

export async function POST(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }

  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  }

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "agent_v10_portfolio",
    limit: 20,
    windowSeconds: 300
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 16 * 1024);
  if (!body.ok) {
    return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  }

  const settings = normalizeSettings(body.data?.settings);
  const sports = parseSports(body.data?.sports);
  const [source, learningResult] = await Promise.all([
    loadTopPicks(request, sports),
    loadLearning(auth)
  ]);

  if (!source.ok) {
    return jsonResponse({ ok: false, error: source.error }, source.status, requestId);
  }

  const portfolio = buildAgentV9Portfolio(source.payload?.data || [], {
    ...settings,
    learning: learningResult.learning
  });
  const signingConfigured = agentDecisionSigningConfigured();
  const decisions = portfolio.decisions.map((decision) => ({
    ...decision,
    explanationTicket: signingConfigured ? createAgentDecisionTicket(decision) : null
  }));

  return jsonResponse(
    {
      ok: true,
      source: source.payload?.source || "no-vig-market-consensus",
      generatedAt: new Date().toISOString(),
      paperOnly: true,
      signingConfigured,
      explanationMode: signingConfigured
        ? "signed-grounded-provider-or-fallback"
        : "deterministic-fallback-only",
      warnings: [learningResult.warning].filter(Boolean),
      settings,
      counts: portfolio.counts,
      totalAllocated: portfolio.totalAllocated,
      totalCap: portfolio.totalCap,
      leagueCap: portfolio.leagueCap,
      exposurePercent: portfolio.exposurePercent,
      decisions
    },
    200,
    requestId
  );
}
