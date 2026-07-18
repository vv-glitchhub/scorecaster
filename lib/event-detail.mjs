function text(value, max = 240) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function number(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function probability(value) {
  const parsed = number(value);
  return parsed !== null && parsed > 0 && parsed < 1 ? parsed : null;
}

function eventId(pick = {}) {
  return text(pick.gameId || pick.eventId || pick.id, 180);
}

function decision(pick = {}) {
  const value = text(pick.productDecision || pick.decision, 20).toUpperCase();
  if (value === "PLAY" || value === "BET") return "PLAY";
  if (value === "SKIP" || value === "PASS") return "SKIP";
  return "CAUTION";
}

function safeEvidence(items, maximum = 12) {
  return (Array.isArray(items) ? items : []).slice(0, maximum).map((item) => ({
    category: text(item?.category, 40),
    side: text(item?.side, 20) || null,
    subject: text(item?.subject || item?.title || item?.name, 160),
    status: text(item?.status, 80),
    detail: text(item?.detail || item?.description, 320),
    source: text(item?.source, 100),
    sourceType: text(item?.sourceType, 60),
    observedAt: text(item?.observedAt || item?.publishedAt || item?.updatedAt, 80) || null,
    freshness: text(item?.freshness, 30) || "unknown",
    verified: item?.verified === true
  }));
}

function safeSportsIntelligence(value = {}) {
  const readiness = value?.readiness || {};
  const evidence = [
    ...(Array.isArray(value.news) ? value.news : []),
    ...(Array.isArray(value.injuries) ? value.injuries : []),
    ...(Array.isArray(value.lineups) ? value.lineups : [])
  ];
  return {
    version: text(value.version, 80) || "sports-intelligence-v1",
    generatedAt: text(value.generatedAt, 80) || null,
    readiness: {
      level: text(readiness.level, 30) || "market-only",
      score: number(readiness.score, 0),
      verifiedCount: number(readiness.verifiedCount, 0),
      totalChecks: number(readiness.totalChecks, 0),
      missing: (Array.isArray(readiness.missing) ? readiness.missing : []).map((item) => text(item, 180)).filter(Boolean).slice(0, 10),
      fullyVerified: readiness.fullyVerified === true
    },
    sourceCount: number(value.sourceCount, 0),
    sources: (Array.isArray(value.sources) ? value.sources : []).map((item) => text(item, 100)).filter(Boolean).slice(0, 12),
    conflicts: (Array.isArray(value.conflicts) ? value.conflicts : []).map((item) => text(typeof item === "string" ? item : item?.detail || item?.message, 240)).filter(Boolean).slice(0, 8),
    impacts: { home: number(value?.impacts?.home, 0), away: number(value?.impacts?.away, 0) },
    evidence: safeEvidence(evidence),
    probabilityAdjusted: false
  };
}

function safeTeam(value = {}) {
  return {
    team: text(value.team, 120),
    sampleSize: number(value.sampleSize, 0),
    weightedResultRate: number(value.weightedResultRate),
    formStrength: number(value.formStrength),
    normalizedScoreMargin: number(value.normalizedScoreMargin),
    restDays: number(value.restDays),
    backToBack: value.backToBack === true,
    gamesLast7Days: number(value.gamesLast7Days, 0),
    gamesLast14Days: number(value.gamesLast14Days, 0)
  };
}

function safeFormRest(value = {}) {
  const ready = value?.status === "ready";
  return {
    version: text(value.version, 80) || "form-rest-shadow-v1",
    modelId: text(value.modelId, 80) || null,
    mode: text(value.mode, 40) || "unavailable",
    status: text(value.status, 60) || "unavailable",
    asOf: text(value.asOf, 80) || null,
    home: safeTeam(value.home),
    away: safeTeam(value.away),
    features: {
      homeFormAdvantage: number(value?.features?.homeFormAdvantage),
      homeMarginAdvantage: number(value?.features?.homeMarginAdvantage),
      homeRestAdvantage: number(value?.features?.homeRestAdvantage),
      homeCongestionAdvantage: number(value?.features?.homeCongestionAdvantage)
    },
    marketProbability: ready ? probability(value.marketProbability) : null,
    shadowProbability: ready ? probability(value.shadowProbability) : null,
    probabilityDelta: ready ? number(value.probabilityDelta) : null,
    probabilityAppliedToProduction: false,
    usedForDecision: false,
    chronologyGuard: value?.chronologyGuard === true
  };
}

function selectionShape(pick = {}, selectedName = "") {
  const consensus = probability(pick.consensusProbability ?? pick.modelProbability);
  const odds = number(pick.odds, 0);
  return {
    id: text(pick.id || `${eventId(pick)}-${pick.selection || pick.label}`, 220),
    selection: text(pick.selection || pick.label, 160),
    odds,
    bookmaker: text(pick.bookmaker, 100),
    consensusProbability: consensus,
    marketProbability: probability(pick.marketProbability ?? (odds > 1 ? 1 / odds : null)),
    fairOdds: number(pick.fairOdds, consensus ? 1 / consensus : null),
    edge: number(pick.edge, 0),
    ev: number(pick.ev, 0),
    confidence: number(pick.confidence, 0),
    trustScore: number(pick.trustScore, 0),
    bookmakerCount: number(pick.bookmakerCount ?? pick.dataQuality?.bookmakerCount, 0),
    freshness: text(pick.freshnessLabel || pick.dataQuality?.freshness, 40) || "unknown",
    decision: decision(pick),
    decisionReason: text(pick.evidenceGateReason || pick.decisionReason, 360),
    qualityGrade: text(pick.qualityGrade, 20) || null,
    priceGuard: {
      breakEvenOdds: consensus ? 1 / consensus : null,
      minimumPlayOdds: consensus ? 1.03 / consensus : null,
      currentOdds: odds,
      buffer: consensus && odds > 1 ? odds - 1.03 / consensus : null
    },
    selected: selectedName ? text(pick.selection || pick.label, 160).toLowerCase() === selectedName.toLowerCase() : false
  };
}

export function buildEventDetail(picks = [], requestedEventId = "", requestedSelection = "") {
  const id = text(requestedEventId, 180);
  const matches = (Array.isArray(picks) ? picks : []).filter((pick) => eventId(pick) === id);
  if (!id || !matches.length) return null;
  const primary = matches.find((pick) => requestedSelection && text(pick.selection || pick.label, 160).toLowerCase() === text(requestedSelection, 160).toLowerCase()) || matches[0];
  const selections = matches.map((pick) => selectionShape(pick, requestedSelection));

  return {
    version: "event-detail-v1",
    eventId: id,
    sportKey: text(primary.sportKey || primary.league, 120),
    league: text(primary.leagueTitle || primary.league, 120),
    match: text(primary.match || [primary.homeTeam, primary.awayTeam].filter(Boolean).join(" – "), 240),
    homeTeam: text(primary.homeTeam, 120),
    awayTeam: text(primary.awayTeam, 120),
    commenceTime: text(primary.commenceTime || primary.commence_time, 80) || null,
    generatedAt: new Date().toISOString(),
    fixtureVerifiedByProvider: primary.fixtureVerifiedByProvider === true,
    fixtureSource: text(primary.fixtureSource, 80) || "live-odds-provider",
    selectedSelection: text(primary.selection || primary.label, 160),
    selections,
    sportsIntelligence: safeSportsIntelligence(primary.sportsIntelligence),
    formRestShadow: safeFormRest(primary.formRestShadow || primary.featureSnapshot),
    paperOnly: true,
    realMoneyActionAvailable: false,
    probabilityAdjustedByDetail: false
  };
}
