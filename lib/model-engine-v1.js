function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeOutcomeName(name) {
  const value = String(name ?? "").trim();
  if (!value) return "";
  const lower = value.toLowerCase();
  if (lower === "draw" || lower === "tie" || lower === "x") return "Draw";
  return value;
}

function getAllOutcomes(match, oddsData) {
  const bookmakers = Array.isArray(oddsData?.bookmakers) ? oddsData.bookmakers : [];
  const names = new Set();

  for (const bookmaker of bookmakers) {
    const markets = Array.isArray(bookmaker?.markets) ? bookmaker.markets : [];
    const h2h = markets.find((m) => m?.key === "h2h");
    const outcomes = Array.isArray(h2h?.outcomes) ? h2h.outcomes : [];

    for (const outcome of outcomes) {
      const name = normalizeOutcomeName(outcome?.name);
      if (name) names.add(name);
    }
  }

  if (match?.home_team) names.add(normalizeOutcomeName(match.home_team));
  if (match?.away_team) names.add(normalizeOutcomeName(match.away_team));

  return Array.from(names);
}

function averageBestOddsByOutcome(oddsData) {
  const bookmakers = Array.isArray(oddsData?.bookmakers) ? oddsData.bookmakers : [];
  const best = new Map();

  for (const bookmaker of bookmakers) {
    const markets = Array.isArray(bookmaker?.markets) ? bookmaker.markets : [];
    const h2h = markets.find((m) => m?.key === "h2h");
    const outcomes = Array.isArray(h2h?.outcomes) ? h2h.outcomes : [];

    for (const outcome of outcomes) {
      const name = normalizeOutcomeName(outcome?.name);
      const odds = safeNumber(outcome?.price ?? outcome?.odds, NaN);
      if (!name || !Number.isFinite(odds) || odds <= 1) continue;

      if (!best.has(name) || odds > best.get(name)) {
        best.set(name, odds);
      }
    }
  }

  return best;
}

function normalizeProbabilityMap(map) {
  const entries = Object.entries(map).filter(
    ([key, value]) => key && Number.isFinite(Number(value)) && Number(value) > 0
  );

  const total = entries.reduce((sum, [, value]) => sum + Number(value), 0);
  if (total <= 0) return {};

  return Object.fromEntries(
    entries.map(([key, value]) => [key, Number(value) / total])
  );
}

function buildBaseFromOdds(match, oddsData) {
  const best = averageBestOddsByOutcome(oddsData);
  const base = {};

  for (const [name, odds] of best.entries()) {
    base[name] = 1 / odds;
  }

  const normalized = normalizeProbabilityMap(base);
  if (Object.keys(normalized).length > 0) return normalized;

  const hasDraw = getAllOutcomes(match, oddsData).includes("Draw");

  if (hasDraw) {
    return normalizeProbabilityMap({
      [normalizeOutcomeName(match?.home_team)]: 0.42,
      Draw: 0.24,
      [normalizeOutcomeName(match?.away_team)]: 0.34,
    });
  }

  return normalizeProbabilityMap({
    [normalizeOutcomeName(match?.home_team)]: 0.52,
    [normalizeOutcomeName(match?.away_team)]: 0.48,
  });
}

function applySportBiases(match, probabilityMap) {
  const sportKey = String(match?.sport_key ?? "").toLowerCase();
  const home = normalizeOutcomeName(match?.home_team);
  const away = normalizeOutcomeName(match?.away_team);

  const adjusted = { ...probabilityMap };

  if (sportKey.startsWith("icehockey_")) {
    adjusted[home] = safeNumber(adjusted[home], 0) + 0.015;
    adjusted[away] = safeNumber(adjusted[away], 0) - 0.015;
  } else if (sportKey.startsWith("basketball_")) {
    adjusted[home] = safeNumber(adjusted[home], 0) + 0.02;
    adjusted[away] = safeNumber(adjusted[away], 0) - 0.02;
  } else if (sportKey.startsWith("soccer_")) {
    adjusted.Draw = safeNumber(adjusted.Draw, 0) + 0.01;
    adjusted[home] = safeNumber(adjusted[home], 0) + 0.005;
    adjusted[away] = safeNumber(adjusted[away], 0) - 0.015;
  } else if (sportKey.startsWith("americanfootball_")) {
    adjusted[home] = safeNumber(adjusted[home], 0) + 0.018;
    adjusted[away] = safeNumber(adjusted[away], 0) - 0.018;
  }

  return normalizeProbabilityMap(adjusted);
}

function buildDebug(match, probabilityMap) {
  return {
    sport_key: match?.sport_key ?? null,
    home_team: match?.home_team ?? null,
    away_team: match?.away_team ?? null,
    mappedOutcomes: probabilityMap,
  };
}

export async function getModelProbabilitiesForMatch({
  match,
  oddsData,
  teamRatings = null,
}) {
  const base = buildBaseFromOdds(match, oddsData);
  let adjusted = applySportBiases(match, base);

  if (teamRatings && typeof teamRatings === "object") {
    const home = normalizeOutcomeName(match?.home_team);
    const away = normalizeOutcomeName(match?.away_team);

    const homeRating = safeNumber(teamRatings?.[home]?.rating, 0);
    const awayRating = safeNumber(teamRatings?.[away]?.rating, 0);

    if (homeRating || awayRating) {
      const diff = clamp((homeRating - awayRating) / 100, -0.06, 0.06);
      adjusted = normalizeProbabilityMap({
        ...adjusted,
        [home]: safeNumber(adjusted[home], 0) + diff,
        [away]: safeNumber(adjusted[away], 0) - diff,
      });
    }
  }

  return {
    ...adjusted,
    debug: buildDebug(match, adjusted),
  };
}
