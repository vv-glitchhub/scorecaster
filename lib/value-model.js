export function getBestOdds(game) {
  if (!game?.bookmakers || !Array.isArray(game.bookmakers)) return [];

  const best = {};

  for (const bookmaker of game.bookmakers) {
    const market = bookmaker?.markets?.find((m) => m.key === "h2h");
    if (!market?.outcomes) continue;

    for (const outcome of market.outcomes) {
      const price = Number(outcome.price || 0);
      if (!price) continue;

      if (!best[outcome.name] || price > best[outcome.name].price) {
        best[outcome.name] = {
          name: outcome.name,
          price,
          bookmaker: bookmaker.title || "-",
        };
      }
    }
  }

  return Object.values(best);
}

export function impliedProbability(odds) {
  const value = Number(odds || 0);
  if (value <= 1) return 0;
  return 1 / value;
}

export function normalizeMarketProbabilities(game) {
  const bestOdds = getBestOdds(game);

  const homeOdds = bestOdds.find((o) => o.name === game.home_team)?.price || 0;
  const awayOdds = bestOdds.find((o) => o.name === game.away_team)?.price || 0;
  const drawOdds = bestOdds.find((o) => o.name === "Draw")?.price || 0;

  const rawHome = impliedProbability(homeOdds);
  const rawDraw = impliedProbability(drawOdds);
  const rawAway = impliedProbability(awayOdds);

  const total = rawHome + rawDraw + rawAway;

  if (total <= 0) {
    return {
      home: 0.5,
      draw: 0,
      away: 0.5,
      bestOdds,
    };
  }

  return {
    home: rawHome / total,
    draw: rawDraw / total,
    away: rawAway / total,
    bestOdds,
  };
}

/**
 * Ensimmäinen oikea "oma malli":
 * - lähtee markkinaprobiksista
 * - lisää maltillisen kotiedun
 * - lisää pienen eron suosikille
 * - pitää totalin = 1
 */
export function buildModelProbabilities(game) {
  const market = normalizeMarketProbabilities(game);

  let home = market.home;
  let draw = market.draw;
  let away = market.away;

  const sportKey = game?.sport_key || "";

  // Peruskotietu
  const homeAdvantage =
    sportKey.includes("soccer") ? 0.03 :
    sportKey.includes("basketball") ? 0.025 :
    0.02;

  home += homeAdvantage;
  away -= homeAdvantage;

  // Suosikin vahvistus: jos ero on jo olemassa, lisätään pieni osa siihen
  const diff = home - away;
  const favoriteBoost = diff * 0.08;

  if (diff > 0) {
    home += favoriteBoost;
    away -= favoriteBoost;
  } else if (diff < 0) {
    away += Math.abs(favoriteBoost);
    home -= Math.abs(favoriteBoost);
  }

  // Jääkiekossa vähän tasaisempi malli kuin koriksessa
  if (sportKey.includes("icehockey")) {
    home = softenTowardsMiddle(home, 0.04);
    away = softenTowardsMiddle(away, 0.04);
  }

  // Jalkapallossa pidetään draw mukana vähän vahvempana
  if (sportKey.includes("soccer")) {
    draw += 0.015;
    home -= 0.0075;
    away -= 0.0075;
  }

  // Clamp
  home = clamp(home, 0.01, 0.95);
  draw = clamp(draw, 0, 0.35);
  away = clamp(away, 0.01, 0.95);

  // Normalisointi takaisin summaan 1
  const total = home + draw + away;
  home /= total;
  draw /= total;
  away /= total;

  return {
    home,
    draw,
    away,
    bestOdds: market.bestOdds,
    market,
  };
}

function softenTowardsMiddle(prob, amount) {
  if (prob > 0.5) return prob - amount;
  if (prob < 0.5) return prob + amount;
  return prob;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function calculateEV(prob, odds) {
  if (!prob || !odds || odds <= 1) return -1;
  return prob * odds - 1;
}

export function calculateKelly(prob, odds) {
  if (!prob || !odds || odds <= 1) return 0;

  const b = odds - 1;
  const q = 1 - prob;
  const kelly = (b * prob - q) / b;

  return Math.max(0, kelly);
}

export function getValueBet(game) {
  if (!game) return null;

  const model = buildModelProbabilities(game);
  const oddsList = model.bestOdds;

  const homeOdds = oddsList.find((o) => o.name === game.home_team);
  const awayOdds = oddsList.find((o) => o.name === game.away_team);
  const drawOdds = oddsList.find((o) => o.name === "Draw");

  const options = [
    homeOdds
      ? {
          outcome: game.home_team,
          odds: homeOdds.price,
          bookmaker: homeOdds.bookmaker,
          modelProb: model.home,
          marketProb: model.market.home,
        }
      : null,
    drawOdds
      ? {
          outcome: "Draw",
          odds: drawOdds.price,
          bookmaker: drawOdds.bookmaker,
          modelProb: model.draw,
          marketProb: model.market.draw,
        }
      : null,
    awayOdds
      ? {
          outcome: game.away_team,
          odds: awayOdds.price,
          bookmaker: awayOdds.bookmaker,
          modelProb: model.away,
          marketProb: model.market.away,
        }
      : null,
  ]
    .filter(Boolean)
    .map((item) => {
      const ev = calculateEV(item.modelProb, item.odds);
      const edge = item.modelProb - item.marketProb;
      const kelly = calculateKelly(item.modelProb, item.odds);

      return {
        ...item,
        ev,
        edge,
        kelly,
      };
    })
    .filter((item) => item.ev > 0)
    .sort((a, b) => b.ev - a.ev);

  return options[0] || null;
}

export function getStakeFromKelly(bankroll, kelly, fraction = 0.25) {
  const safeKelly = Math.max(0, Number(kelly || 0));
  const safeBankroll = Math.max(0, Number(bankroll || 0));
  return safeBankroll * safeKelly * fraction;
}
