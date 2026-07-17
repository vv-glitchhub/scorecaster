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
import { enrichPickWithLiveIntelligence } from "../../../../lib/agent-intelligence-loader.js";
import { buildSelfLearningReport } from "../../../../lib/agent-self-learning.mjs";
import {
  applyModelLabSafety,
  summarizeGovernedDecisions
} from "../../../../lib/agent-model-governance.mjs";
import { buildAgentV9Portfolio } from "../../../../lib/agent-v9-engine.mjs";
import {
  attachVerifiedSportsIntelligence,
  buildUnevaluatedSportsIntelligence
} from "../../../../lib/verified-sports-intelligence.mjs";
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
const MAX_CONTEXT_PICKS = 6;

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
    createdAt: row.created_at,
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
    .select("id,status,created_at,stake,odds,closing_odds,sport,league,market,raw_pick")
    .eq("user_id", auth.user.id)
    .neq("status", "open")
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY);

  if (error) {
    return {
      learning: null,
      modelLab: buildSelfLearningReport([]),
      warning: "Paper history could not be included"
    };
  }

  const history = (data || []).map(mapCloudBet);
  return {
    learning: calculateAgentPerformance(history),
    modelLab: buildSelfLearningReport(history),
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

async function loadVerifiedContext(picks) {
  const input = Array.isArray(picks) ? picks.slice(0, 20) : [];
  const evaluated = await Promise.all(input.slice(0, MAX_CONTEXT_PICKS).map(async (pick) => {
    try {
      return await enrichPickWithLiveIntelligence(pick);
    } catch {
      return attachVerifiedSportsIntelligence(
        pick,
        buildUnevaluatedSportsIntelligence(pick.commenceTime)
      );
    }
  }));
  const unevaluated = input.slice(MAX_CONTEXT_PICKS).map((pick) =>
    attachVerifiedSportsIntelligence(pick, buildUnevaluatedSportsIntelligence(pick.commenceTime))
  );
  return [...evaluated, ...unevaluated];
}

function summarizeContext(picks) {
  const reports = picks.map((pick) => pick.verifiedIntelligence).filter(Boolean);
  return {
    version: "real-sports-intelligence-v1",
    evaluated: reports.filter((report) => report.status !== "not_evaluated").length,
    maximumEvaluatedPerRequest: MAX_CONTEXT_PICKS,
    verified: reports.filter((report) => report.status === "verified").length,
    partial: reports.filter((report) => report.status === "partial").length,
    unavailable: reports.filter((report) => report.status === "unavailable").length,
    blockedByVerifiedContext: reports.filter((report) => report.playGate?.blocked).length,
    probabilityAdjusted: false,
    externalMarketUsedForDecision: false
  };
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
    bucket: "agent_v11_portfolio",
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

  const contextPicks = await loadVerifiedContext(source.payload?.data || []);
  const contextSummary = summarizeContext(contextPicks);
  const portfolio = buildAgentV9Portfolio(contextPicks, {
    ...settings,
    learning: learningResult.learning
  });
  const governedDecisions = applyModelLabSafety(portfolio.decisions, learningResult.modelLab);
  const governedSummary = summarizeGovernedDecisions(governedDecisions);
  const signingConfigured = agentDecisionSigningConfigured();
  const decisions = governedDecisions.map((decision) => ({
    ...decision,
    explanationTicket: signingConfigured ? createAgentDecisionTicket(decision) : null
  }));

  const warnings = [learningResult.warning].filter(Boolean);
  if (contextSummary.evaluated === 0) {
    warnings.push("Verified sports context is unavailable; missing context remains visible and probability was not changed");
  }

  return jsonResponse(
    {
      ok: true,
      agentVersion: "V11-model-lab-real-intelligence-v1",
      source: source.payload?.source || "no-vig-market-consensus",
      fixtureSource: source.payload?.fixtureSource || "live-odds-provider-only",
      generatedAt: new Date().toISOString(),
      paperOnly: true,
      signingConfigured,
      explanationMode: signingConfigured
        ? "signed-grounded-provider-or-fallback"
        : "deterministic-fallback-only",
      learningMode: "chronological-champion-challenger-shadow",
      intelligenceMode: "verified-context-safety-gate-no-probability-adjustment",
      warnings,
      settings,
      modelLab: learningResult.modelLab,
      sportsIntelligence: contextSummary,
      counts: governedSummary.counts,
      totalAllocated: governedSummary.totalAllocated,
      totalCap: portfolio.totalCap,
      leagueCap: portfolio.leagueCap,
      exposurePercent: settings.bankroll > 0 ? governedSummary.totalAllocated / settings.bankroll : 0,
      decisions
    },
    200,
    requestId
  );
}
