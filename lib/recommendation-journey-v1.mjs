export const RECOMMENDATION_JOURNEY_VERSION = "scorecaster-recommendation-journey-v1";

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function pointIdentity(point = {}) {
  return `${point.eventId || point.event_id || ""}::${point.selection || ""}`;
}

function crossed(previous, current, threshold) {
  const left = finite(previous);
  const right = finite(current);
  if (left === null || right === null) return null;
  if (left < threshold && right >= threshold) return "opened";
  if (left >= threshold && right < threshold) return "lost";
  return null;
}

function event(type, severity, point, details = {}) {
  return {
    type,
    severity,
    capturedAt: iso(point.capturedAt || point.captured_at),
    odds: finite(point.odds),
    decision: String(point.decision || "WATCH").toUpperCase(),
    edge: finite(point.edge),
    ev: finite(point.ev),
    confidence: finite(point.confidence),
    bookmaker: point.bookmaker || null,
    ...details
  };
}

export function buildRecommendationJourney(timeline = {}, currentRecommendation = null) {
  const points = (Array.isArray(timeline?.points) ? timeline.points : [])
    .filter((point) => iso(point.capturedAt || point.captured_at))
    .sort((a, b) => Date.parse(a.capturedAt || a.captured_at) - Date.parse(b.capturedAt || b.captured_at));

  const events = [];
  if (points.length) {
    events.push(event("first-observation", "info", points[0], { label: "First verified observation" }));
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const previousDecision = String(previous.decision || "WATCH").toUpperCase();
    const currentDecision = String(current.decision || "WATCH").toUpperCase();
    if (previousDecision !== currentDecision) {
      events.push(event("decision-change", currentDecision === "PLAY" || previousDecision === "PLAY" ? "high" : "medium", current, {
        label: `${previousDecision} → ${currentDecision}`,
        previousDecision,
        currentDecision
      }));
    }

    const previousOdds = finite(previous.odds);
    const currentOdds = finite(current.odds);
    if (previousOdds && currentOdds) {
      const relativeMove = currentOdds / previousOdds - 1;
      if (Math.abs(relativeMove) >= 0.03) {
        events.push(event("price-move", Math.abs(relativeMove) >= 0.06 ? "high" : "medium", current, {
          label: `Odds ${previousOdds.toFixed(2)} → ${currentOdds.toFixed(2)}`,
          previousOdds,
          currentOdds,
          relativeMove
        }));
      }
    }

    for (const [field, threshold, type] of [["edge", 0.02, "edge-gate"], ["ev", 0.03, "ev-gate"], ["confidence", 0.55, "confidence-gate"]]) {
      const direction = crossed(previous[field], current[field], threshold);
      if (direction) {
        events.push(event(type, direction === "lost" ? "high" : "medium", current, {
          label: `${field.toUpperCase()} gate ${direction}`,
          direction,
          threshold,
          previousValue: finite(previous[field]),
          currentValue: finite(current[field])
        }));
      }
    }

    if (previous.bookmaker && current.bookmaker && previous.bookmaker !== current.bookmaker) {
      events.push(event("best-bookmaker-change", "info", current, {
        label: `Best price source ${previous.bookmaker} → ${current.bookmaker}`,
        previousBookmaker: previous.bookmaker,
        currentBookmaker: current.bookmaker
      }));
    }
  }

  const current = currentRecommendation ? {
    decision: currentRecommendation.decision || null,
    rank: currentRecommendation.rank || null,
    score: finite(currentRecommendation.score),
    odds: finite(currentRecommendation.odds),
    fairOdds: finite(currentRecommendation.fairOdds),
    minimumEvOdds: finite(currentRecommendation.minimumEvOdds),
    edge: finite(currentRecommendation.edge),
    ev: finite(currentRecommendation.ev),
    confidence: finite(currentRecommendation.confidence),
    bookmakerCount: finite(currentRecommendation.bookmakerCount),
    readiness: currentRecommendation.readiness || null,
    freshness: currentRecommendation.freshness || null,
    nextGate: currentRecommendation.nextGate || null,
    nearPlay: currentRecommendation.intelligenceV2?.nearPlay === true,
    visiblePlayGates: currentRecommendation.intelligenceV2?.visiblePlayGates || [],
    paperOnly: true
  } : null;

  return {
    version: RECOMMENDATION_JOURNEY_VERSION,
    status: points.length ? "available" : "empty",
    identity: points.length ? pointIdentity(points.at(-1)) : null,
    eventId: timeline?.eventId || points.at(-1)?.eventId || null,
    selection: timeline?.selection || points.at(-1)?.selection || null,
    points,
    events,
    current,
    summary: {
      observations: points.length,
      journeyEvents: events.length,
      decisionChanges: events.filter((item) => item.type === "decision-change").length,
      significantPriceMoves: events.filter((item) => item.type === "price-move").length,
      gateChanges: events.filter((item) => item.type.endsWith("-gate")).length,
      firstCapturedAt: points[0]?.capturedAt || null,
      lastCapturedAt: points.at(-1)?.capturedAt || null
    },
    historicalEvidenceReadinessStored: false,
    limitation: "Historical snapshots contain verified market/decision/edge/EV/confidence state. Historical independent-evidence readiness is not reconstructed; only the current verified readiness is shown.",
    decisionUpgradeAllowed: false,
    probabilityAdjusted: false,
    paperOnly: true,
    realMoneyActionAvailable: false
  };
}
