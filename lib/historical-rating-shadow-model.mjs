import { namesMatch } from "./results-normalizer.js";

export const HISTORICAL_RATING_SHADOW_VERSION = "historical-rating-shadow-v1";

const INITIAL_RATING = 1500;
const RATING_SCALE = 400;
const MAX_EVENTS = 120;

const PROFILES = Object.freeze({
  icehockey_nhl: Object.freeze({
    modelId: "nhl-recent-elo-v1",
    kFactor: 20,
    homeAdvantageElo: 35,
    minimumTeamGames: 3,
    minimumLeagueEvents: 30
  }),
  basketball_nba: Object.freeze({
    modelId: "nba-recent-elo-v1",
    kFactor: 20,
    homeAdvantageElo: 55,
    minimumTeamGames: 3,
    minimumLeagueEvents: 30
  }),
  basketball_wnba: Object.freeze({
    modelId: "wnba-recent-elo-v1",
    kFactor: 20,
    homeAdvantageElo: 50,
    minimumTeamGames: 3,
    minimumLeagueEvents: 24
  }),
  baseball_mlb: Object.freeze({
    modelId: "mlb-recent-elo-v1",
    kFactor: 16,
    homeAdvantageElo: 25,
    minimumTeamGames: 3,
    minimumLeagueEvents: 30
  })
});

