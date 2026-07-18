import { namesMatch } from "./results-normalizer.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_FORM_GAMES = 5;
const RECENCY_WEIGHTS = [1, 0.85, 0.7, 0.55, 0.4];

const PROFILES = Object.freeze({
  icehockey_nhl: {
    modelId: "nhl-form-rest-logit-v1",
    mode: "binary-shadow",
    minimumGames: 3,
    scoreScale: 3,
    backToBackHours: 36,
    homeLogit: 0.12,
    formWeight: 0.72,
    marginWeight: 0.34,
    restWeight: 0.16,
    congestionWeight: 0.14
  },
  basketball_nba: {
    modelId: "nba-form-rest-logit-v1",
    mode: "binary-shadow",
    minimumGames: 3,
    scoreScale: 12,
    backToBackHours: 32,
    homeLogit: 0.16,
    formWeight: 0.68,
    marginWeight: 0.42,
    restWeight: 0.2,
    congestionWeight: 0.16
  },
  soccer_epl: {
    modelId: "epl-form-rest-features-v1",
    mode: "feature-only",
    minimumGames: 3,
    scoreScale: 2,
    backToBackHours: 60
  },
  soccer_spain_la_liga: {
    modelId: "laliga-form-rest-features-v1",
    mode: "feature-only",
    minimumGames: 3,
    scoreScale: 2,
    backToBackHours: 60
  }
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clean(value, limit = 180) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function round(value, digits = 4) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(digits));
}

