const HOUR_MS = 60 * 60 * 1000;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value) {
  return String(value || "").trim();
}

function eventId(item = {}) {
  return text(item.event_id || item.eventId || item.gameId || item.id);
}

function selectionKey(item = {}) {
  return `${eventId(item)}::${text(item.market || item.marketKey || "h2h").toLowerCase()}::${text(item.selection || item.label).toLowerCase()}`;
}

function normalizedDecision(item = {}) {
  const value = text(item.productDecision || item.decision || item.added_decision).toUpperCase();
  if (value === "PLAY") return "PLAY";
  if (value === "SKIP") return "SKIP";
  if (value === "CAUTION") return "CAUTION";
  return "WATCH";
}

function readiness(item = {}) {
  return text(item.sportsIntelligence?.readiness?.level || item.intelligenceReadiness?.level || "market-only").toLowerCase() || "market-only";
}

function independentEvidenceVerified(item = {}) {
  return item.sportsIntelligence?.readiness?.allowsIndependentPlayEvidence === true;
}

function kickoff(item = {}) {
  const timestamp = Date.parse(String(item.commence_time || item.commenceTime || ""));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function alert(id, type, severity, title, message, item, details = {}) {
  return {
    id,
    type,
    severity,
    title,
    message,
    watchlistId: item.id,
    eventId: item.event_id,
    selection: item.selection,
    match: item.match,
    commenceTime: item.commence_time,
    ...details
  };
}

function marketGateState(current = {}) {
  const edge = number(current.edge);
  const ev = number(current.ev);
  const confidence = number(current.confidence);
  const bookmakerCount = number(current.bookmakerCount);
  const freshness = text(current.freshnessLabel || current.dataQuality?.freshness || "unknown").toLowerCase();
  return {
    edge,
    ev,
    confidence,
    bookmakerCount,
    freshness,
    ready: edge >= 0.02 && ev >= 0.03 && confidence >= 0.55 && bookmakerCount >= 4 && freshness !== "stale"
  };
}

export function buildWatchlistState({ items = [], currentPicks = [], now = Date.now() } = {}) {
  const currentByKey = new Map(
    (Array.isArray(currentPicks) ? currentPicks : []).map((pick) => [selectionKey(pick), pick])
  );

  const resolved = (Array.isArray(items) ? items : []).map((item) => {
    const current = currentByKey.get(selectionKey(item)) || null;
    const alerts = [];
    const active = item.active !== false;
    const addedOdds = number(item.added_odds);
    const currentOdds = number(current?.odds);
    const moveThreshold = Math.max(0.005, Math.min(0.5, number(item.alert_move_percent, 0.05)));
    const kickoffAt = kickoff(item);
    const minutesToKickoff = kickoffAt === null ? null : (kickoffAt - now) / 60000;
    const addedDecision = normalizedDecision(item);
    const currentDecision = current ? normalizedDecision(current) : null;
    const consensusProbability = number(current?.consensusProbability ?? current?.modelProbability);
    const minimumPlayOdds = consensusProbability > 0 && consensusProbability < 1
      ? 1.03 / consensusProbability
      : null;
    const oddsMove = addedOdds > 1 && currentOdds > 1 ? (currentOdds - addedOdds) / addedOdds : null;
    const currentReadiness = current ? readiness(current) : null;
    const evidenceVerified = current ? independentEvidenceVerified(current) : false;
    const gates = current ? marketGateState(current) : null;

    if (active && minutesToKickoff !== null && minutesToKickoff > 0 && minutesToKickoff <= number(item.alert_before_minutes, 120)) {
      alerts.push(alert(
        `${item.id}-kickoff-soon`,
        "kickoff_soon",
        minutesToKickoff <= 30 ? "high" : "medium",
        "Kickoff is approaching",
        `The watched fixture starts in approximately ${Math.max(1, Math.round(minutesToKickoff))} minutes.`,
        item,
        { minutesToKickoff: Math.max(0, Math.round(minutesToKickoff)) }
      ));
    }

    if (active && current && currentDecision !== addedDecision) {
      const upgradedToPlay = currentDecision === "PLAY" && addedDecision !== "PLAY";
      const lostPlay = addedDecision === "PLAY" && currentDecision !== "PLAY";
      const severity = upgradedToPlay || lostPlay ? "high" : "medium";
      const title = upgradedToPlay
        ? `${addedDecision} → PLAY: all Scorecaster gates passed`
        : lostPlay
          ? `PLAY status was revoked: ${addedDecision} → ${currentDecision}`
          : "Scorecaster decision changed";
      const message = upgradedToPlay
        ? "The watched selection now passes Scorecaster's current market, data and independent-evidence gates. This remains paper-only decision support."
        : lostPlay
          ? "At least one current Scorecaster gate no longer supports PLAY. No real-money action was taken."
          : `The decision changed from ${addedDecision} to ${currentDecision}.`;
      alerts.push(alert(
        `${item.id}-decision-${currentDecision}`,
        "decision_changed",
        severity,
        title,
        message,
        item,
        {
          addedDecision,
          currentDecision,
          currentReadiness,
          evidenceVerified,
          currentEdge: gates?.edge ?? null,
          currentEv: gates?.ev ?? null,
          currentConfidence: gates?.confidence ?? null,
          bookmakerCount: gates?.bookmakerCount ?? null
        }
      ));
    }

    if (active && current && currentDecision === "CAUTION" && gates?.ready && !evidenceVerified) {
      alerts.push(alert(
        `${item.id}-evidence-gate-blocked`,
        "decision_changed",
        "medium",
        "PLAY blocked: independent evidence is not verified",
        `Market gates currently pass (edge ${(gates.edge * 100).toFixed(1)}%, EV ${(gates.ev * 100).toFixed(1)}%, confidence ${(gates.confidence * 100).toFixed(0)}%), but independent evidence is ${currentReadiness || "not verified"}. Scorecaster kept the selection at CAUTION.`,
        item,
        {
          addedDecision,
          currentDecision,
          currentReadiness,
          evidenceVerified,
          currentEdge: gates.edge,
          currentEv: gates.ev,
          currentConfidence: gates.confidence,
          bookmakerCount: gates.bookmakerCount,
          minimumPlayOdds
        }
      ));
    }

    if (
      active &&
      current &&
      currentDecision === "CAUTION" &&
      current.marketDecisionBeforeSafetyGate === "BET" &&
      evidenceVerified
    ) {
      alerts.push(alert(
        `${item.id}-safety-gate-blocked`,
        "decision_changed",
        "high",
        "PLAY blocked by the final safety check",
        "Market and independent-evidence gates reached the PLAY threshold, but a verified negative signal or unresolved evidence conflict still blocks PLAY.",
        item,
        {
          addedDecision,
          currentDecision,
          currentReadiness,
          evidenceVerified,
          currentEdge: gates?.edge ?? null,
          currentEv: gates?.ev ?? null,
          currentConfidence: gates?.confidence ?? null,
          bookmakerCount: gates?.bookmakerCount ?? null
        }
      ));
    }

    if (active && oddsMove !== null && Math.abs(oddsMove) >= moveThreshold) {
      alerts.push(alert(
        `${item.id}-price-move`,
        "price_moved",
        Math.abs(oddsMove) >= moveThreshold * 2 ? "high" : "medium",
        "Tracked price moved",
        `The available price moved from ${addedOdds.toFixed(2)} to ${currentOdds.toFixed(2)}.`,
        item,
        { addedOdds, currentOdds, oddsMove }
      ));
    }

    if (active && currentOdds > 1 && minimumPlayOdds && currentOdds < minimumPlayOdds) {
      alerts.push(alert(
        `${item.id}-below-play-floor`,
        "below_play_price",
        "high",
        "Price no longer meets the 3% EV floor",
        `Current odds ${currentOdds.toFixed(2)} are below the calculated 3% EV floor ${minimumPlayOdds.toFixed(2)}.`,
        item,
        { currentOdds, minimumPlayOdds }
      ));
    }

    if (active && !current && minutesToKickoff !== null && minutesToKickoff > -120) {
      alerts.push(alert(
        `${item.id}-market-unavailable`,
        "market_unavailable",
        "info",
        "Current market is unavailable",
        "The live provider did not return a matching current market. No replacement data was invented.",
        item
      ));
    }

    if (active && kickoffAt !== null && kickoffAt < now - 2 * HOUR_MS) {
      alerts.push(alert(
        `${item.id}-fixture-passed`,
        "fixture_passed",
        "info",
        "Fixture has passed the watch window",
        "The scheduled start time has passed. Result tracking remains separate from watchlist alerts.",
        item
      ));
    }

    return {
      ...item,
      active,
      current: current ? {
        odds: currentOdds,
        decision: currentDecision,
        edge: gates.edge,
        ev: gates.ev,
        confidence: gates.confidence,
        trustScore: number(current.trustScore),
        bookmaker: text(current.bookmaker),
        bookmakerCount: gates.bookmakerCount,
        freshness: gates.freshness,
        readiness: currentReadiness,
        evidenceVerified,
        marketGateReady: gates.ready,
        generatedAt: current.generatedAt || null,
        minimumPlayOdds
      } : null,
      oddsMove,
      minutesToKickoff,
      alerts
    };
  });

  const alerts = resolved
    .flatMap((item) => item.alerts)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  return {
    items: resolved,
    alerts,
    summary: {
      watched: resolved.length,
      active: resolved.filter((item) => item.active).length,
      alerts: alerts.length,
      high: alerts.filter((item) => item.severity === "high").length,
      medium: alerts.filter((item) => item.severity === "medium").length,
      info: alerts.filter((item) => item.severity === "info").length
    }
  };
}

function severityRank(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}
