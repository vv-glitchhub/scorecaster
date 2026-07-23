import { scoreNewsCollection } from "./news-source-reliability.mjs";

const MAX_CONTEXT_IMPACT = 0.06;

function clean(value, limit = 220) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function optionalFinite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value)));
}

function round(value, digits = 4) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function normalizeDecision(pick = {}) {
  if (pick.productDecision === "PLAY" || pick.decision === "BET" || pick.decision === "PLAY") return "PLAY";
  if (pick.productDecision === "SKIP" || pick.decision === "PASS" || pick.decision === "SKIP") return "SKIP";
  return "CAUTION";
}

function selectionSide(pick = {}) {
  const selection = clean(pick.selection || pick.label, 160).toLowerCase();
  const home = clean(pick.homeTeam, 160).toLowerCase();
  const away = clean(pick.awayTeam, 160).toLowerCase();
  if (selection && home && (selection === home || selection.includes(home) || home.includes(selection))) return "home";
  if (selection && away && (selection === away || selection.includes(away) || away.includes(selection))) return "away";
  return null;
}

function ageHours(value, now) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? Math.max(0, (now - timestamp) / 3_600_000) : null;
}

function sourceItem({ id, name, type, trust, observedAt, mode, provider }) {
  return {
    id: clean(id || `${provider || name}:${observedAt || "unknown"}`, 220),
    name: clean(name || provider || "unknown", 120),
    provider: clean(provider || name || "unknown", 120),
    type: clean(type || "unknown", 60),
    trust: round(clamp(trust ?? 0.45, 0, 1), 3),
    observedAt: observedAt || null,
    mode: clean(mode || "live", 40)
  };
}

function factor({ key, title, status = "available", confidence = 0, trust = 0, impact = 0, direction = "neutral", useMode = "explanation", usedByAi = false, downgradeEligible = false, reason, sources = [], evidence = [], missing = [] }) {
  return {
    key,
    title,
    status,
    confidence: round(clamp(confidence, 0, 1), 3),
    trust: round(clamp(trust, 0, 1), 3),
    impact: round(clamp(impact, -MAX_CONTEXT_IMPACT, MAX_CONTEXT_IMPACT), 4),
    direction,
    useMode,
    usedByAi: Boolean(usedByAi),
    downgradeEligible: Boolean(downgradeEligible),
    reason: clean(reason, 500),
    sources,
    evidence,
    missing
  };
}

