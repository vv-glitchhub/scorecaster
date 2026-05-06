import { isBettableMatch } from "@/lib/data-status";

const MIN_ODDS = 1.2;
const MAX_ODDS = 15;
const MIN_EDGE = 0.025;
const MAX_STAKE_PERCENT = 0.03;

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

export function isReasonableOdds(odds) {
  const n = Number(odds);
  return Number.isFinite(n) && n >= MIN_ODDS && n <= MAX_ODDS;
}

export function kellyStake(probability, odds, bankroll = 1000, fraction = 0.25) {
  const p = Number(probability);
  const o = Number(odds);
  const b = Number(bankroll);

  if (!Number.isFinite(p) || !Number.isFinite(o) || !Number.isFinite(b)) return 0;
  if (p <= 0 || p >= 1 || o <= 1 || b <= 0) return 0;

  const rawKelly = (o * p - 1) / (o - 1);
  const stake = Math.max(0, rawKelly * b * fraction);
  const maxStake = b * MAX_STAKE_PERCENT;

  return Number(Math.min(stake, maxStake).toFixed(2));
}

function normalizeProbs({ home, draw, away }) {
  const h = home || 0;
  const d = draw || 0;
  const a = away || 0;
  const total = h + d + a;

  if (!total) return { home: 0.45, draw: 0.23, away: 0.32 };

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

  return normalizeProbs({
    home: market.home + 0.015,
    draw: hasDraw ? market.draw - 0.005 : 0,
    away: market.away + 0.01,
  });
}

function getRiskLevel(edge, odds) {
  if (odds >= 8) {
    return {
      level: "Korkea",
      message: "Korkea kerroin. Käytä vain pientä panosta.",
    };
  }

  if (edge >= 0.07) {
    return {
      level: "Hyvä",
      message: "Selkeä positiivinen edge, mutta tarkista data ennen vetoa.",
    };
  }

  if (edge >= 0.04) {
    return {
      level: "Keskitaso",
      message: "Mahdollinen value, panos maltillinen.",
    };
  }

  return {
    level: "Matala signaali",
    message: "Edge on pieni. Tämä on seurattava kohde, ei vahva veto.",
  };
}

function getBeginnerAction(row) {
  if (!row.shouldBet) return "Älä lyö tätä.";
  if (row.risk.level === "Korkea") return "Vain pieni testipanos.";
  if (row.edge >= 0.07) return "Mahdollinen päivän pääkohde.";
  return "Pieni tai maltillinen panos.";
}

export function analyzeRows(match, market = "h2h", bankroll = 1000) {
  if (!match || !isBettableMatch(match)) return [];

  const model = modelProbabilities(match);
  const books = match.bestOdds?.books || {};

  let rows = [];

  if (market === "totals") {
    rows = [
      {
        key: "over",
        market: "Over / Under",
        label: `Over ${match.bestOdds?.point ?? "-"}`,
        odds: match.bestOdds?.over,
        bookmaker: books.over,
        modelProb: 0.52,
      },
      {
        key: "under",
        market: "Over / Under",
        label: `Under ${match.bestOdds?.point ?? "-"}`,
        odds: match.bestOdds?.under,
        bookmaker: books.under,
        modelProb: 0.48,
      },
    ];
  } else if (market === "spreads") {
    rows = [
      {
        key: "spread-home",
        market: "Handicap",
        label: `${match.home_team} ${match.bestOdds?.spreadPointHome ?? ""}`,
        odds: match.bestOdds?.spreadHome,
        bookmaker: books.spreadHome,
        modelProb: 0.52,
      },
      {
        key: "spread-away",
        market: "Handicap",
        label: `${match.away_team} ${match.bestOdds?.spreadPointAway ?? ""}`,
        odds: match.bestOdds?.spreadAway,
        bookmaker: books.spreadAway,
        modelProb: 0.48,
      },
    ];
  } else {
    rows = [
      {
        key: "home",
        market: "1X2 / ML",
        label: match.home_team,
        odds: match.bestOdds?.home,
        bookmaker: books.home,
        modelProb: model.home,
      },
      {
        key: "draw",
        market: "1X2 / ML",
        label: "Tasapeli",
        odds: match.bestOdds?.draw,
        bookmaker: books.draw,
        modelProb: model.draw,
      },
      {
        key: "away",
        market: "1X2 / ML",
        label: match.away_team,
        odds: match.bestOdds?.away,
        bookmaker: books.away,
        modelProb: model.away,
      },
    ];
  }

  return rows
    .filter((row) => isReasonableOdds(row.odds))
    .map((row) => {
      const marketProb = impliedProb(row.odds);
      const ev = expectedValue(row.odds, row.modelProb);
      const edge = marketProb != null ? row.modelProb - marketProb : null;
      const stake = kellyStake(row.modelProb, row.odds, bankroll, 0.25);
      const shouldBet = edge > MIN_EDGE && ev > 0 && stake > 0;
      const risk = getRiskLevel(edge, row.odds);

      const analyzed = {
        ...row,
        bookmaker: row.bookmaker || "Unknown",
        marketProb,
        edge,
        ev,
        stake,
        shouldBet,
        risk,
        strength:
          edge >= 0.07
            ? "Vahva"
            : edge >= 0.04
            ? "Hyvä"
            : edge >= MIN_EDGE
            ? "Pieni"
            : "Ei valuea",
      };

      return {
        ...analyzed,
        beginnerAction: getBeginnerAction(analyzed),
      };
    });
}

export function getBestBets(matches = [], bankroll = 1000) {
  const markets = ["h2h", "totals", "spreads"];

  return matches
    .filter(isBettableMatch)
    .flatMap((match) =>
      markets.flatMap((market) =>
        analyzeRows(match, market, bankroll).map((pick) => ({
          ...pick,
          match,
          id: `${match.id}-${market}-${pick.key}`,
        }))
      )
    )
    .filter((pick) => pick.shouldBet)
    .sort((a, b) => bScore(b) - bScore(a))
    .slice(0, 3);
}

function bScore(pick) {
  const edgeScore = pick.edge * 100;
  const evScore = pick.ev * 10;
  const oddsPenalty = pick.odds > 8 ? 5 : 0;

  return edgeScore + evScore - oddsPenalty;
}
