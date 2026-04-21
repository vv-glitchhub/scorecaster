function decimal(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getBestPrice(bookmakers = [], marketKey, targetLabel) {
  let best = null;

  for (const bookmaker of bookmakers || []) {
    for (const market of bookmaker?.markets || []) {
      if (market?.key !== marketKey) continue;

      for (const outcome of market?.outcomes || []) {
        if (outcome?.name !== targetLabel) continue;
        const price = decimal(outcome?.price);
        if (price != null && (best == null || price > best)) {
          best = price;
        }
      }
    }
  }

  return best;
}

function getBestTotals(bookmakers = []) {
  let bestOver = null;
  let bestUnder = null;
  let point = null;

  for (const bookmaker of bookmakers || []) {
    for (const market of bookmaker?.markets || []) {
      if (market?.key !== "totals") continue;

      for (const outcome of market?.outcomes || []) {
        const price = decimal(outcome?.price);
        const outcomePoint = decimal(outcome?.point);

        if (outcome?.name === "Over" && price != null) {
          if (bestOver == null || price > bestOver) {
            bestOver = price;
            point = outcomePoint ?? point;
          }
        }

        if (outcome?.name === "Under" && price != null) {
          if (bestUnder == null || price > bestUnder) {
            bestUnder = price;
            point = outcomePoint ?? point;
          }
        }
      }
    }
  }

  return {
    point,
    over: bestOver,
    under: bestUnder,
  };
}

function getBestSpreads(bookmakers = [], homeTeam, awayTeam) {
  let spreadHome = null;
  let spreadAway = null;
  let spreadPointHome = null;
  let spreadPointAway = null;

  for (const bookmaker of bookmakers || []) {
    for (const market of bookmaker?.markets || []) {
      if (market?.key !== "spreads") continue;

      for (const outcome of market?.outcomes || []) {
        const price = decimal(outcome?.price);
        const point = decimal(outcome?.point);

        if (outcome?.name === homeTeam && price != null) {
          if (spreadHome == null || price > spreadHome) {
            spreadHome = price;
            spreadPointHome = point;
          }
        }

        if (outcome?.name === awayTeam && price != null) {
          if (spreadAway == null || price > spreadAway) {
            spreadAway = price;
            spreadPointAway = point;
          }
        }
      }
    }
  }

  return {
    spreadPointHome,
    spreadPointAway,
    spreadHome,
    spreadAway,
  };
}

function normalizeMatch(match = {}) {
  const homeTeam = match?.home_team || "Home";
  const awayTeam = match?.away_team || "Away";
  const bookmakers = Array.isArray(match?.bookmakers) ? match.bookmakers : [];

  const home = getBestPrice(bookmakers, "h2h", homeTeam);
  const away = getBestPrice(bookmakers, "h2h", awayTeam);
  const draw = getBestPrice(bookmakers, "h2h", "Draw");

  const totals = getBestTotals(bookmakers);
  const spreads = getBestSpreads(bookmakers, homeTeam, awayTeam);

  return {
    ...match,
    id:
      match?.id ||
      `${match?.sport_key || "sport"}:${homeTeam}:${awayTeam}:${
        match?.commence_time || "time"
      }`,
    home_team: homeTeam,
    away_team: awayTeam,
    sport_title: match?.sport_title || match?.sport_key || "-",
    bestOdds: {
      home,
      draw,
      away,
      point: totals.point,
      over: totals.over,
      under: totals.under,
      spreadPointHome: spreads.spreadPointHome,
      spreadPointAway: spreads.spreadPointAway,
      spreadHome: spreads.spreadHome,
      spreadAway: spreads.spreadAway,
    },
  };
}

export function normalizeOddsPayload(payload = {}) {
  return {
    source: payload?.source || "unknown",
    status: payload?.status || "fresh",
    reason: payload?.reason || "",
    matches: Array.isArray(payload?.matches)
      ? payload.matches.map(normalizeMatch)
      : [],
  };
}

export async function getOddsData({ sport = "icehockey_liiga" } = {}) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/odds?sport=${sport}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`getOddsData failed with ${response.status}`);
  }

  const payload = await response.json();
  return normalizeOddsPayload(payload);
}
