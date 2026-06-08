export function buildAlertsV1({ liveMarket = {}, picks = [] } = {}) {
  const feeds = liveMarket?.feeds || {};
  const summary = liveMarket?.summary || {};
  const safePicks = Array.isArray(picks) ? picks : [];

  const alerts = [
    ...buildSteamAlerts(feeds.steamMoves || []),
    ...buildSharpAlerts(feeds.strongestSharpSignals || []),
    ...buildCLVAlerts(feeds.positiveCLV || [], feeds.negativeCLV || []),
    ...buildValueAlerts(safePicks),
    ...buildRiskAlerts({ summary, picks: safePicks })
  ]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || Number(b.score || 0) - Number(a.score || 0))
    .map((alert, index) => ({ ...alert, rank: index + 1 }));

  return {
    ok: true,
    source: "notifications-alerts-v1",
    generatedAt: new Date().toISOString(),
    summary: summarizeAlerts(alerts),
    alerts,
    critical: alerts.filter((item) => item.severity === "critical"),
    high: alerts.filter((item) => item.severity === "high"),
    medium: alerts.filter((item) => item.severity === "medium"),
    info: alerts.filter((item) => item.severity === "info")
  };
}

function buildSteamAlerts(items) {
  return items.map((item) => ({
    id: buildAlertId("steam", item),
    type: "steam_alert",
    severity: Number(item.confidence || 0) >= 0.75 ? "high" : "medium",
    title: "Steam move detected",
    message: `${item.selection || "Selection"} moved ${toPercent(item.movementPercent)} with ${item.pressure || "neutral"} pressure.`,
    score: clamp(Number(item.confidence || 0) * 100, 0, 100),
    gameId: item.gameId,
    league: item.league,
    marketKey: item.marketKey,
    selection: item.selection,
    bookmaker: item.bookmaker,
    payload: item
  }));
}

function buildSharpAlerts(items) {
  return items.map((item) => ({
    id: buildAlertId("sharp", item),
    type: "sharp_alert",
    severity: Number(item.sharpIndex || 0) >= 90 ? "critical" : "high",
    title: "Strong sharp index",
    message: `${item.selection || "Selection"} has sharp index ${Number(item.sharpIndex || 0).toFixed(1)} / 100.`,
    score: Number(item.sharpIndex || 0),
    gameId: item.id,
    league: item.league,
    marketKey: item.marketKey,
    selection: item.selection,
    bookmaker: item.bookmaker,
    payload: item
  }));
}

function buildCLVAlerts(positiveItems, negativeItems) {
  const positive = positiveItems
    .filter((item) => Number(item.clvPercent || 0) >= 1)
    .map((item) => ({
      id: buildAlertId("clv-positive", item),
      type: "clv_alert",
      severity: Number(item.clvPercent || 0) >= 3 ? "high" : "medium",
      title: "Positive CLV profile",
      message: `${item.selection || "Selection"} shows positive CLV of ${Number(item.clvPercent || 0).toFixed(1)}%.`,
      score: clamp(50 + Number(item.clvPercent || 0) * 10, 0, 100),
      gameId: item.game_id || item.gameId,
      league: item.league,
      marketKey: item.market_key || item.marketKey,
      selection: item.selection,
      bookmaker: item.bookmaker,
      payload: item
    }));

  const negative = negativeItems
    .filter((item) => Number(item.clvPercent || 0) <= -2)
    .map((item) => ({
      id: buildAlertId("clv-negative", item),
      type: "clv_alert",
      severity: "medium",
      title: "Negative CLV warning",
      message: `${item.selection || "Selection"} has negative CLV of ${Number(item.clvPercent || 0).toFixed(1)}%.`,
      score: clamp(50 + Math.abs(Number(item.clvPercent || 0)) * 10, 0, 100),
      gameId: item.game_id || item.gameId,
      league: item.league,
      marketKey: item.market_key || item.marketKey,
      selection: item.selection,
      bookmaker: item.bookmaker,
      payload: item
    }));

  return [...positive, ...negative];
}

function buildValueAlerts(picks) {
  return picks
    .filter((pick) => Number(pick.edge || 0) >= 0.05 || Number(pick.finalScore100 || 0) >= 84)
    .map((pick) => ({
      id: buildAlertId("value", pick),
      type: "value_alert",
      severity: Number(pick.finalScore100 || 0) >= 90 ? "high" : "medium",
      title: "High-value paper signal",
      message: `${pick.selection || "Selection"} has score ${Number(pick.finalScore100 || 0).toFixed(1)} and edge ${toPercent(pick.edge)}.`,
      score: Number(pick.finalScore100 || 0),
      gameId: pick.gameId || pick.id,
      league: pick.league || pick.leagueTitle,
      marketKey: pick.marketKey || pick.market,
      selection: pick.selection,
      bookmaker: pick.bookmaker,
      payload: pick
    }));
}

function buildRiskAlerts({ summary, picks }) {
  const alerts = [];
  const highRisk = picks.filter((pick) => pick.riskLevel === "High" || pick.exposure === "High");

  if (highRisk.length) {
    alerts.push({
      id: `risk-high-exposure-${highRisk.length}`,
      type: "risk_alert",
      severity: "medium",
      title: "High risk exposure detected",
      message: `${highRisk.length} paper picks have high risk or high exposure.`,
      score: clamp(highRisk.length * 12, 0, 100),
      payload: { highRisk }
    });
  }

  if (Number(summary?.steamMoves || 0) >= 5) {
    alerts.push({
      id: "risk-market-volatility",
      type: "risk_alert",
      severity: "medium",
      title: "Market volatility elevated",
      message: `${summary.steamMoves} steam-style moves detected in current feed.`,
      score: clamp(Number(summary.steamMoves || 0) * 12, 0, 100),
      payload: summary
    });
  }

  return alerts;
}

function summarizeAlerts(alerts) {
  return {
    count: alerts.length,
    critical: alerts.filter((item) => item.severity === "critical").length,
    high: alerts.filter((item) => item.severity === "high").length,
    medium: alerts.filter((item) => item.severity === "medium").length,
    info: alerts.filter((item) => item.severity === "info").length,
    byType: alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {})
  };
}

function severityRank(severity) {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function buildAlertId(prefix, item = {}) {
  return [prefix, item.gameId || item.game_id || item.id || "game", item.marketKey || item.market_key || item.market || "market", item.selection || "selection", item.bookmaker || "bookmaker"].join("-").toLowerCase().replace(/[^a-z0-9-_]+/g, "-");
}

function toPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
