function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function logistic(diff, scale = 8) {
  return 1 / (1 + Math.exp(-diff / scale));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function getImpliedProbability(odds) {
  const o = toNumber(odds, 0);
  if (o <= 1) return 0;
  return 1 / o;
}

export function getExpectedValue(modelProbability, odds) {
  const p = toNumber(modelProbability, 0);
  const o = toNumber(odds, 0);
  if (o <= 1 || p <= 0) return 0;
  return o * p - 1;
}

export function getKellyFraction(modelProbability, odds) {
  const p = toNumber(modelProbability, 0);
  const o = toNumber(odds, 0);
  if (o <= 1 || p <= 0) return 0;

  const b = o - 1;
  const q = 1 - p;
  const kelly = (b * p - q) / b;

  return Math.max(0, kelly);
}

export function calculateBaseTeamStrength(teamStats) {
  const rating = toNumber(teamStats?.rating, 50);
  const formLast5 = toNumber(teamStats?.form_last_5, 50);
  const attack = toNumber(teamStats?.attack_rating, 50);
  const defense = toNumber(teamStats?.defense_rating, 50);
  const goalie = toNumber(teamStats?.goalie_rating, 50);
  const lineupStability = toNumber(teamStats?.lineup_stability, 50);
  const strengthOfSchedule = toNumber(teamStats?.strength_of_schedule, 50);

  return (
    rating * 0.28 +
    formLast5 * 0.17 +
    attack * 0.16 +
    defense * 0.14 +
    goalie * 0.10 +
    lineupStability * 0.08 +
    strengthOfSchedule * 0.07
  );
}

export function calculateXgAdjustment(teamStats) {
  const xgFor = toNumber(teamStats?.xg_for_last_5, 0);
  const xgAgainst = toNumber(teamStats?.xg_against_last_5, 0);
  return clamp((xgFor - xgAgainst) * 2.4, -12, 12);
}

export function calculateContextAdjustment({
  isHome,
  restDays,
  scheduleLoad7d,
  travelKm7d,
  timezonePenalty,
  injuriesCount,
  teamStats,
}) {
  const homeAdvantage = toNumber(teamStats?.home_advantage, 0);
  const fatigueIndex = toNumber(teamStats?.fatigue_index, 0);

  const restBonus = clamp((toNumber(restDays, 0) - 2) * 0.8, -3, 3);
  const schedulePenalty = clamp(toNumber(scheduleLoad7d, 0) * -0.7, -5, 0);
  const travelPenalty = clamp((toNumber(travelKm7d, 0) / 250) * -0.35, -6, 0);
  const timezonePenaltyAdj = clamp(toNumber(timezonePenalty, 0) * -1.0, -4, 0);
  const injuryPenalty = clamp(toNumber(injuriesCount, 0) * -1.5, -10, 0);
  const fatiguePenalty = clamp(toNumber(fatigueIndex, 0) * -1.0, -8, 0);
  const homeBonus = isHome ? homeAdvantage : 0;

  return (
    homeBonus +
    restBonus +
    schedulePenalty +
    travelPenalty +
    timezonePenaltyAdj +
    injuryPenalty +
    fatiguePenalty
  );
}

export function calculatePlayerAdjustment(players) {
  if (!Array.isArray(players) || players.length === 0) return 0;

  const weighted = players.map((p) => {
    const availability = toNumber(p.availability, 1);
    const suspended = Boolean(p.suspension_status);
    const roleImportance = toNumber(p.role_importance, 50);
    const form = toNumber(p.form_rating, 50);
    const attackImpact = toNumber(p.attack_impact, 50);
    const defenseImpact = toNumber(p.defense_impact, 50);
    const playmaking = toNumber(p.playmaking_impact, 50);
    const fatigue = toNumber(p.fatigue, 0);

    const roleWeight = roleImportance / 100;
    const performanceCore =
      attackImpact * 0.4 +
      defenseImpact * 0.3 +
      playmaking * 0.2 +
      form * 0.1;

    const availabilityMultiplier = suspended ? 0 : availability;
    const fatiguePenalty = fatigue * 0.25;

    return performanceCore * roleWeight * availabilityMultiplier - fatiguePenalty;
  });

  const avg = average(weighted);
  return clamp((avg - 25) * 0.35, -12, 12);
}

export function pickBestOddsForTeams(oddsRows, homeTeam, awayTeam) {
  let bestHomeOdds = null;
  let bestAwayOdds = null;
  let bestDrawOdds = null;

  for (const row of oddsRows || []) {
    const outcome = row?.outcome_name;
    const odds = toNumber(row?.odds, 0);

    if (!outcome || odds <= 1) continue;

    if (outcome === homeTeam && (!bestHomeOdds || odds > bestHomeOdds)) {
      bestHomeOdds = odds;
    }

    if (outcome === awayTeam && (!bestAwayOdds || odds > bestAwayOdds)) {
      bestAwayOdds = odds;
    }

    if (
      String(outcome).toLowerCase() === "draw" &&
      (!bestDrawOdds || odds > bestDrawOdds)
    ) {
      bestDrawOdds = odds;
    }
  }

  return { bestHomeOdds, bestAwayOdds, bestDrawOdds };
}

export function buildQuickModel({
  homeTeamStats,
  awayTeamStats,
  homePlayers = [],
  awayPlayers = [],
  context,
  oddsRows = [],
}) {
  const homeBaseStrength = calculateBaseTeamStrength(homeTeamStats);
  const awayBaseStrength = calculateBaseTeamStrength(awayTeamStats);

  const homeXgAdjustment = calculateXgAdjustment(homeTeamStats);
  const awayXgAdjustment = calculateXgAdjustment(awayTeamStats);

  const homeContextAdjustment = calculateContextAdjustment({
    isHome: true,
    restDays: context?.rest_days_home,
    scheduleLoad7d: context?.schedule_load_7d_home,
    travelKm7d: context?.travel_km_7d_home,
    timezonePenalty: context?.timezone_penalty_home,
    injuriesCount: homeTeamStats?.injuries_count,
    teamStats: homeTeamStats,
  });

  const awayContextAdjustment = calculateContextAdjustment({
    isHome: false,
    restDays: context?.rest_days_away,
    scheduleLoad7d: context?.schedule_load_7d_away,
    travelKm7d: context?.travel_km_7d_away,
    timezonePenalty: context?.timezone_penalty_away,
    injuriesCount: awayTeamStats?.injuries_count,
    teamStats: awayTeamStats,
  });

  const homePlayerAdjustment = calculatePlayerAdjustment(homePlayers);
  const awayPlayerAdjustment = calculatePlayerAdjustment(awayPlayers);

  const homeFinalStrength =
    homeBaseStrength +
    homeXgAdjustment +
    homeContextAdjustment +
    homePlayerAdjustment;

  const awayFinalStrength =
    awayBaseStrength +
    awayXgAdjustment +
    awayContextAdjustment +
    awayPlayerAdjustment;

  const strengthDiff = homeFinalStrength - awayFinalStrength;

  const homeWinProbability = logistic(strengthDiff, 8);
  const awayWinProbability = 1 - homeWinProbability;

  const { bestHomeOdds, bestAwayOdds, bestDrawOdds } = pickBestOddsForTeams(
    oddsRows,
    context?.home_team,
    context?.away_team
  );

  const marketHomeProbability = getImpliedProbability(bestHomeOdds);
  const marketAwayProbability = getImpliedProbability(bestAwayOdds);
  const marketDrawProbability = getImpliedProbability(bestDrawOdds);

  const edgeHome = homeWinProbability - marketHomeProbability;
  const edgeAway = awayWinProbability - marketAwayProbability;

  const evHome = getExpectedValue(homeWinProbability, bestHomeOdds);
  const evAway = getExpectedValue(awayWinProbability, bestAwayOdds);

  const kellyHome = getKellyFraction(homeWinProbability, bestHomeOdds);
  const kellyAway = getKellyFraction(awayWinProbability, bestAwayOdds);

  const recommendedSide =
    evHome > evAway && evHome > 0
      ? "home"
      : evAway > evHome && evAway > 0
      ? "away"
      : null;

  return {
    modelVersion: "v1_quick_db_xg",
    homeBaseStrength,
    awayBaseStrength,
    homeXgAdjustment,
    awayXgAdjustment,
    homeContextAdjustment,
    awayContextAdjustment,
    homePlayerAdjustment,
    awayPlayerAdjustment,
    homeFinalStrength,
    awayFinalStrength,
    homeWinProbability,
    awayWinProbability,
    bestHomeOdds,
    bestAwayOdds,
    bestDrawOdds,
    marketHomeProbability,
    marketAwayProbability,
    marketDrawProbability,
    edgeHome,
    edgeAway,
    evHome,
    evAway,
    kellyHome,
    kellyAway,
    recommendedSide,
  };
}
