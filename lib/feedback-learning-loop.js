import { buildAgentLearningV4 } from "./agent-learning-v4";
import { summarizeCLVHistory } from "./clv-engine";

export function runFeedbackLearningLoop({ records = [], picks = [] } = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const safePicks = Array.isArray(picks) ? picks : [];

  const clvSummary = summarizeCLVHistory(safeRecords);
  const learning = buildAgentLearningV4({ records: safeRecords, clvSummary });
  const feedback = buildFeedbackActions({ learning, clvSummary, picks: safePicks });

  return {
    ok: true,
    source: "feedback-learning-loop-v1",
    generatedAt: new Date().toISOString(),
    learning,
    clvSummary,
    feedback,
    nextWeights: learning.weights,
    riskMode: learning.weights?.riskMode || "balanced"
  };
}

function buildFeedbackActions({ learning, clvSummary, picks }) {
  const summary = learning?.summary || {};
  const weights = learning?.weights || {};
  const actions = [];

  if (summary.roi < -0.05) {
    actions.push({
      type: "risk_control",
      action: "reduce_paper_exposure",
      severity: "high",
      note: "Negative ROI detected in tracked paper results. Lower simulated exposure until the signal improves."
    });
  }

  if (Number(clvSummary?.averageCLVPercent || 0) < -1) {
    actions.push({
      type: "price_quality",
      action: "tighten_entry_rules",
      severity: "high",
      note: "Average CLV is negative. Improve price quality and avoid stale prices."
    });
  }

  if (Number(clvSummary?.averageCLVPercent || 0) > 1) {
    actions.push({
      type: "price_quality",
      action: "reward_positive_clv_profiles",
      severity: "positive",
      note: "Positive CLV profile detected. Similar analytical profiles can receive more model confidence."
    });
  }

  if (weights.riskMode === "defensive") {
    actions.push({
      type: "risk_mode",
      action: "defensive_mode",
      severity: "medium",
      note: "Prioritize only the highest-grade paper picks and reduce watchlist exposure."
    });
  }

  if (weights.riskMode === "aggressive") {
    actions.push({
      type: "risk_mode",
      action: "higher_confidence_mode",
      severity: "positive",
      note: "Tracked results support slightly higher confidence on high-grade analytical picks."
    });
  }

  const weakLeagues = (learning.leagueWeights || [])
    .filter((item) => item.count >= 3 && item.weight < 0.9)
    .slice(0, 5);

  for (const league of weakLeagues) {
    actions.push({
      type: "league_filter",
      action: "reduce_league_weight",
      severity: "medium",
      target: league.name,
      weight: league.weight,
      note: `Reduce analytical confidence for ${league.name} until tracked results improve.`
    });
  }

  const highRiskPicks = picks.filter((pick) => pick.riskLevel === "High" || pick.readiness?.level === "Low");
  if (highRiskPicks.length) {
    actions.push({
      type: "pick_filter",
      action: "monitor_high_risk_picks",
      severity: "medium",
      count: highRiskPicks.length,
      note: "High-risk or low-readiness picks should stay in observation mode."
    });
  }

  if (!actions.length) {
    actions.push({
      type: "status",
      action: "continue_tracking",
      severity: "neutral",
      note: "No major feedback action needed. Continue collecting settled paper records."
    });
  }

  return actions;
}