function primaryOddsFactor(pick = {}, secondary = null, side = null, now = Date.now()) {
  const primaryOdds = optionalFinite(pick.odds);
  const primaryAverage = optionalFinite(pick.marketAverageOdds || pick.averageOdds || pick.consensusOdds);
  const primaryCount = Math.max(0, finite(pick.bookmakerCount));
  const secondarySide = side ? secondary?.data?.[side] : null;
  const secondaryAverage = optionalFinite(secondarySide?.average);
  const providerAverages = [primaryAverage, secondaryAverage].filter((value) => value && value > 1);
  const disagreement = providerAverages.length >= 2
    ? Math.abs(providerAverages[0] - providerAverages[1]) / ((providerAverages[0] + providerAverages[1]) / 2)
    : null;
  const providerCount = 1 + (secondary?.mode === "live" && secondaryAverage ? 1 : 0);
  const confidence = clamp(
    finite(pick.confidence, 0.35) * 0.6 + Math.min(1, primaryCount / 8) * 0.25 + Math.min(1, providerCount / 2) * 0.15 - (disagreement || 0) * 0.6,
    0,
    1
  );
  const sources = [sourceItem({ id: "odds:primary", name: "The Odds API consensus", provider: "the-odds-api", type: "odds_market", trust: 0.82, observedAt: pick.lastUpdate || pick.commenceTime || new Date(now).toISOString() })];
  if (secondary?.mode === "live") sources.push(sourceItem({ id: "odds:secondary", name: "SportsGameOdds", provider: "sportsgameodds", type: "odds_market", trust: 0.82, observedAt: secondarySide?.latestAt || secondary.retrievedAt }));
  const evidence = [{ label: "selectedOdds", value: primaryOdds }, { label: "primaryMarketAverage", value: primaryAverage }, { label: "secondaryMarketAverage", value: secondaryAverage }, { label: "primaryBookmakers", value: primaryCount }, { label: "independentOddsProviders", value: providerCount }, { label: "providerDisagreement", value: disagreement === null ? null : round(disagreement, 4) }];
  return factor({
    key: "odds-consensus",
    title: "Multi-provider odds consensus",
    status: primaryOdds ? providerCount >= 2 ? "verified-multi-provider" : "primary-only" : "missing",
    confidence,
    trust: providerCount >= 2 ? 0.86 : 0.75,
    impact: 0,
    direction: disagreement !== null && disagreement > 0.08 ? "risk" : "neutral",
    useMode: "market-probability",
    usedByAi: Boolean(primaryOdds),
    downgradeEligible: disagreement !== null && disagreement > 0.12,
    reason: providerCount >= 2
      ? `The market price was compared across two independent odds providers. Relative provider disagreement is ${disagreement === null ? "unknown" : `${(disagreement * 100).toFixed(1)}%`}.`
      : "The market probability uses the primary odds aggregator. The secondary provider is not configured, unsupported or did not match this event.",
    sources,
    evidence,
    missing: providerCount >= 2 ? [] : ["independent secondary odds provider match"]
  });
}

function injuryFactor(report = {}, side = null) {
  const rows = Array.isArray(report.injuries) ? report.injuries : [];
  const relevant = side ? rows.filter((row) => row.side === side) : rows;
  const impact = clamp(relevant.reduce((sum, row) => sum + finite(row.impact), 0), -0.06, 0.02);
  const trust = relevant.length ? relevant.reduce((sum, row) => sum + finite(row.sourceTrust, 0.5), 0) / relevant.length : 0;
  const sources = relevant.map((row, index) => sourceItem({ id: `injury:${index}:${row.name}`, name: row.source, provider: row.source, type: row.sourceType, trust: row.sourceTrust, observedAt: row.observedAt }));
  return factor({
    key: "injuries",
    title: "Injuries and availability",
    status: report.providerLive?.injuries ? relevant.length ? "live-evidence" : "checked-no-impact" : "not-verified",
    confidence: report.providerLive?.injuries ? Math.min(1, 0.65 + relevant.length * 0.05) : 0,
    trust,
    impact,
    direction: impact < -0.005 ? "negative" : impact > 0.005 ? "positive" : "neutral",
    useMode: "risk-and-downgrade",
    usedByAi: report.providerLive?.injuries === true,
    downgradeEligible: impact <= -0.015 && trust >= 0.75,
    reason: relevant.length ? `${relevant.length} team-attributed availability records were used. Their bounded contextual impact is ${(impact * 100).toFixed(2)} percentage points.` : report.providerLive?.injuries ? "The live injury source was checked and no team-attributed adverse record was found." : "No live injury status check is available.",
    sources,
    evidence: relevant.map((row) => ({ player: row.name, status: row.status, importance: row.importance, impact: row.impact, ageHours: row.ageHours })),
    missing: report.providerLive?.injuries ? [] : ["live injury provider check"]
  });
}

