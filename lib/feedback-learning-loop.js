import { buildAgentLearningV4 } from "./agent-learning-v4";
import { summarizeCLVHistory } from "./clv-engine";

export function runFeedbackLearningLoop({ records = [], picks = [] } = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const safePicks = Array.isArray(picks) ? picks : [];

  const clvSummary = summarizeCLVHistory(safeRecords);
  const learning = buildAgentLearningV4({ records: safeRecords, clvSummary: null });
  const feedback = buildFeedbackActions({ learning, clvSummary, picks: safePicks });

  return {
    ok: true,
    source: "feedback-learning-loop-v1-safe-clv-boundary",
    generatedAt: new Date().toISOString(),
    learning,
    clvSummary,
    feedback,
    nextWeights: learning.weights,
    riskMode: learning.weights?.riskMode || "balanced",
    clvUsedForAutomaticWeights: false,
    automaticModelPromotion: false,
    note: "Verified CLV and calibration evidence is reviewed in Calibration Lab and never promotes a model automatically."
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

  if (clvSummary?.evidenceReady && Number(clvSummary.averageCLVPercent) < -1) {
    actions.push({
      type: "price_quality_review",
      action: "review_entry_timing",
      severity: "high",
      note: "A sufficiently large verified CLV sample is negative. Review price timing manually; model weights are not changed automatically."
    });
  }

  if (clvSummary?.evidenceReady && Number(clvSummary.averageCLVPercent) > 1) {
    actions.push({
      type: "price_quality_review",
      action: "review_positive_clv_slice",
      severity: "positive",
      note: "A sufficiently large verified CLV sample is positive. Review the slice manually; automatic promotion remains disabled."
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
      note: "Tracked non-CLV paper evidence supports a higher-confidence shadow mode. CLV does not trigger this setting."
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
      note: `Reduce analytical confidence for ${league.name} until tracked paper results improve.`
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

  if (!clvSummary?.evidenceReady) {
    actions.push({
      type: "calibration_status",
      action: "continue_collecting_verified_closing_evidence",
      severity: "neutral",
      note: "CLV sample is missing or below the threshold. No model action is permitted."
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
