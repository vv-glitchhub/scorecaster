import { getMatchTeamProfiles } from "./team-ratings";

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeProbabilities(home, draw, away) {
  const h = Math.max(0.0001, safeNumber(home));
  const d = Math.max(0.0001, safeNumber(draw));
  const a = Math.max(0.0001, safeNumber(away));

  const total = h + d + a;

  return {
    home: h / total,
    draw: d / total,
    away: a / total,
  };
}

function getNamedBestH2HOutcomes(match, oddsData) {
  const bookmakers = Array.isArray(oddsData?.bookmakers)
    ? oddsData.bookmakers
    : [];

  let bestHome = null;
  let bestAway = null;
  let bestDraw = null;

  for (const bookmaker of bookmakers) {
    const h2h = bookmaker?.markets?.find((market) => market?.key === "h2h");
    if (!h2h?.outcomes) continue;

    for (const outcome of h2h.outcomes) {
      const name = String(outcome?.name ?? "").trim();
      const price = Number(outcome?.price ?? outcome?.odds);
      if (!Number.isFinite(price)) continue;

      if (name === match?.home_team) {
        if (bestHome === null || price > bestHome) bestHome = price;
      } else if (name === match?.away_team) {
        if (bestAway === null || price > bestAway) bestAway = price;
      } else if (name.toLowerCase() === "draw" || name.toLowerCase() === "tie") {
        if (bestDraw === null || price > bestDraw) bestDraw = price;
      }
    }
  }

  return {
    home: bestHome,
    draw: bestDraw,
    away: bestAway,
  };
}

function impliedProbabilitiesFromBestOdds(bestOdds) {
  const homeOdds = Number(bestOdds?.home);
  const drawOdds = Number(bestOdds?.draw);
  const awayOdds = Number(bestOdds?.away);

  const homeRaw = Number.isFinite(homeOdds) && homeOdds > 1 ? 1 / homeOdds : 0.45;
  const drawRaw = Number.isFinite(drawOdds) && drawOdds > 1 ? 1 / drawOdds : 0.2;
  const awayRaw = Number.isFinite(awayOdds) && awayOdds > 1 ? 1 / awayOdds : 0.35;

  const total = homeRaw + drawRaw + awayRaw;

  return {
    home: homeRaw / total,
    draw: drawRaw / total,
    away: awayRaw / total,
  };
}

function buildFactorBreakdown(homeTeam, awayTeam) {
  const attackEdge = (homeTeam.attack_rating - awayTeam.defense_rating) * 0.0035;
  const defenseEdge = (homeTeam.defense_rating - awayTeam.attack_rating) * 0.0025;
  const formEdge = (homeTeam.form_last_5 - awayTeam.form_last_5) * 0.002;
  const restEdge = (homeTeam.rest_days - awayTeam.rest_days) * 0.015;
  const travelEdge = (awayTeam.travel_km - homeTeam.travel_km) * 0.00006;
  const injuryEdge = (awayTeam.injuries_count - homeTeam.injuries_count) * 0.018;
  const lineupEdge = (homeTeam.lineup_stability - awayTeam.lineup_stability) * 0.0014;
  const homeAdvantageEdge = (homeTeam.home_advantage ?? 4) * 0.01;

  return {
    attackEdge,
    defenseEdge,
    formEdge,
    restEdge,
    travelEdge,
    injuryEdge,
    lineupEdge,
    homeAdvantageEdge,
  };
}

export async function getModelProbabilitiesForMatch({
  match,
  oddsData,
  teamRatings = null,
}) {
  const namedBestOdds = getNamedBestH2HOutcomes(match, oddsData);
  const marketBase = impliedProbabilitiesFromBestOdds(namedBestOdds);

  const teams = getMatchTeamProfiles(match, teamRatings);
  const factors = buildFactorBreakdown(teams.home, teams.away);

  const totalHomeShift =
    factors.attackEdge +
    factors.defenseEdge +
    factors.formEdge +
    factors.restEdge +
    factors.travelEdge +
    factors.injuryEdge +
    factors.lineupEdge +
    factors.homeAdvantageEdge;

  const rawHome = clamp(marketBase.home + totalHomeShift, 0.05, 0.9);
  const rawAway = clamp(marketBase.away - totalHomeShift, 0.05, 0.9);

  let rawDraw = clamp(
    0.2 +
      Math.abs(teams.home.defense_rating - teams.away.defense_rating) * 0.0003 -
      Math.abs(teams.home.attack_rating - teams.away.attack_rating) * 0.0004,
    0.12,
    0.32
  );

  const normalized = normalizeProbabilities(rawHome, rawDraw, rawAway);

  return {
    ...normalized,
    debug: {
      marketBase,
      teams,
      factors,
      rawBeforeNormalize: {
        home: rawHome,
        draw: rawDraw,
        away: rawAway,
      },
    },
  };
}

export function buildQuickModel(input = {}) {
  const homeProb = safeNumber(input.home_probability, 0.45);
  const drawProb = safeNumber(input.draw_probability, 0.2);
  const awayProb = safeNumber(input.away_probability, 0.35);

  return normalizeProbabilities(homeProb, drawProb, awayProb);
}