function lineupFactor(report = {}, context = null, side = null) {
  const rows = Array.isArray(report.lineups) ? report.lineups : [];
  const relevant = side ? rows.filter((row) => row.side === side) : rows;
  const contextSide = side ? context?.data?.[side] : null;
  const starters = Array.isArray(contextSide?.startingPlayers) ? contextSide.startingPlayers : [];
  const confirmed = relevant.some((row) => row.startersConfirmed || row.goalieConfirmed) || contextSide?.startersConfirmed === true;
  const impact = clamp(relevant.reduce((sum, row) => sum + finite(row.impact), 0), -0.04, 0.025);
  const trustValues = relevant.map((row) => finite(row.sourceTrust, 0.5));
  if (context?.mode === "live") trustValues.push(finite(context.data?.sourceTrust, 0.88));
  const trust = trustValues.length ? trustValues.reduce((sum, value) => sum + value, 0) / trustValues.length : 0;
  const sources = relevant.map((row, index) => sourceItem({ id: `lineup:${index}:${row.team}`, name: row.source, provider: row.source, type: row.sourceType, trust: row.sourceTrust, observedAt: row.observedAt }));
  if (context?.mode === "live") sources.push(sourceItem({ id: "context:starters", name: context.data?.source, provider: context.data?.source, type: context.data?.sourceType, trust: context.data?.sourceTrust, observedAt: context.data?.updatedAt }));
  return factor({
    key: "lineups-and-starters",
    title: "Confirmed lineups and starting players",
    status: confirmed ? "confirmed" : relevant.length || starters.length ? "partial" : "not-confirmed",
    confidence: confirmed ? 0.9 : relevant.length || starters.length ? 0.55 : 0,
    trust,
    impact,
    direction: impact < -0.005 ? "negative" : impact > 0.005 ? "positive" : "neutral",
    useMode: "risk-and-downgrade",
    usedByAi: confirmed || relevant.length > 0 || starters.length > 0,
    downgradeEligible: impact <= -0.015 && trust >= 0.75,
    reason: confirmed ? `The selected side has confirmed starter information${starters.length ? ` for ${starters.length} players` : ""}.` : "Starting-player information is incomplete, so AI treats it as uncertainty rather than assuming a lineup.",
    sources,
    evidence: [
      ...relevant.map((row) => ({ team: row.team, startersConfirmed: row.startersConfirmed, goalieConfirmed: row.goalieConfirmed, keyPlayersAvailable: row.keyPlayersAvailable, impact: row.impact })),
      ...starters.map((player) => ({ player: player.name, position: player.position, confirmed: player.confirmed, importance: player.importance }))
    ],
    missing: confirmed ? [] : ["confirmed starting lineup for selected side"]
  });
}

function formFactor(pick = {}, side = null) {
  const shadow = pick.formRestShadow || pick.formRestShadowModel || null;
  const selected = side ? shadow?.[side] : null;
  const opponent = side === "home" ? shadow?.away : side === "away" ? shadow?.home : null;
  const diff = selected && opponent && optionalFinite(selected.formStrength) !== null && optionalFinite(opponent.formStrength) !== null
    ? clamp(selected.formStrength - opponent.formStrength, -2, 2) / 2
    : optionalFinite(shadow?.selectionSide === side ? shadow?.features?.homeFormAdvantage : null);
  const impact = diff === null ? 0 : clamp(diff * 0.012, -0.018, 0.018);
  const sample = Math.min(finite(selected?.sampleSize), finite(opponent?.sampleSize));
  const live = shadow?.provider?.mode === "live";
  return factor({
    key: "recent-form",
    title: "Recent team form",
    status: live && sample >= 3 ? "ready" : live ? "insufficient-sample" : "source-unavailable",
    confidence: live ? clamp(sample / 5 * 0.7, 0, 0.7) : 0,
    trust: live ? 0.72 : 0,
    impact,
    direction: impact > 0.003 ? "positive" : impact < -0.003 ? "negative" : "neutral",
    useMode: "explanation-and-risk",
    usedByAi: live && sample >= 3,
    downgradeEligible: impact <= -0.012 && sample >= 4,
    reason: live && sample >= 3 ? `Recent form uses ${sample} chronology-safe completed games per team. It contributes a bounded contextual impact of ${(impact * 100).toFixed(2)} percentage points.` : "Recent form is not used because the source is unavailable or the completed-game sample is too small.",
    sources: live ? [sourceItem({ id: "form:results", name: shadow.provider?.source, provider: shadow.provider?.source, type: "official_data_provider", trust: 0.72, observedAt: shadow.provider?.retrievedAt })] : [],
    evidence: selected && opponent ? [{ selectedTeam: selected.team, selectedForm: selected.formStrength, opponentTeam: opponent.team, opponentForm: opponent.formStrength, sampleSize: sample }] : [],
    missing: live && sample >= 3 ? [] : ["at least three completed recent games for both teams"]
  });
}

