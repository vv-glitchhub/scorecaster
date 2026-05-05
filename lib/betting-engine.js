import { isBettableMatch } from "@/lib/data-status";

export function impliedProb(odds) {
  const n = Number(odds);
  if (!Number.isFinite(n) || n <= 1) return null;
  return 1 / n;
}

export function expectedValue(odds, probability) {
  const o = Number(odds);
  const p = Number(probability);
  if (!Number.isFinite(o) || !Number.isFinite(p)) return null;
  return o * p - 1;
}

export function kellyStake(probability, odds, bankroll = 1000, fraction = 0.25) {
  const p = Number(probability);
  const o = Number(odds);
  const b = Number(bankroll);

  if (!Number.isFinite(p) || !Number.isFinite(o) || !Number.isFinite(b)) return 0;
  if (p <= 0 || p >= 1 || o <= 1 || b <= 0) return 0;

  const kelly = (o * p - 1) / (o - 1);
  return Number(Math.max(0, kelly * b * fraction).toFixed(2));
}

function normalizeProbs({ home, draw, away }) {
  const h = home || 0;
  const d = draw || 0;
  const a = away || 0;
  const total = h + d + a;

  if (!total) {
    return { home: 0.45, draw: 0.23, away: 0.32 };
  }

  return {
    home: h / total,
    draw: d / total,
    away: a / total,
  };
}

function modelProbabilities(match) {
  const market = normalizeProbs({
    home: impliedProb(match?.bestOdds?.home),
    draw: impliedProb(match?.bestOdds?.draw),
    away: impliedProb(match?.bestOdds?.away),
  });

  const hasDraw = Boolean(match?.bestOdds?.draw);

  const model = {
    home: market.home + 0.015,
    draw: hasDraw ? market.draw - 0.005 : 0,
    away: market.away + 0.01,
  };

  return normalizeProbs(model);
}

export function analyzeRows(match, market = "h2h", bankroll = 1000) {
  if (!match || !isBettableMatch(match)) return [];

  const model = modelProbabilities(match);
  let rows = [];

  if (market === "totals") {
    rows = [
      {
        key: "over",
        label: `Over ${match.bestOdds?.point ?? "-"}`,
        odds: match.bestOdds?.over,
        modelProb: 0.52,
      },
      {
        key: "under",
        label: `Under ${match.bestOdds?.point ?? "-"}`,
        odds: match.bestOdds?.under,
        modelProb: 0.48,
      },
    ];
  } else if (market === "spreads") {
    rows = [
      {
        key: "spread-home",
        label: `${match.home_team} ${match.bestOdds?.spreadPointHome || ""}`,
        odds: match.bestOdds?.spreadHome,
        modelProb: 0.52,
      },
      {
        key: "spread-away",
        label: `${match.away_team} ${match.bestOdds?.spreadPointAway || ""}`,
        odds: match.bestOdds?.spreadAway,
        modelProb: 0.48,
      },
    ];
  } else {
    rows = [
      {
        key: "home",
        label: match.home_team,
        odds: match.bestOdds?.home,
        modelProb: model.home,
      },
      {
        key: "draw",
        label: "Tasapeli",
        odds: match.bestOdds?.draw,
        modelProb: model.draw,
      },
      {
        key: "away",
        label: match.away_team,
        odds: match.bestOdds?.away,
        modelProb: model.away,
      },
    ];
  }

  return rows
    .filter((row) => row.odds)
    .map((row) => {
      const marketProb = impliedProb(row.odds);
      const ev = expectedValue(row.odds, row.modelProb);
      const edge = marketProb != null ? row.modelProb - marketProb : null;
      const stake = kellyStake(row.modelProb, row.odds, bankroll, 0.25);

      const shouldBet = edge > 0.025 && ev > 0 && stake > 0;

      return {
        ...row,
        marketProb,
        edge,
        ev,
        stake,
        shouldBet,
        strength:
          edge >= 0.07
            ? "Vahva"
            : edge >= 0.04
            ? "Hyvä"
            : edge >= 0.025
            ? "Pieni"
            : "Ei valuea",
      };
    });
}

export function getBestBets(matches = [], bankroll = 1000) {
  return matches
    .filter(isBettableMatch)
    .flatMap((match) =>
      analyzeRows(match, "h2h", bankroll).map((pick) => ({
        ...pick,
        match,
        id: `${match.id}-${pick.key}`,
      }))
    )
    .filter((pick) => pick.shouldBet)
    .sort((a, b) => b.edge - a.edge)
    .slice(0, 8);
}
