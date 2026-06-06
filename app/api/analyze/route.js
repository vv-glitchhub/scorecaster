import { analyzeBet } from "../../../lib/analysis-engine";
import { buildAgentV7Pick } from "../../../lib/agent-v7-data-fusion-engine";
import { loadIntelligenceForMatch } from "../../../lib/intelligence-service";

export async function POST(request) {
  try {
    const body = await request.json();

    const decimalOdds = Number(body.decimalOdds || body.odds || 0);
    const modelProbability = Number(body.modelProbability || 0);

    const analysis = analyzeBet({
      selection: body.selection,
      decimalOdds,
      modelProbability,
      volatility: body.volatility || "medium",
      bankroll: Number(body.bankroll || 1000)
    });

    const pick = {
      ...analysis,
      selection: body.selection,
      homeTeam: body.homeTeam || body.home || body.selection,
      awayTeam: body.awayTeam || body.away || "Opponent",
      sportKey: body.sportKey || body.sport || "unknown",
      league: body.league || body.leagueTitle || body.sportKey || "unknown",
      marketKey: body.marketKey || body.market || "h2h",
      bookmaker: body.bookmaker || "unknown",
      odds: decimalOdds,
      modelProbability,
      marketProbability: decimalOdds > 0 ? 1 / decimalOdds : 0,
      edge: analysis.edge,
      finalScore: analysis.edge || 0,
      suggestedStake: analysis.suggestedStake
    };

    const intelligence = await loadIntelligenceForMatch({
      homeTeam: pick.homeTeam,
      awayTeam: pick.awayTeam,
      sport: pick.sportKey,
      league: pick.league
    });

    const agent = buildAgentV7Pick({
      pick,
      trackedBets: body.trackedBets || [],
      learningBoost: Number(body.learningBoost || 0),
      movementSignal: body.movementSignal || "Stable",
      contextInput: body.contextInput || {},
      marketInput: body.marketInput || {},
      intelligence
    });

    return Response.json({
      ok: true,
      source: "agent-v7-analyze",
      agentVersion: "V7",
      analysis,
      agent,
      decision: agent.decision,
      finalScore: agent.finalScore,
      dataFusionScore: agent.dataFusionScore,
      sentimentScore: agent.sentimentScore,
      sourceTrust: agent.sourceTrust,
      sourceTrustLabel: agent.sourceTrustLabel
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