function restFactor(pick = {}, context = null, side = null) {
  const shadow = pick.formRestShadow || pick.formRestShadowModel || null;
  const selected = side ? shadow?.[side] : null;
  const opponent = side === "home" ? shadow?.away : side === "away" ? shadow?.home : null;
  const contextSelected = side ? context?.data?.[side]?.schedule : null;
  const contextOpponent = side === "home" ? context?.data?.away?.schedule : side === "away" ? context?.data?.home?.schedule : null;
  const selectedRest = optionalFinite(contextSelected?.restHours ?? selected?.restHours);
  const opponentRest = optionalFinite(contextOpponent?.restHours ?? opponent?.restHours);
  const restDiff = selectedRest === null || opponentRest === null ? null : clamp((selectedRest - opponentRest) / 72, -1, 1);
  const selectedCongestion = finite(contextSelected?.gamesLast7Days ?? selected?.gamesLast7Days);
  const opponentCongestion = finite(contextOpponent?.gamesLast7Days ?? opponent?.gamesLast7Days);
  const congestionDiff = clamp((opponentCongestion - selectedCongestion) / 4, -1, 1);
  const backToBackPenalty = contextSelected?.backToBack || selected?.backToBack ? -0.007 : 0;
  const impact = clamp((restDiff || 0) * 0.008 + congestionDiff * 0.006 + backToBackPenalty, -0.018, 0.018);
  const available = selectedRest !== null && opponentRest !== null;
  return factor({
    key: "rest-and-congestion",
    title: "Rest and schedule congestion",
    status: available ? "ready" : "missing",
    confidence: available ? 0.72 : 0,
    trust: context?.mode === "live" ? finite(context.data?.sourceTrust, 0.85) : shadow?.provider?.mode === "live" ? 0.72 : 0,
    impact,
    direction: impact > 0.003 ? "positive" : impact < -0.003 ? "negative" : "neutral",
    useMode: "explanation-and-risk",
    usedByAi: available,
    downgradeEligible: impact <= -0.012,
    reason: available ? `Selected-side rest is ${selectedRest.toFixed(1)} hours versus ${opponentRest.toFixed(1)} hours. Seven-day game counts are ${selectedCongestion} versus ${opponentCongestion}.` : "Rest comparison is unavailable and is not inferred.",
    sources: available ? [sourceItem({ id: "schedule:rest", name: context?.mode === "live" ? context.data?.source : shadow?.provider?.source, provider: context?.mode === "live" ? context.data?.source : shadow?.provider?.source, type: "official_data_provider", trust: context?.mode === "live" ? context.data?.sourceTrust : 0.72, observedAt: context?.data?.updatedAt || shadow?.provider?.retrievedAt })] : [],
    evidence: available ? [{ selectedRestHours: selectedRest, opponentRestHours: opponentRest, selectedGamesLast7Days: selectedCongestion, opponentGamesLast7Days: opponentCongestion, selectedBackToBack: Boolean(contextSelected?.backToBack || selected?.backToBack) }] : [],
    missing: available ? [] : ["verified previous-game timestamps for both teams"]
  });
}

