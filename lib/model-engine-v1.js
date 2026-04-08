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
  const drawRaw = Number.isFinite(drawOdds) && drawOdds > 1 ? 1 / drawOdds : 0.2;
  const awayRaw = Number.isFinite(awayOdds) && awayOdds > 1 ? 1 / awayOdds : 0.35;

  const total = homeRaw + drawRaw + awayRaw;

  return {
    home: homeRaw / total,
    draw: drawRaw / total,
    away: awayRaw / total,
  };
}

export async function getModelProbabilitiesForMatch({
  match,
  oddsData,
  teamRatings = null,
}) {
  const namedBestOdds = getNamedBestH2HOutcomes(match, oddsData);
  const marketBase = impliedProbabilitiesFromBestOdds(namedBestOdds);

  const homeAdjust = 0.054;
  const awayAdjust = -0.054;
  const drawBase = 0.2;

  const rawHome = clamp(marketBase.home + homeAdjust, 0.05, 0.9);
  const rawAway = clamp(marketBase.away + awayAdjust, 0.05, 0.9);
  const rawDraw = clamp(drawBase, 0.05, 0.35);

  return normalizeProbabilities(rawHome, rawDraw, rawAway);
}

export function buildQuickModel(input = {}) {
  const homeProb = safeNumber(input.home_probability, 0.45);
  const drawProb = safeNumber(input.draw_probability, 0.2);
  const awayProb = safeNumber(input.away_probability, 0.35);

  return normalizeProbabilities(homeProb, drawProb, awayProb);
}
