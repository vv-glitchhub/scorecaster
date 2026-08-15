const HOUR_MS = 60 * 60 * 1000;

export const REST_HISTORY_FRESHNESS_VERSION = "scorecaster-rest-history-freshness-v1";

const MAX_AGE_HOURS = Object.freeze({
  basketball_nba: 21 * 24,
  basketball_wnba: 21 * 24,
  baseball_mlb: 14 * 24,
  icehockey_nhl: 30 * 24,
  soccer_epl: 45 * 24,
  soccer_spain_la_liga: 45 * 24,
  soccer_usa_mls: 45 * 24,
  soccer_finland_veikkausliiga: 45 * 24,
  soccer_sweden_allsvenskan: 45 * 24,
  soccer_norway_eliteserien: 45 * 24
});

function clean(value, limit = 120) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sportKey(pick = {}) {
  return clean(pick.sportKey || pick.league || pick.formRestShadow?.sportKey, 120);
}

function maxAgeHoursForSport(key) {
  if (MAX_AGE_HOURS[key]) return MAX_AGE_HOURS[key];
  if (key.includes("basketball")) return 21 * 24;
  if (key.includes("baseball")) return 14 * 24;
  if (key.includes("hockey")) return 30 * 24;
  if (key.includes("soccer") || key.includes("football")) return 45 * 24;
  return 45 * 24;
}

function kickoffTimestamp(pick = {}, shadow = {}) {
  const candidate = pick.commenceTime || pick.commence_time || shadow.asOf;
  const parsed = Date.parse(String(candidate || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function sideAudit(side = {}, kickoff, maxAgeHours) {
  const lastPlayedAt = clean(side.lastPlayedAt, 80) || null;
  const playedAt = Date.parse(String(lastPlayedAt || ""));
  const reportedRest = numberOrNull(side.restHours);

  if (!lastPlayedAt || !Number.isFinite(playedAt)) {
    return {
      status: "insufficient-history",
      lastPlayedAt: null,
      ageHours: null,
      reportedRestHours: reportedRest,
      restMatchesHistory: false,
      usable: false
    };
  }

  if (!Number.isFinite(kickoff) || playedAt >= kickoff) {
    return {
      status: "invalid-chronology",
      lastPlayedAt,
      ageHours: null,
      reportedRestHours: reportedRest,
      restMatchesHistory: false,
      usable: false
    };
  }

  const ageHours = Math.max(0, (kickoff - playedAt) / HOUR_MS);
  const restMatchesHistory = reportedRest !== null && Math.abs(reportedRest - ageHours) <= 6;
  if (ageHours > maxAgeHours) {
    return {
      status: "stale-history",
      lastPlayedAt,
      ageHours: Number(ageHours.toFixed(2)),
      reportedRestHours: reportedRest,
      restMatchesHistory,
      usable: false
    };
  }

  if (!restMatchesHistory) {
    return {
      status: "unverified-rest",
      lastPlayedAt,
      ageHours: Number(ageHours.toFixed(2)),
      reportedRestHours: reportedRest,
      restMatchesHistory: false,
      usable: false
    };
  }

  return {
    status: "ready",
    lastPlayedAt,
    ageHours: Number(ageHours.toFixed(2)),
    reportedRestHours: reportedRest,
    restMatchesHistory: true,
    usable: true
  };
}

function scrubSide(side = {}) {
  return {
    ...side,
    restHours: undefined,
    restDays: undefined,
    restScore: undefined,
    backToBack: false,
    gamesLast7Days: undefined,
    gamesLast14Days: undefined,
    congestionScore: undefined
  };
}

function scrubCompactSide(side = {}) {
  return {
    ...side,
    restHours: undefined,
    restDays: undefined,
    backToBack: false,
    gamesLast7Days: undefined,
    gamesLast14Days: undefined
  };
}

function scrubRestFeatures(features = {}) {
  return {
    ...features,
    homeRestAdvantage: undefined,
    homeCongestionAdvantage: undefined
  };
}

export function applyRestHistoryFreshnessGuardV1(pick = {}, { now = Date.now() } = {}) {
  const shadow = pick.formRestShadow && typeof pick.formRestShadow === "object" ? pick.formRestShadow : null;
  if (!shadow) return pick;

  const key = sportKey(pick);
  const maxAgeHours = maxAgeHoursForSport(key);
  const kickoff = kickoffTimestamp(pick, shadow);
  const home = sideAudit(shadow.home || {}, kickoff, maxAgeHours);
  const away = sideAudit(shadow.away || {}, kickoff, maxAgeHours);
  const ready = home.usable && away.usable;
  const status = ready
    ? "ready"
    : [home.status, away.status].includes("invalid-chronology")
      ? "invalid-chronology"
      : [home.status, away.status].includes("stale-history")
        ? "stale-history"
        : [home.status, away.status].includes("unverified-rest")
          ? "unverified-rest"
          : "insufficient-history";

  const guardedShadow = ready
    ? shadow
    : {
        ...shadow,
        home: scrubSide(shadow.home),
        away: scrubSide(shadow.away),
        features: scrubRestFeatures(shadow.features)
      };

  const featureSnapshot = pick.featureSnapshot && typeof pick.featureSnapshot === "object"
    ? ready
      ? pick.featureSnapshot
      : {
          ...pick.featureSnapshot,
          home: scrubCompactSide(pick.featureSnapshot.home),
          away: scrubCompactSide(pick.featureSnapshot.away),
          features: scrubRestFeatures(pick.featureSnapshot.features)
        }
    : pick.featureSnapshot;

  return {
    ...pick,
    formRestShadow: guardedShadow,
    featureSnapshot,
    restHistoryFreshness: {
      version: REST_HISTORY_FRESHNESS_VERSION,
      status,
      sportKey: key,
      maxAgeHours,
      kickoffAt: Number.isFinite(kickoff) ? new Date(kickoff).toISOString() : null,
      evaluatedAt: new Date(now).toISOString(),
      home,
      away,
      restEvidenceUsable: ready,
      failClosed: true,
      probabilityChanged: false,
      edgeChanged: false,
      evChanged: false,
      decisionChanged: false,
      stakeChanged: false,
      paperOnly: true
    },
    modelProbability: pick.modelProbability,
    consensusProbability: pick.consensusProbability,
    edge: pick.edge,
    ev: pick.ev,
    decision: pick.decision,
    productDecision: pick.productDecision
  };
}

export const REST_HISTORY_FRESHNESS_POLICY = Object.freeze({
  version: REST_HISTORY_FRESHNESS_VERSION,
  maxAgeHoursBySport: MAX_AGE_HOURS,
  defaultMaxAgeHours: 45 * 24,
  reportedRestToleranceHours: 6,
  requiresBothTeams: true,
  requiresRealLastPlayedAt: true,
  requiresChronology: true,
  probabilityChanged: false,
  decisionChanged: false,
  stakeChanged: false,
  paperOnly: true
});