function travelFactor(context = null, side = null) {
  const selected = side ? context?.data?.[side]?.travel : null;
  const opponent = side === "home" ? context?.data?.away?.travel : side === "away" ? context?.data?.home?.travel : null;
  const available = context?.mode === "live" && selected && opponent;
  const selectedBurden = available ? clamp(finite(selected.distanceKm) / 5000 + finite(selected.timeZonesCrossed) / 6 + finite(selected.roadGamesInTrip) / 8, 0, 2) : 0;
  const opponentBurden = available ? clamp(finite(opponent.distanceKm) / 5000 + finite(opponent.timeZonesCrossed) / 6 + finite(opponent.roadGamesInTrip) / 8, 0, 2) : 0;
  const impact = clamp((opponentBurden - selectedBurden) * 0.006, -0.015, 0.015);
  return factor({
    key: "travel",
    title: "Travel burden",
    status: available ? "ready" : "not-configured",
    confidence: available ? 0.68 : 0,
    trust: available ? finite(context.data?.sourceTrust, 0.85) : 0,
    impact,
    direction: impact > 0.003 ? "positive" : impact < -0.003 ? "negative" : "neutral",
    useMode: "explanation-and-risk",
    usedByAi: available,
    downgradeEligible: impact <= -0.01,
    reason: available ? `Travel comparison uses distance, time zones and road-trip length. Selected-side burden score is ${selectedBurden.toFixed(2)} versus ${opponentBurden.toFixed(2)}.` : "Travel data is not configured, so AI does not estimate distance or time-zone effects.",
    sources: available ? [sourceItem({ id: "context:travel", name: context.data?.source, provider: context.data?.source, type: context.data?.sourceType, trust: context.data?.sourceTrust, observedAt: context.data?.updatedAt })] : [],
    evidence: available ? [{ selected, opponent }] : [],
    missing: available ? [] : ["verified travel distance and time-zone data"]
  });
}

function weatherFactor(weather = null) {
  const live = weather?.mode === "live" && weather?.data;
  const impact = live ? clamp(weather.data.impact, -0.02, 0) : 0;
  return factor({
    key: "weather",
    title: "Outdoor weather",
    status: weather?.mode || "not-configured",
    confidence: live ? 0.78 : 0,
    trust: live ? 0.8 : 0,
    impact,
    direction: impact < -0.003 ? "risk" : "neutral",
    useMode: "explanation-and-risk",
    usedByAi: Boolean(live),
    downgradeEligible: live && weather.data.severity >= 0.75,
    reason: live ? `The nearest hourly forecast indicates ${weather.data.reasons?.length ? weather.data.reasons.join(", ") : "no major weather disruption"}. Weather is a bounded contextual risk, not a standalone probability model.` : weather?.mode === "not_applicable_indoor" ? "Weather is not applicable because the sport or venue is classified as indoor." : "Weather is unavailable because event coordinates or a forecast are missing.",
    sources: live ? [sourceItem({ id: "weather:open-meteo", name: "Open-Meteo", provider: "open-meteo", type: "official_data_provider", trust: 0.8, observedAt: weather.retrievedAt })] : [],
    evidence: live ? [weather.data] : [],
    missing: live || weather?.mode === "not_applicable_indoor" ? [] : ["venue coordinates and event-time forecast"]
  });
}

