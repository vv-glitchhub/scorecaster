const DECISION_WEIGHT = { SKIP: 0, CAUTION: 1, PLAY: 2 };
const READINESS_WEIGHT = { "market-only": 0, partial: 1, verified: 2 };

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function recommendationKey(item = {}) {
  return [
    item.eventId || item.id || item.match || "unknown-event",
    item.marketKey || "market",
    item.selection || "selection",
    item.point ?? ""
  ].join("::");
}

export function minimumPlayOdds(item = {}) {
  const fairOdds = finite(item.fairOdds, 0);
  if (fairOdds <= 1) return null;
  return Number((fairOdds * 1.03).toFixed(3));
}

export function snapshotRecommendationFeed(feed = {}) {
  const items = (Array.isArray(feed.recommendations) ? feed.recommendations : [])
    .slice(0, 12)
    .map((item) => ({
      key: recommendationKey(item),
      id: item.id || null,
      eventId: item.eventId || null,
      match: item.match || null,
      selection: item.selection || null,
      marketKey: item.marketKey || null,
      point: item.point ?? null,
      rank: finite(item.rank, 0),
      decision: item.decision || "CAUTION",
      score: finite(item.score, 0),
      odds: finite(item.odds, 0),
      fairOdds: finite(item.fairOdds, 0),
      minimumPlayOdds: minimumPlayOdds(item),
      edge: finite(item.edge, 0),
      ev: finite(item.ev, 0),
      confidence: finite(item.confidence, 0),
      bookmakerCount: finite(item.bookmakerCount, 0),
      readiness: item.readiness || "market-only"
    }));

  return {
    version: "scorecaster-recommendation-snapshot-v1",
    capturedAt: feed.generatedAt || new Date().toISOString(),
    topKey: items[0]?.key || null,
    items
  };
}

function pushChange(changes, change) {
  changes.push({
    version: "scorecaster-recommendation-change-v1",
    severity: "info",
    ...change
  });
}

function compareItem(previous, current, changes) {
  const currentDecision = current.decision || "CAUTION";
  const previousDecision = previous.decision || "CAUTION";
  const decisionDelta = (DECISION_WEIGHT[currentDecision] ?? 1) - (DECISION_WEIGHT[previousDecision] ?? 1);

  if (decisionDelta !== 0) {
    pushChange(changes, {
      type: decisionDelta > 0 ? "decision-upgrade" : "decision-downgrade",
      severity: currentDecision === "PLAY" || previousDecision === "PLAY" ? "high" : "medium",
      key: current.key,
      match: current.match,
      selection: current.selection,
      from: previousDecision,
      to: currentDecision
    });
  }

  const readinessDelta = (READINESS_WEIGHT[current.readiness] ?? 0) - (READINESS_WEIGHT[previous.readiness] ?? 0);
  if (readinessDelta !== 0) {
    pushChange(changes, {
      type: readinessDelta > 0 ? "evidence-upgrade" : "evidence-downgrade",
      severity: current.readiness === "verified" || previous.readiness === "verified" ? "high" : "medium",
      key: current.key,
      match: current.match,
      selection: current.selection,
      from: previous.readiness,
      to: current.readiness
    });
  }

  const previousPriceGate = previous.minimumPlayOdds && previous.odds >= previous.minimumPlayOdds;
  const currentPriceGate = current.minimumPlayOdds && current.odds >= current.minimumPlayOdds;
  if (Boolean(previousPriceGate) !== Boolean(currentPriceGate)) {
    pushChange(changes, {
      type: currentPriceGate ? "price-gate-open" : "price-gate-lost",
      severity: "high",
      key: current.key,
      match: current.match,
      selection: current.selection,
      odds: current.odds,
      threshold: current.minimumPlayOdds
    });
  }

  const edgeWasOpen = previous.edge >= 0.02;
  const edgeIsOpen = current.edge >= 0.02;
  if (edgeWasOpen !== edgeIsOpen) {
    pushChange(changes, {
      type: edgeIsOpen ? "edge-gate-open" : "edge-gate-lost",
      severity: "medium",
      key: current.key,
      match: current.match,
      selection: current.selection,
      from: previous.edge,
      to: current.edge,
      threshold: 0.02
    });
  }

  const evWasOpen = previous.ev >= 0.03;
  const evIsOpen = current.ev >= 0.03;
  if (evWasOpen !== evIsOpen) {
    pushChange(changes, {
      type: evIsOpen ? "ev-gate-open" : "ev-gate-lost",
      severity: "medium",
      key: current.key,
      match: current.match,
      selection: current.selection,
      from: previous.ev,
      to: current.ev,
      threshold: 0.03
    });
  }

  if (previous.odds > 1 && current.odds > 1) {
    const relativeMove = (current.odds - previous.odds) / previous.odds;
    if (Math.abs(relativeMove) >= 0.03) {
      pushChange(changes, {
        type: relativeMove > 0 ? "price-improved" : "price-shortened",
        severity: Math.abs(relativeMove) >= 0.08 ? "medium" : "info",
        key: current.key,
        match: current.match,
        selection: current.selection,
        from: previous.odds,
        to: current.odds,
        relativeMove
      });
    }
  }

  if (previous.rank > 0 && current.rank > 0 && Math.abs(current.rank - previous.rank) >= 2) {
    pushChange(changes, {
      type: current.rank < previous.rank ? "rank-up" : "rank-down",
      severity: "info",
      key: current.key,
      match: current.match,
      selection: current.selection,
      from: previous.rank,
      to: current.rank
    });
  }
}

export function compareRecommendationSnapshots(previousSnapshot, currentSnapshot) {
  if (!currentSnapshot?.items?.length) {
    return { version: "scorecaster-recommendation-radar-v1", changes: [], topChange: null, hasMaterialChange: false };
  }
  if (!previousSnapshot?.items?.length) {
    return { version: "scorecaster-recommendation-radar-v1", changes: [], topChange: null, hasMaterialChange: false };
  }

  const changes = [];
  const previousByKey = new Map(previousSnapshot.items.map((item) => [item.key, item]));

  if (previousSnapshot.topKey && currentSnapshot.topKey && previousSnapshot.topKey !== currentSnapshot.topKey) {
    const currentLeader = currentSnapshot.items.find((item) => item.key === currentSnapshot.topKey);
    pushChange(changes, {
      type: "new-leader",
      severity: currentLeader?.decision === "PLAY" ? "high" : "medium",
      key: currentSnapshot.topKey,
      match: currentLeader?.match || null,
      selection: currentLeader?.selection || null,
      from: previousSnapshot.topKey,
      to: currentSnapshot.topKey
    });
  }

  for (const current of currentSnapshot.items) {
    const previous = previousByKey.get(current.key);
    if (!previous) continue;
    compareItem(previous, current, changes);
  }

  const severityWeight = { high: 3, medium: 2, info: 1 };
  changes.sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0));

  return {
    version: "scorecaster-recommendation-radar-v1",
    changes,
    topChange: changes[0] || null,
    hasMaterialChange: changes.some((item) => item.severity === "high" || item.severity === "medium")
  };
}
