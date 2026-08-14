export const MATCH_STORY_VERSION = "scorecaster-match-story-v1";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedResult(value) {
  const result = String(value || "pending").toLowerCase();
  return ["win", "loss", "push"].includes(result) ? result : "pending";
}

function normalizedDecision(value) {
  const decision = String(value || "CAUTION").toUpperCase();
  if (decision === "BET") return "PLAY";
  if (decision === "PASS") return "SKIP";
  return ["PLAY", "CAUTION", "SKIP"].includes(decision) ? decision : "CAUTION";
}

function priceState(clv) {
  if (clv === null) return "unavailable";
  if (clv > 0.005) return "positive";
  if (clv < -0.005) return "negative";
  return "neutral";
}

function storyVerdict(result, clvState) {
  if (result === "pending") return "awaiting-settlement";
  if (result === "push") return clvState === "unavailable" ? "neutral-result-only" : "neutral-outcome";
  if (clvState === "unavailable") return "result-only";
  if (result === "win" && clvState === "positive") return "process-and-outcome-aligned";
  if (result === "loss" && clvState === "positive") return "price-over-outcome";
  if (result === "win" && clvState === "negative") return "outcome-over-price";
  if (result === "loss" && clvState === "negative") return "process-and-outcome-negative";
  return "mixed-single-event";
}

function learningFocus(result, clvState) {
  if (result === "pending") return "await-settlement";
  if (clvState === "unavailable") return "capture-closing-price";
  if (result === "loss" && clvState === "positive") return "protect-process-from-outcome-bias";
  if (result === "win" && clvState === "negative") return "review-entry-price-despite-win";
  if (result === "loss" && clvState === "negative") return "review-entry-and-evidence";
  if (result === "win" && clvState === "positive") return "repeat-process-not-result";
  return "collect-more-samples";
}

export function buildMatchStoryV1(bet = {}) {
  const result = normalizedResult(bet.result);
  const entryCandidate = finite(bet.odds);
  const closingCandidate = finite(bet.closingOdds);
  const entryOdds = entryCandidate !== null && entryCandidate > 1 ? entryCandidate : null;
  const closingOdds = closingCandidate !== null && closingCandidate > 1 ? closingCandidate : null;
  const clv = entryOdds !== null && closingOdds !== null ? entryOdds / closingOdds - 1 : null;
  const clvState = priceState(clv);
  const stakeCandidate = finite(bet.stake);
  const stake = stakeCandidate !== null && stakeCandidate >= 0 ? stakeCandidate : null;
  const profit = result === "pending" || stake === null || entryOdds === null
    ? null
    : result === "win"
      ? stake * (entryOdds - 1)
      : result === "loss"
        ? -stake
        : 0;
  const missing = [];
  if (entryOdds === null) missing.push("entry-odds");
  if (closingOdds === null) missing.push("closing-odds");
  if (result === "pending") missing.push("settled-result");

  return {
    version: MATCH_STORY_VERSION,
    status: result === "pending" ? "awaiting-settlement" : "settled",
    result,
    verdict: storyVerdict(result, clvState),
    decisionSnapshot: {
      decision: normalizedDecision(bet.decision),
      entryOdds,
      edge: finite(bet.edge),
      ev: finite(bet.ev),
      confidence: finite(bet.confidence),
      modelProbability: finite(bet.modelProbability),
      marketProbability: finite(bet.marketProbability)
    },
    outcome: {
      state: result === "pending" ? "pending" : result === "win" ? "positive" : result === "loss" ? "negative" : "neutral",
      profit
    },
    priceProcess: {
      state: clvState,
      closingOdds,
      clv
    },
    learning: {
      focus: learningFocus(result, clvState),
      sampleConclusion: "single-event-only",
      probabilityChanged: false,
      automaticModelPromotion: false,
      automaticWeightChange: false
    },
    missing,
    contract: {
      paperOnly: true,
      resultDoesNotProveModelSkill: true,
      missingClosingOddsImputed: false,
      humanReviewRequired: true
    }
  };
}