function movementFactor(pick = {}, secondary = null, side = null) {
  const current = optionalFinite(pick.currentOdds ?? pick.odds);
  const opening = optionalFinite(pick.openingOdds);
  const secondarySide = side ? secondary?.data?.[side] : null;
  const secondaryCurrent = optionalFinite(secondarySide?.average);
  const movement = current !== null && opening !== null ? current / opening - 1 : optionalFinite(pick.oddsMovement);
  const crossProviderGap = current !== null && secondaryCurrent !== null ? current / secondaryCurrent - 1 : null;
  const available = movement !== null || crossProviderGap !== null;
  const severity = Math.max(Math.abs(movement || 0), Math.abs(crossProviderGap || 0));
  const impact = severity >= 0.12 ? -0.012 : severity >= 0.07 ? -0.006 : 0;
  return factor({
    key: "market-movement",
    title: "Market movement",
    status: available ? "ready" : "insufficient-history",
    confidence: available ? 0.76 : 0,
    trust: available ? 0.8 : 0,
    impact,
    direction: impact < 0 ? "risk" : "neutral",
    useMode: "price-and-risk",
    usedByAi: available,
    downgradeEligible: severity >= 0.12,
    reason: available ? `Opening-to-current movement is ${movement === null ? "unavailable" : `${(movement * 100).toFixed(1)}%`}; cross-provider price gap is ${crossProviderGap === null ? "unavailable" : `${(crossProviderGap * 100).toFixed(1)}%`}. Large movement is treated as price uncertainty, not automatically as team information.` : "No verified opening or historical price is available.",
    sources: available ? [sourceItem({ id: "market:movement", name: "Verified odds timeline", provider: "odds-market", type: "odds_market", trust: 0.8, observedAt: pick.lastUpdate || secondarySide?.latestAt })] : [],
    evidence: available ? [{ openingOdds: opening, currentOdds: current, secondaryAverage: secondaryCurrent, movement: round(movement, 4), crossProviderGap: round(crossProviderGap, 4) }] : [],
    missing: available ? [] : ["opening odds or verified market timeline"]
  });
}

function closingFactor(pick = {}) {
  const closing = optionalFinite(pick.closingOdds || pick.closing_odds);
  const placed = optionalFinite(pick.odds);
  const clv = optionalFinite(pick.clv) ?? (closing && placed ? (placed / closing - 1) * 100 : null);
  const available = closing !== null;
  return factor({
    key: "closing-odds",
    title: "Closing odds and CLV",
    status: available ? "settled-learning-data" : "not-yet-available",
    confidence: available ? 0.9 : 0,
    trust: available ? 0.82 : 0,
    impact: 0,
    direction: clv !== null && clv > 0 ? "positive" : clv !== null && clv < 0 ? "negative" : "neutral",
    useMode: "training-and-calibration-only",
    usedByAi: false,
    downgradeEligible: false,
    reason: available ? `Closing odds and CLV (${clv?.toFixed(2) ?? "unknown"}%) are retained for calibration after the event. They never leak into a pregame decision.` : "Closing odds do not exist yet and are never estimated before market close.",
    sources: available ? [sourceItem({ id: "closing:market", name: "Closing market record", provider: "settlement-ledger", type: "odds_market", trust: 0.82, observedAt: pick.updated_at || pick.updatedAt })] : [],
    evidence: available ? [{ selectedOdds: placed, closingOdds: closing, clv }] : [],
    missing: available ? [] : ["verified closing price after market close"]
  });
}

function newsFactor(report = {}, now = Date.now()) {
  const articles = scoreNewsCollection(Array.isArray(report.news) ? report.news : [], { now });
  const usable = articles.filter((article) => article.reliability?.usableForExplanation);
  const decisionGrade = articles.filter((article) => article.reliability?.usableForDecision);
  const trust = usable.length ? usable.reduce((sum, article) => sum + finite(article.reliability?.score), 0) / usable.length : 0;
  return factor({
    key: "news-reliability",
    title: "News and source reliability",
    status: usable.length ? decisionGrade.length ? "corroborated" : "explanation-only" : "no-reliable-news",
    confidence: usable.length ? clamp(usable.length / 4 * trust, 0, 0.9) : 0,
    trust,
    impact: 0,
    direction: "neutral",
    useMode: decisionGrade.length ? "risk-context" : "explanation",
    usedByAi: usable.length > 0,
    downgradeEligible: false,
    reason: usable.length ? `${usable.length} timely articles passed the explanation threshold and ${decisionGrade.length} passed the stricter decision-grade source threshold. News is not converted into a probability adjustment without structured team-attributed evidence.` : "No timely news source passed the minimum reliability and freshness rules.",
    sources: usable.map((article, index) => sourceItem({ id: `news:${index}:${article.reliability?.domain}`, name: article.source, provider: article.reliability?.domain || article.source, type: article.sourceType, trust: article.reliability?.score, observedAt: article.publishedAt })),
    evidence: articles.slice(0, 10).map((article) => ({ title: article.title, source: article.source, publishedAt: article.publishedAt, reliability: article.reliability })),
    missing: usable.length ? [] : ["timely independently attributable news with medium-or-higher trust"]
  });
}

