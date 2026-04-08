function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
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
  const drawRaw = Number.isFinite(drawOdds) && drawOdds > 1 ? 1 / drawOdds : 0.22;
  const awayRaw = Number.isFinite(awayOdds) && awayOdds > 1 ? 1 / awayOdds : 0.33;

  const total = homeRaw + drawRaw + awayRaw;

  return {
    home: homeRaw / total,
    draw: drawRaw / total,
    away: awayRaw / total,
  };
}

function getTeamStrength(teamRating) {
  if (!teamRating) return 50;

  const attack = safeNumber(teamRating.attack_rating, 50);
  const defense = safeNumber(teamRating.defense_rating, 50);
  const form = safeNumber(teamRating.form_last_5, 50);
  const xg = safeNumber(teamRating.xg_rating, 50);
  const sos = safeNumber(teamRating.strength_of_schedule, 50);

  return (
    attack * 0.28 +
    defense * 0.24 +
    form * 0.18 +
    xg * 0.2 +
    sos * 0.1
  );
}

function getDrawLean(homeStrength, awayStrength) {
  const diff = Math.abs(homeStrength - awayStrength);

  if (diff <= 3) return 0.24;
  if (diff <= 7) return 0.22;
  if (diff <= 12) return 0.2;
  return 0.17;
}

export async function getModelProbabilitiesForMatch({
  match,
  oddsData,
  teamRatings = null,
}) {
  const namedBestOdds = getNamedBestH2HOutcomes(match, oddsData);
  const marketBase = impliedProbabilitiesFromBestOdds(namedBestOdds);

  const homeRating = teamRatings?.[match?.home_team] ?? null;
  const awayRating = teamRatings?.[match?.away_team] ?? null;

  if (!homeRating || !awayRating) {
    return normalizeProbabilities(
      marketBase.home,
      marketBase.draw,
      marketBase.away
    );
  }

  const homeStrength = getTeamStrength(homeRating);
  const awayStrength = getTeamStrength(awayRating);

  const rawHome = clamp(
    marketBase.home + (homeStrength - awayStrength) / 300,
    0.05,
    0.85
  );

  const rawAway = clamp(
    marketBase.away + (awayStrength - homeStrength) / 300,
    0.05,
    0.85
  );

  const rawDraw = clamp(getDrawLean(homeStrength, awayStrength), 0.08, 0.35);

  return normalizeProbabilities(rawHome, rawDraw, rawAway);
}

export function buildQuickModel(input = {}) {
  const homeProb = safeNumber(input.home_probability, 0.45);
  const drawProb = safeNumber(input.draw_probability, 0.22);
  const awayProb = safeNumber(input.away_probability, 0.33);

  return normalizeProbabilities(homeProb, drawProb, awayProb);
}
