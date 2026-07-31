const DEFAULT_THRESHOLDS = Object.freeze({
  odds: 0.02,
  edge: 0.005,
  ev: 0.005,
  confidence: 0.03
});

const SEVERITY_WEIGHT = Object.freeze({
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
});

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

export function normalizeMarketDecision(pick) {
  const raw = text(pick?.productDecision || pick?.decision, "CAUTION").toUpperCase();
  if (raw === "BET") return "PLAY";
  if (raw === "PASS") return "SKIP";
  if (raw === "WAIT") return "WATCH";
  if (["PLAY", "WATCH", "CAUTION", "SKIP"].includes(raw)) return raw;
  return "CAUTION";
}

export function marketPickKey(pick) {
  const eventIdentity = text(
    pick?.eventId || pick?.id || pick?.gameId,
    `${text(pick?.homeTeam, "home")}|${text(pick?.awayTeam, "away")}|${text(pick?.commenceTime, "time")}`
  );
  const market = text(pick?.market || pick?.marketKey || pick?.marketType, "h2h");
  const selection = text(pick?.selection || pick?.label || pick?.outcome, "selection");
  return `${eventIdentity}::${market}::${selection}`.toLowerCase();
}

export function normalizeMarketPick(pick) {
  return {
    key: marketPickKey(pick),
    eventId: text(pick?.eventId || pick?.id || pick?.gameId),
    match: text(pick?.match, `${text(pick?.homeTeam, "Home")} – ${text(pick?.awayTeam, "Away")}`),
    homeTeam: text(pick?.homeTeam),
    awayTeam: text(pick?.awayTeam),
    league: text(pick?.leagueTitle || pick?.league, "Sport"),
    commenceTime: text(pick?.commenceTime),
    market: text(pick?.market || pick?.marketKey || pick?.marketType, "h2h"),
    selection: text(pick?.selection || pick?.label || pick?.outcome, "Selection"),
    decision: normalizeMarketDecision(pick),
    odds: finiteOrNull(pick?.odds),
    edge: finiteOrNull(pick?.edge),
    ev: finiteOrNull(pick?.ev),
    confidence: finiteOrNull(pick?.confidence),
    bookmakerCount: finiteOrNull(pick?.bookmakerCount) ?? 0,
    reason: text(
      pick?.evidenceGateReason || pick?.decisionReason,
      "Market consensus and safety gates formed the current classification."
    )
  };
}

export function createMarketSnapshot({ picks = [], generatedAt = null, source = "unknown", savedAt = null } = {}) {
  const normalized = Array.isArray(picks) ? picks.map(normalizeMarketPick) : [];
  const unique = Array.from(new Map(normalized.map((pick) => [pick.key, pick])).values());

  return {
    version: 1,
    savedAt: savedAt || new Date().toISOString(),
    generatedAt: generatedAt || null,
    source: text(source, "unknown"),
    picks: unique
  };
}

function numericChange(field, previous, current, threshold) {
  if (previous === null || current === null) return null;
  const delta = current - previous;
  if (Math.abs(delta) < threshold) return null;
  return { field, previous, current, delta };
}

function changeSeverity({ decisionChange, numericChanges }) {
  if (decisionChange && [decisionChange.previous, decisionChange.current].includes("PLAY")) return "critical";
  if (decisionChange) return "high";

  const odds = numericChanges.find((change) => change.field === "odds");
  const edge = numericChanges.find((change) => change.field === "edge");
  const ev = numericChanges.find((change) => change.field === "ev");

  if (Math.abs(odds?.delta || 0) >= 0.1 || Math.abs(edge?.delta || 0) >= 0.03 || Math.abs(ev?.delta || 0) >= 0.03) {
    return "high";
  }
  return numericChanges.length ? "medium" : "low";
}

function changedPick(previous, current, thresholds) {
  const decisionChange = previous.decision !== current.decision
    ? { field: "decision", previous: previous.decision, current: current.decision }
    : null;

  const numericChanges = [
    numericChange("odds", previous.odds, current.odds, thresholds.odds),
    numericChange("edge", previous.edge, current.edge, thresholds.edge),
    numericChange("ev", previous.ev, current.ev, thresholds.ev),
    numericChange("confidence", previous.confidence, current.confidence, thresholds.confidence)
  ].filter(Boolean);

  const bookmakerChange = previous.bookmakerCount !== current.bookmakerCount
    ? {
        field: "bookmakerCount",
        previous: previous.bookmakerCount,
        current: current.bookmakerCount,
        delta: current.bookmakerCount - previous.bookmakerCount
      }
    : null;

  if (!decisionChange && !numericChanges.length && !bookmakerChange) return null;

  const fields = [
    ...(decisionChange ? [decisionChange] : []),
    ...numericChanges,
    ...(bookmakerChange ? [bookmakerChange] : [])
  ];

  return {
    key: current.key,
    kind: decisionChange ? "decision" : numericChanges.some((change) => change.field === "odds") ? "price" : "metric",
    severity: changeSeverity({ decisionChange, numericChanges }),
    previous,
    current,
    fields
  };
}

export function compareMarketSnapshots(previousSnapshot, currentSnapshot, customThresholds = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };
  const previousPicks = Array.isArray(previousSnapshot?.picks) ? previousSnapshot.picks : [];
  const currentPicks = Array.isArray(currentSnapshot?.picks) ? currentSnapshot.picks : [];

  if (!previousSnapshot) {
    return {
      baselineMissing: true,
      thresholds,
      changes: [],
      summary: {
        total: 0,
        decision: 0,
        price: 0,
        metric: 0,
        new: 0,
        removed: 0,
        critical: 0,
        high: 0
      }
    };
  }

  const previousByKey = new Map(previousPicks.map((pick) => [pick.key, pick]));
  const currentByKey = new Map(currentPicks.map((pick) => [pick.key, pick]));
  const changes = [];

  for (const current of currentPicks) {
    const previous = previousByKey.get(current.key);
    if (!previous) {
      changes.push({
        key: current.key,
        kind: "new",
        severity: current.decision === "PLAY" ? "critical" : "medium",
        previous: null,
        current,
        fields: []
      });
      continue;
    }

    const change = changedPick(previous, current, thresholds);
    if (change) changes.push(change);
  }

  for (const previous of previousPicks) {
    if (currentByKey.has(previous.key)) continue;
    changes.push({
      key: previous.key,
      kind: "removed",
      severity: previous.decision === "PLAY" ? "high" : "low",
      previous,
      current: null,
      fields: []
    });
  }

  changes.sort((a, b) => {
    const severityDelta = (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0);
    if (severityDelta) return severityDelta;
    const kindWeight = { decision: 5, new: 4, price: 3, metric: 2, removed: 1 };
    return (kindWeight[b.kind] || 0) - (kindWeight[a.kind] || 0);
  });

  return {
    baselineMissing: false,
    thresholds,
    changes,
    summary: {
      total: changes.length,
      decision: changes.filter((change) => change.kind === "decision").length,
      price: changes.filter((change) => change.kind === "price").length,
      metric: changes.filter((change) => change.kind === "metric").length,
      new: changes.filter((change) => change.kind === "new").length,
      removed: changes.filter((change) => change.kind === "removed").length,
      critical: changes.filter((change) => change.severity === "critical").length,
      high: changes.filter((change) => change.severity === "high").length
    }
  };
}

export { DEFAULT_THRESHOLDS };