function determineSafetyRecommendation(decision, factors) {
  const downgrade = factors.filter((item) => item.downgradeEligible && item.impact < 0);
  const unresolved = factors.filter((item) => item.status === "missing" || item.status === "not-verified" || item.status === "not-confirmed");
  if (decision === "PLAY" && downgrade.length) {
    return {
      action: "DOWNGRADE_TO_CAUTION",
      reasons: downgrade.map((item) => `${item.title}: ${item.reason}`),
      upgraded: false
    };
  }
  return {
    action: unresolved.length && decision === "PLAY" ? "KEEP_WITH_MISSING_DATA_WARNING" : "KEEP_CURRENT_DECISION",
    reasons: unresolved.slice(0, 4).map((item) => `${item.title} is ${item.status}.`),
    upgraded: false
  };
}

function buildAiExplanation(pick, factors, totalImpact, recommendation) {
  const used = factors.filter((item) => item.usedByAi);
  const notUsed = factors.filter((item) => !item.usedByAi);
  const strongest = [...used].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 4);
  return {
    version: "grounded-data-provenance-v1",
    headline: recommendation.action === "DOWNGRADE_TO_CAUTION"
      ? "Verified contextual risk supports a downgrade to CAUTION."
      : "The market decision is retained; contextual data is shown separately.",
    dataUsed: used.map((item) => ({ key: item.key, title: item.title, useMode: item.useMode, impact: item.impact, confidence: item.confidence, trust: item.trust, why: item.reason })),
    dataNotUsed: notUsed.map((item) => ({ key: item.key, title: item.title, status: item.status, why: item.reason, missing: item.missing })),
    strongestEffects: strongest.map((item) => ({ key: item.key, direction: item.direction, impact: item.impact, why: item.reason })),
    totalBoundedContextImpact: totalImpact,
    probabilityChanged: false,
    productionDecisionUpgraded: false,
    safetyRecommendation: recommendation,
    explanation: [
      `The probability remains the no-vig market consensus for ${clean(pick.selection || pick.label, 120)}.`,
      used.length ? `AI used ${used.length} of ${factors.length} data families for price, risk or explanation.` : "AI did not find a verified contextual data family it could use.",
      strongest.length ? `Largest contextual effect: ${strongest[0].title} (${(strongest[0].impact * 100).toFixed(2)} percentage points, ${strongest[0].direction}).` : "No contextual effect was applied.",
      recommendation.action === "DOWNGRADE_TO_CAUTION" ? "The context can only downgrade a PLAY; it cannot create or upgrade one." : "No contextual signal overrode the current market decision."
    ]
  };
}