function eventTimestamp(event = {}) {
  const direct = Date.parse(String(event.commence_time || event.commenceTime || event.timestamp || ""));
  if (Number.isFinite(direct)) return direct;

  const date = clean(event.date, 20);
  const time = clean(event.time, 30) || "00:00:00";
  if (!date) return null;
  const candidate = `${date}T${time}${/[zZ]|[+-]\d\d:?\d\d$/.test(time) ? "" : "Z"}`;
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

function eventSide(event, team) {
  if (namesMatch(event?.home_team, team)) return "home";
  if (namesMatch(event?.away_team, team)) return "away";
  return null;
}

function teamView(event, team, cutoff) {
  const timestamp = eventTimestamp(event);
  if (timestamp === null || timestamp >= cutoff || event?.is_finished !== true) return null;
  const side = eventSide(event, team);
  if (!side) return null;

  const homeScore = finite(event.home_score);
  const awayScore = finite(event.away_score);
  if (homeScore === null || awayScore === null) return null;
  const scoreFor = side === "home" ? homeScore : awayScore;
  const scoreAgainst = side === "home" ? awayScore : homeScore;
  const resultValue = scoreFor > scoreAgainst ? 1 : scoreFor === scoreAgainst ? 0.5 : 0;

  return {
    id: clean(event.id, 120),
    timestamp,
    playedAt: new Date(timestamp).toISOString(),
    side,
    opponent: clean(side === "home" ? event.away_team : event.home_team, 120),
    scoreFor,
    scoreAgainst,
    scoreDifference: scoreFor - scoreAgainst,
    resultValue
  };
}

function weightedAverage(values, selector) {
  if (!values.length) return null;
  let weighted = 0;
  let weights = 0;
  values.forEach((item, index) => {
    const weight = RECENCY_WEIGHTS[index] || RECENCY_WEIGHTS.at(-1);
    weighted += selector(item) * weight;
    weights += weight;
  });
  return weights > 0 ? weighted / weights : null;
}

function buildTeamSnapshot({ team, results, cutoff, profile }) {
  const allBeforeCutoff = (Array.isArray(results) ? results : [])
    .map((event) => teamView(event, team, cutoff))
    .filter(Boolean)
    .sort((left, right) => right.timestamp - left.timestamp);
  const recent = allBeforeCutoff.slice(0, MAX_FORM_GAMES);
  const weightedResultRate = weightedAverage(recent, (item) => item.resultValue);
  const weightedMargin = weightedAverage(recent, (item) => clamp(item.scoreDifference / profile.scoreScale, -1, 1));
  const lastPlayedAt = recent[0]?.timestamp ?? null;
  const restHours = lastPlayedAt === null ? null : Math.max(0, (cutoff - lastPlayedAt) / HOUR_MS);
  const restDays = restHours === null ? null : restHours / 24;
  const gamesLast7Days = allBeforeCutoff.filter((item) => cutoff - item.timestamp <= 7 * DAY_MS).length;
  const gamesLast14Days = allBeforeCutoff.filter((item) => cutoff - item.timestamp <= 14 * DAY_MS).length;
  const restScore = restDays === null ? null : clamp((Math.min(restDays, 7) - 2) / 3, -1, 1);
  const congestionScore = clamp((gamesLast7Days - 2) / 3, 0, 1);

  return {
    team: clean(team, 120),
    sampleSize: recent.length,
    weightedResultRate: round(weightedResultRate),
    formStrength: weightedResultRate === null ? null : round(weightedResultRate * 2 - 1),
    normalizedScoreMargin: round(weightedMargin),
    lastPlayedAt: lastPlayedAt === null ? null : new Date(lastPlayedAt).toISOString(),
    restHours: round(restHours, 2),
    restDays: round(restDays, 2),
    restScore: round(restScore),
    backToBack: restHours !== null && restHours < profile.backToBackHours,
    gamesLast7Days,
    gamesLast14Days,
    congestionScore: round(congestionScore),
    recentEventIds: recent.map((item) => item.id).filter(Boolean).slice(0, MAX_FORM_GAMES),
    recentResults: recent.map((item) => ({
      id: item.id,
      playedAt: item.playedAt,
      opponent: item.opponent,
      side: item.side,
      scoreFor: item.scoreFor,
      scoreAgainst: item.scoreAgainst,
      result: item.resultValue === 1 ? "win" : item.resultValue === 0.5 ? "draw" : "loss"
    }))
  };
}

function selectionSide(pick = {}) {
  const selection = pick.selection || pick.label;
  if (namesMatch(selection, pick.homeTeam)) return "home";
  if (namesMatch(selection, pick.awayTeam)) return "away";
  return null;
}

function probabilityFromPick(pick = {}) {
  const value = finite(pick.consensusProbability ?? pick.modelProbability);
  return value !== null && value > 0 && value < 1 ? value : null;
}

function buildDerivedFeatures(home, away) {
  const formDiff = home.formStrength === null || away.formStrength === null
    ? null
    : clamp(home.formStrength - away.formStrength, -2, 2) / 2;
  const marginDiff = home.normalizedScoreMargin === null || away.normalizedScoreMargin === null
    ? null
    : clamp(home.normalizedScoreMargin - away.normalizedScoreMargin, -2, 2) / 2;
  const restDiff = home.restScore === null || away.restScore === null
    ? null
    : clamp(home.restScore - away.restScore, -2, 2) / 2;
  const congestionDiff = clamp(away.congestionScore - home.congestionScore, -1, 1);

  return {
    homeFormAdvantage: round(formDiff),
    homeMarginAdvantage: round(marginDiff),
    homeRestAdvantage: round(restDiff),
    homeCongestionAdvantage: round(congestionDiff)
  };
}

function homeShadowProbability(profile, features) {
  if (profile.mode !== "binary-shadow") return null;
  if (Object.values(features).some((value) => value === null)) return null;
  const logit = profile.homeLogit +
    features.homeFormAdvantage * profile.formWeight +
    features.homeMarginAdvantage * profile.marginWeight +
    features.homeRestAdvantage * profile.restWeight +
    features.homeCongestionAdvantage * profile.congestionWeight;
  return round(clamp(sigmoid(logit), 0.12, 0.88));
}

function safeProvider(provider = {}, now = Date.now()) {
  return {
    source: clean(provider.source || "thesportsdb", 80),
    mode: clean(provider.mode || "unavailable", 40),
    leagueKey: clean(provider.leagueKey, 40) || null,
    retrievedAt: clean(provider.retrievedAt, 80) || new Date(now).toISOString(),
    resultCount: Math.max(0, Math.min(500, finite(provider.resultCount, Array.isArray(provider.results) ? provider.results.length : 0))),
    cached: Boolean(provider.cached)
  };
}

export function buildFormRestShadowSnapshot({ pick = {}, provider = {}, now = Date.now() } = {}) {
  const sportKey = clean(pick.sportKey || pick.league, 120);
  const profile = PROFILES[sportKey];
  const cutoff = Date.parse(String(pick.commenceTime || pick.commence_time || ""));
  const providerAudit = safeProvider(provider, now);
  const marketProbability = probabilityFromPick(pick);

  if (!profile) {
    return {
      version: "form-rest-shadow-v1",
      modelId: null,
      mode: "unsupported",
      status: "unsupported_sport",
      sportKey,
      generatedAt: new Date(now).toISOString(),
      asOf: Number.isFinite(cutoff) ? new Date(cutoff).toISOString() : null,
      provider: providerAudit,
      marketProbability,
      shadowProbability: null,
      probabilityDelta: null,
      probabilityAppliedToProduction: false,
      usedForDecision: false,
      chronologyGuard: true
    };
  }

  if (!Number.isFinite(cutoff)) {
    return {
      version: "form-rest-shadow-v1",
      modelId: profile.modelId,
      mode: profile.mode,
      status: "invalid_fixture_time",
      sportKey,
      generatedAt: new Date(now).toISOString(),
      asOf: null,
      provider: providerAudit,
      marketProbability,
      shadowProbability: null,
      probabilityDelta: null,
      probabilityAppliedToProduction: false,
      usedForDecision: false,
      chronologyGuard: true
    };
  }

  const results = Array.isArray(provider.results) ? provider.results : [];
  const home = buildTeamSnapshot({ team: pick.homeTeam, results, cutoff, profile });
  const away = buildTeamSnapshot({ team: pick.awayTeam, results, cutoff, profile });
  const features = buildDerivedFeatures(home, away);
  const enoughHistory = home.sampleSize >= profile.minimumGames && away.sampleSize >= profile.minimumGames;
  const providerLive = provider.ok === true && provider.mode === "live";
  const homeProbability = providerLive && enoughHistory ? homeShadowProbability(profile, features) : null;
  const side = selectionSide(pick);
  const shadowProbability = side === "home"
    ? homeProbability
    : side === "away" && homeProbability !== null
      ? round(1 - homeProbability)
      : null;
  const probabilityDelta = shadowProbability === null || marketProbability === null
    ? null
    : round(shadowProbability - marketProbability);
  const sampleCoverage = Math.min(home.sampleSize, away.sampleSize) / MAX_FORM_GAMES;
  const confidence = profile.mode === "binary-shadow" && shadowProbability !== null
    ? round(clamp(sampleCoverage * 0.65, 0, 0.65))
    : 0;

  let status = "ready";
  if (!providerLive) status = "source_unavailable";
  else if (!enoughHistory) status = "insufficient_history";
  else if (profile.mode === "feature-only") status = "feature_only";
  else if (!side) status = "unsupported_selection";

  return {
    version: "form-rest-shadow-v1",
    modelId: profile.modelId,
    mode: profile.mode,
    status,
    sportKey,
    generatedAt: new Date(now).toISOString(),
    asOf: new Date(cutoff).toISOString(),
    selectionSide: side,
    provider: providerAudit,
    samplePolicy: {
      maximumGamesPerTeam: MAX_FORM_GAMES,
      minimumGamesPerTeam: profile.minimumGames,
      homeSampleSize: home.sampleSize,
      awaySampleSize: away.sampleSize
    },
    home,
    away,
    features,
    homeShadowProbability: homeProbability,
    shadowProbability,
    shadowConfidence: confidence,
    marketProbability,
    probabilityDelta,
    probabilityAppliedToProduction: false,
    edgeAdjusted: false,
    evAdjusted: false,
    usedForDecision: false,
    chronologyGuard: true,
    safetyNote: "Only completed events before the target fixture are included. The shadow output does not change PLAY, probability, edge, EV or paper stake."
  };
}

export function attachFormRestShadow(pick = {}, provider = {}, now = Date.now()) {
  const snapshot = buildFormRestShadowSnapshot({ pick, provider, now });
  return {
    ...pick,
    formRestShadow: snapshot,
    featureSnapshot: compactFormRestFeatureSnapshot(snapshot),
    independentModelMode: "form-rest-shadow-v1",
    independentProbabilityApplied: false,
    modelProbability: pick.modelProbability,
    consensusProbability: pick.consensusProbability,
    edge: pick.edge,
    ev: pick.ev,
    decision: pick.decision,
    productDecision: pick.productDecision
  };
}

function safeTeamSnapshot(value = {}) {
  return {
    team: clean(value.team, 120),
    sampleSize: Math.max(0, Math.min(MAX_FORM_GAMES, finite(value.sampleSize, 0))),
    weightedResultRate: round(value.weightedResultRate),
    formStrength: round(value.formStrength),
    normalizedScoreMargin: round(value.normalizedScoreMargin),
    lastPlayedAt: clean(value.lastPlayedAt, 80) || null,
    restHours: round(value.restHours, 2),
    restDays: round(value.restDays, 2),
    backToBack: Boolean(value.backToBack),
    gamesLast7Days: Math.max(0, Math.min(14, finite(value.gamesLast7Days, 0))),
    gamesLast14Days: Math.max(0, Math.min(28, finite(value.gamesLast14Days, 0))),
    recentEventIds: (Array.isArray(value.recentEventIds) ? value.recentEventIds : [])
      .map((item) => clean(item, 120))
      .filter(Boolean)
      .slice(0, MAX_FORM_GAMES)
  };
}

export function compactFormRestFeatureSnapshot(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const features = source.features && typeof source.features === "object" ? source.features : {};
  const provider = source.provider && typeof source.provider === "object" ? source.provider : {};
  return {
    version: "form-rest-shadow-v1",
    modelId: clean(source.modelId, 80) || null,
    mode: clean(source.mode, 40) || "unavailable",
    status: clean(source.status, 60) || "unavailable",
    sportKey: clean(source.sportKey, 120),
    generatedAt: clean(source.generatedAt, 80) || null,
    asOf: clean(source.asOf, 80) || null,
    selectionSide: ["home", "away"].includes(source.selectionSide) ? source.selectionSide : null,
    provider: {
      source: clean(provider.source, 80),
      mode: clean(provider.mode, 40),
      leagueKey: clean(provider.leagueKey, 40) || null,
      retrievedAt: clean(provider.retrievedAt, 80) || null,
      resultCount: Math.max(0, Math.min(500, finite(provider.resultCount, 0)))
    },
    home: safeTeamSnapshot(source.home),
    away: safeTeamSnapshot(source.away),
    features: {
      homeFormAdvantage: round(features.homeFormAdvantage),
      homeMarginAdvantage: round(features.homeMarginAdvantage),
      homeRestAdvantage: round(features.homeRestAdvantage),
      homeCongestionAdvantage: round(features.homeCongestionAdvantage)
    },
    shadowProbability: round(source.shadowProbability),
    shadowConfidence: round(source.shadowConfidence),
    marketProbability: round(source.marketProbability),
    probabilityDelta: round(source.probabilityDelta),
    probabilityAppliedToProduction: false,
    usedForDecision: false,
    chronologyGuard: true
  };
}

export const FORM_REST_SHADOW_POLICY = Object.freeze({
  version: "form-rest-shadow-v1",
  maximumGamesPerTeam: MAX_FORM_GAMES,
  supportedBinaryModels: ["icehockey_nhl", "basketball_nba"],
  featureOnlySports: ["soccer_epl", "soccer_spain_la_liga"],
  probabilityAppliedToProduction: false,
  usedForDecision: false
});
