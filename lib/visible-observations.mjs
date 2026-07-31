import { buildDecisionTransparency } from "./decision-transparency.mjs";

const number = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const dateValue = (value) => {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Builds honest, publishable cards when the stricter Daily Top 3 pipeline has
 * no output. The function never invents a model probability or upgrades a
 * verdict. It only summarizes publishable collector records.
 */
export function buildVisibleObservations(events = [], { now = Date.now(), limit = 12 } = {}) {
  return events
    .map((event) => {
      const explanation = buildDecisionTransparency(
        Array.isArray(event.records) ? event.records : [],
        { eventId: event.eventId },
        now
      );
      const calculations = explanation.calculations || {};
      const components = calculations.components || {};
      const hasMarketEvidence = calculations.marketProbability !== null || calculations.bestDecimalOdds !== null;
      const hasModelEvidence = calculations.modelProbability !== null;
      const hasUsableEvidence = hasMarketEvidence || hasModelEvidence;

      if (!hasUsableEvidence) return null;

      return {
        eventId: event.eventId,
        decision: explanation.verdict || "SKIP",
        reason: explanation.summary,
        score: number(calculations.rankingScore, 0),
        edge: calculations.edge,
        quality: number(calculations.quality, 0),
        bestOdds: calculations.bestDecimalOdds,
        marketProbability: calculations.marketProbability,
        modelProbability: calculations.modelProbability,
        expectedValue: calculations.expectedValuePerUnit,
        sources: number(components.uniqueSourceCount, explanation.sources?.length || 0),
        missing: explanation.missingInputs || [],
        explanation,
        latestAt: event.latestAt || explanation.generatedAt,
        observationType: hasModelEvidence ? "model-and-market" : "market-only",
        fallback: true
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const decisionWeight = { WATCH: 3, CAUTION: 2, SKIP: 1 };
      const decisionDelta = (decisionWeight[right.decision] || 0) - (decisionWeight[left.decision] || 0);
      if (decisionDelta) return decisionDelta;
      const scoreDelta = number(right.score, 0) - number(left.score, 0);
      if (scoreDelta) return scoreDelta;
      const qualityDelta = number(right.quality, 0) - number(left.quality, 0);
      if (qualityDelta) return qualityDelta;
      return dateValue(right.latestAt) - dateValue(left.latestAt);
    })
    .slice(0, Math.max(1, Math.min(50, number(limit, 12))));
}

export function withVisibleDailyTop3(controlCenter = {}, observations = []) {
  const existing = Array.isArray(controlCenter.dailyTop3) ? controlCenter.dailyTop3 : [];
  if (existing.length) return controlCenter;

  const dailyTop3 = observations.slice(0, 3);
  const summary = {
    ...(controlCenter.summary || {}),
    totalCards: dailyTop3.length,
    watchCards: dailyTop3.filter((item) => item.decision === "WATCH").length,
    cautionCards: dailyTop3.filter((item) => item.decision === "CAUTION").length,
    skipCards: dailyTop3.filter((item) => item.decision === "SKIP").length,
    fallbackCards: dailyTop3.length,
    fallbackReason: dailyTop3.length
      ? "Strict Daily Top 3 gates produced no cards, so publishable market/model observations are shown without upgrading their verdicts."
      : "No publishable market or model evidence was available."
  };

  return {
    ...controlCenter,
    dailyTop3,
    summary,
    fallbackActive: dailyTop3.length > 0
  };
}