export function buildUnifiedSportsDataLedger({ pick = {}, sportsReport = {}, secondaryOdds = null, context = null, weather = null, now = Date.now() } = {}) {
  const side = selectionSide(pick);
  const factors = [
    primaryOddsFactor(pick, secondaryOdds, side, now),
    injuryFactor(sportsReport, side),
    lineupFactor(sportsReport, context, side),
    formFactor(pick, side),
    restFactor(pick, context, side),
    travelFactor(context, side),
    weatherFactor(weather),
    movementFactor(pick, secondaryOdds, side),
    closingFactor(pick),
    newsFactor(sportsReport, now)
  ];
  const usedFactors = factors.filter((item) => item.usedByAi && item.useMode !== "training-and-calibration-only");
  const totalImpact = round(clamp(usedFactors.reduce((sum, item) => sum + finite(item.impact), 0), -MAX_CONTEXT_IMPACT, MAX_CONTEXT_IMPACT), 4);
  const decision = normalizeDecision(pick);
  const recommendation = determineSafetyRecommendation(decision, factors);
  const sources = [];
  const sourceKeys = new Set();
  for (const item of factors.flatMap((entry) => entry.sources)) {
    const key = `${item.provider}:${item.id}`;
    if (sourceKeys.has(key)) continue;
    sourceKeys.add(key);
    sources.push(item);
  }
  const configuredFamilies = factors.filter((item) => !["not-configured", "missing", "not-verified", "not-confirmed", "no-reliable-news", "not-yet-available"].includes(item.status)).length;
  const usedFamilies = usedFactors.length;
  const coverage = factors.length ? configuredFamilies / factors.length : 0;
  const verifiedCoverage = factors.length ? factors.filter((item) => item.confidence >= 0.65 && item.trust >= 0.7).length / factors.length : 0;
  const aiExplanation = buildAiExplanation(pick, factors, totalImpact, recommendation);

  return {
    version: "unified-sports-data-v1",
    generatedAt: new Date(now).toISOString(),
    eventId: clean(pick.gameId || pick.eventId || pick.id, 180) || null,
    match: clean(pick.match || `${pick.homeTeam || "Home"} vs ${pick.awayTeam || "Away"}`, 240),
    selection: clean(pick.selection || pick.label, 160),
    selectionSide: side,
    currentDecision: decision,
    policy: {
      probabilitySource: "no-vig market consensus",
      contextImpactCap: MAX_CONTEXT_IMPACT,
      contextProbabilityApplied: false,
      canUpgradeProductionDecision: false,
      canDowngradeVerifiedRisk: true,
      closingOddsPregameLeakage: false
    },
    coverage: {
      totalFamilies: factors.length,
      configuredFamilies,
      usedFamilies,
      coverageRate: round(coverage, 3),
      verifiedCoverageRate: round(verifiedCoverage, 3),
      sourceCount: sources.length,
      independentOddsProviders: primaryOddsFactor(pick, secondaryOdds, side, now).evidence.find((item) => item.label === "independentOddsProviders")?.value || 1
    },
    factors,
    sources,
    totalBoundedContextImpact: totalImpact,
    safetyRecommendation: recommendation,
    aiExplanation,
    missingData: factors.flatMap((item) => item.missing.map((missing) => ({ factor: item.key, missing }))),
    paperOnly: true
  };
}

export function applyUnifiedDataSafety(pick = {}, ledger = {}) {
  const recommendation = ledger?.safetyRecommendation?.action;
  const current = normalizeDecision(pick);
  const shouldDowngrade = current === "PLAY" && recommendation === "DOWNGRADE_TO_CAUTION";
  return {
    ...pick,
    unifiedSportsData: ledger,
    dataProvenance: ledger?.aiExplanation || null,
    aiDataUsed: ledger?.aiExplanation?.dataUsed || [],
    aiDataNotUsed: ledger?.aiExplanation?.dataNotUsed || [],
    contextImpact: ledger?.totalBoundedContextImpact || 0,
    productDecision: shouldDowngrade ? "CAUTION" : pick.productDecision,
    decision: shouldDowngrade ? "WATCH" : pick.decision,
    unifiedDataSafetyDowngrade: shouldDowngrade,
    unifiedDataDecisionReason: shouldDowngrade
      ? "Verified unified-data risk downgraded PLAY to CAUTION. No contextual data can upgrade a decision."
      : "Unified data retained the current market decision and exposed all used and unused evidence.",
    probabilityAdjustedByUnifiedData: false,
    probabilityAdjustedByIntelligence: false,
    agentVersion: `${pick.agentVersion || "V11"}+unified-sports-data-v1`
  };
}

export const UNIFIED_SPORTS_DATA_MAX_CONTEXT_IMPACT = MAX_CONTEXT_IMPACT;