function clean(value, limit = 160) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function finite(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 6) {
  const parsed = finite(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
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

function expectedHomeProbability(homeRating, awayRating, homeAdvantageElo) {
  const adjustedDifference = homeRating + homeAdvantageElo - awayRating;
  return 1 / (1 + 10 ** (-adjustedDifference / RATING_SCALE));
}

function actualHomeResult(homeScore, awayScore) {
  if (homeScore > awayScore) return 1;
  if (homeScore < awayScore) return 0;
  return 0.5;
}

function selectionSide(pick = {}) {
  const selection = pick.selection || pick.label;
  if (namesMatch(selection, pick.homeTeam)) return "home";
  if (namesMatch(selection, pick.awayTeam)) return "away";
  return null;
}

function ratingKey(team) {
  return clean(team, 160).toLowerCase();
}

function trainingEvents(provider = {}, cutoff) {
  return (Array.isArray(provider.results) ? provider.results : [])
    .slice(0, MAX_EVENTS)
    .map((event) => ({
      event,
      timestamp: eventTimestamp(event),
      homeTeam: clean(event?.home_team, 160),
      awayTeam: clean(event?.away_team, 160),
      homeScore: finite(event?.home_score),
      awayScore: finite(event?.away_score)
    }))
    .filter((row) => row.event?.is_finished === true
      && row.timestamp !== null
      && row.timestamp < cutoff
      && row.homeTeam
      && row.awayTeam
      && row.homeScore !== null
      && row.awayScore !== null)
    .sort((left, right) => left.timestamp - right.timestamp);
}

function buildRatings(events, profile) {
  const ratings = new Map();
  const games = new Map();

  const getRating = (team) => ratings.get(ratingKey(team)) ?? INITIAL_RATING;
  const getGames = (team) => games.get(ratingKey(team)) ?? 0;

  for (const row of events) {
    const homeRating = getRating(row.homeTeam);
    const awayRating = getRating(row.awayTeam);
    const expectedHome = expectedHomeProbability(homeRating, awayRating, profile.homeAdvantageElo);
    const actualHome = actualHomeResult(row.homeScore, row.awayScore);
    const delta = profile.kFactor * (actualHome - expectedHome);

    ratings.set(ratingKey(row.homeTeam), homeRating + delta);
    ratings.set(ratingKey(row.awayTeam), awayRating - delta);
    games.set(ratingKey(row.homeTeam), getGames(row.homeTeam) + 1);
    games.set(ratingKey(row.awayTeam), getGames(row.awayTeam) + 1);
  }

  return { ratings, games };
}

function providerAudit(provider = {}, now = Date.now()) {
  return {
    source: clean(provider.source || "thesportsdb", 80),
    mode: clean(provider.mode || "unavailable", 40),
    leagueKey: clean(provider.leagueKey, 40) || null,
    retrievedAt: clean(provider.retrievedAt, 80) || new Date(now).toISOString(),
    resultCount: Math.max(0, Math.min(MAX_EVENTS, finite(provider.resultCount, Array.isArray(provider.results) ? provider.results.length : 0))),
    cached: Boolean(provider.cached)
  };
}

export function buildHistoricalRatingShadow({ pick = {}, provider = {}, now = Date.now() } = {}) {
  const sportKey = clean(pick.sportKey || pick.league, 120);
  const profile = PROFILES[sportKey];
  const cutoff = Date.parse(String(pick.commenceTime || pick.commence_time || ""));
  const source = providerAudit(provider, now);
  const side = selectionSide(pick);

  if (!profile) {
    return {
      version: HISTORICAL_RATING_SHADOW_VERSION,
      modelId: null,
      status: "unsupported_sport",
      sportKey,
      generatedAt: new Date(now).toISOString(),
      selectionSide: side,
      shadowProbability: null,
      chronologyGuard: true,
      probabilityAppliedToProduction: false,
      usedForDecision: false,
      provider: source,
      paperOnly: true
    };
  }

  if (!Number.isFinite(cutoff)) {
    return {
      version: HISTORICAL_RATING_SHADOW_VERSION,
      modelId: profile.modelId,
      status: "invalid_fixture_time",
      sportKey,
      generatedAt: new Date(now).toISOString(),
      selectionSide: side,
      shadowProbability: null,
      chronologyGuard: true,
      probabilityAppliedToProduction: false,
      usedForDecision: false,
      provider: source,
      paperOnly: true
    };
  }

  if (provider.ok !== true || provider.mode !== "live") {
    return {
      version: HISTORICAL_RATING_SHADOW_VERSION,
      modelId: profile.modelId,
      status: "source_unavailable",
      sportKey,
      generatedAt: new Date(now).toISOString(),
      asOf: new Date(cutoff).toISOString(),
      selectionSide: side,
      shadowProbability: null,
      chronologyGuard: true,
      probabilityAppliedToProduction: false,
      usedForDecision: false,
      provider: source,
      paperOnly: true
    };
  }

  const events = trainingEvents(provider, cutoff);
  const state = buildRatings(events, profile);
  const homeRating = state.ratings.get(ratingKey(pick.homeTeam)) ?? INITIAL_RATING;
  const awayRating = state.ratings.get(ratingKey(pick.awayTeam)) ?? INITIAL_RATING;
  const homeGames = state.games.get(ratingKey(pick.homeTeam)) ?? 0;
  const awayGames = state.games.get(ratingKey(pick.awayTeam)) ?? 0;
  const enoughHistory = events.length >= profile.minimumLeagueEvents
    && homeGames >= profile.minimumTeamGames
    && awayGames >= profile.minimumTeamGames;
  const homeProbability = enoughHistory
    ? expectedHomeProbability(homeRating, awayRating, profile.homeAdvantageElo)
    : null;
  const shadowProbability = side === "home"
    ? homeProbability
    : side === "away" && homeProbability !== null
      ? 1 - homeProbability
      : null;

  let status = "ready";
  if (!enoughHistory) status = "insufficient_history";
  else if (!side) status = "unsupported_selection";

  const minimumTeamGames = Math.min(homeGames, awayGames);
  const confidence = shadowProbability === null
    ? 0
    : Math.min(0.7, (minimumTeamGames / 8) * 0.45 + (Math.min(events.length, MAX_EVENTS) / MAX_EVENTS) * 0.25);

  return {
    version: HISTORICAL_RATING_SHADOW_VERSION,
    modelId: profile.modelId,
    status,
    sportKey,
    generatedAt: new Date(now).toISOString(),
    asOf: new Date(cutoff).toISOString(),
    selectionSide: side,
    provider: source,
    profile: {
      status: "research-default-not-calibrated",
      initialRating: INITIAL_RATING,
      ratingScale: RATING_SCALE,
      kFactor: profile.kFactor,
      homeAdvantageElo: profile.homeAdvantageElo,
      minimumTeamGames: profile.minimumTeamGames,
      minimumLeagueEvents: profile.minimumLeagueEvents
    },
    sample: {
      leagueEvents: events.length,
      homeTeamGames: homeGames,
      awayTeamGames: awayGames,
      maximumLeagueEvents: MAX_EVENTS
    },
    ratings: {
      home: round(homeRating, 3),
      away: round(awayRating, 3),
      differenceBeforeVenue: round(homeRating - awayRating, 3),
      differenceWithVenue: round(homeRating + profile.homeAdvantageElo - awayRating, 3)
    },
    homeShadowProbability: round(homeProbability),
    shadowProbability: round(shadowProbability),
    shadowConfidence: round(confidence, 4),
    chronologyGuard: true,
    trainingUsesOnlyCompletedEventsBeforeFixture: true,
    probabilityAppliedToProduction: false,
    edgeAdjusted: false,
    evAdjusted: false,
    usedForDecision: false,
    dependenceHint: "historical-results-family",
    formula: "P_home = 1 / (1 + 10^(-((R_home + H - R_away) / 400))); R_new = R_old + K * (actual - expected)",
    limitations: [
      "Ratings start at a common research baseline because the free recent-results feed does not provide a full historical preseason rating state.",
      "K-factor and home-advantage defaults are research settings and are not league-calibrated production parameters.",
      "This model shares historical-result signal with form/rest and must remain in the same top-level dependence group."
    ],
    paperOnly: true
  };
}

export function attachHistoricalRatingShadow(pick = {}, provider = {}, now = Date.now()) {
  const snapshot = buildHistoricalRatingShadow({ pick, provider, now });
  return {
    ...pick,
    historicalRatingShadow: snapshot,
    historicalRatingProbabilityApplied: false,
    modelProbability: pick.modelProbability,
    consensusProbability: pick.consensusProbability,
    edge: pick.edge,
    ev: pick.ev,
    decision: pick.decision,
    productDecision: pick.productDecision
  };
}

export const HISTORICAL_RATING_PROFILES = PROFILES;
