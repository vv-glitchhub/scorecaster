import { isBettableMatch } from "@/lib/data-status";
import { bookmakerMatches } from "@/lib/bookmaker-options";
import { getModelProbabilitiesV2, getModelSummary } from "@/lib/model-engine-v2";

const MIN_ODDS = 1.2;
const MAX_ODDS = 50;
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

function getBestBookPrice(match, key, selectedBookmakers = null) {
  const prices = match?.bestOdds?.bookPrices?.[key] || [];

  if (!selectedBookmakers || selectedBookmakers.length === 0) {
    return {
      odds: match?.bestOdds?.[key],
      bookmaker: match?.bestOdds?.books?.[key] || "Unknown",
    };
  }

  const filtered = prices.filter((item) =>
    bookmakerMatches(item.bookmaker, selectedBookmakers)
  );

  if (!filtered.length) return { odds: null, bookmaker: null };

  const best = [...filtered].sort((a, b) => Number(b.odds) - Number(a.odds))[0];

  return {
    odds: best.odds,
    bookmaker: best.bookmaker,
  };
}

function getRiskLevel(edge, odds) {
  if (odds >= 10) {
    return {
      level: "Korkea",
      message: "Korkea kerroin. Varianssi on iso, käytä vain pientä panosta.",
    };
  }

  if (edge >= 0.07) {
    return {
      level: "Hyvä",
      message: "Selkeä positiivinen edge.",
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
    message: "Edge on pieni.",
  };
}

function getBeginnerAction(row) {
  if (!row.shouldBet) return "Älä lyö tätä.";
  if (row.risk.level === "Korkea") return "Vain pieni testipanos.";
  if (row.edge >= 0.07) return "Mahdollinen päivän pääkohde.";
  return "Pieni tai maltillinen panos.";
}

function totalsModel(match, side) {
  const summary = getModelSummary(match);
  const attackSignal = summary.attackDefenseDiff / 100;

  if (side === "over") {
    return Math.max(0.42, Math.min(0.62, 0.51 + attackSignal * 0.015));
  }

  return Math.max(0.38, Math.min(0.58, 0.49 - attackSignal * 0.015));
}

function spreadModel(match, side) {
  const summary = getModelSummary(match);
  const ratingSignal = summary.ratingDiff / 400;

  if (side === "home") {
    return Math.max(0.42, Math.min(0.63, 0.51 + ratingSignal * 0.08));
  }

  return Math.max(0.37, Math.min(0.58, 0.49 - ratingSignal * 0.08));
}

function analyzeOutrights(match, bankroll = 1000, selectedBookmakers = null) {
  const all = match?.outrights || [];

  const filtered = selectedBookmakers?.length
    ? all.filter((item) => bookmakerMatches(item.bookmaker, selectedBookmakers))
    : all;

  return filtered
    .filter((item) => isReasonableOdds(item.odds))
    .slice(0, 10)
    .map((item) => {
      const marketProb = impliedProb(item.odds);
      const modelProb = marketProb ? Math.min(0.75, marketProb * 1.08) : 0;
      const ev = expectedValue(item.odds, modelProb);
      const edge = marketProb != null ? modelProb - marketProb : null;
      const stake = kellyStake(modelProb, item.odds, bankroll, 0.15);
      const shouldBet = edge > MIN_EDGE && ev > 0 && stake > 0;
      const risk = getRiskLevel(edge, item.odds);

      const analyzed = {
        key: `outright-${item.label}`,
        market: "Outright / Winner",
        label: item.label,
        odds: item.odds,
        bookmaker: item.bookmaker,
        modelProb,
        marketProb,
        edge,
        ev,
        stake,
        shouldBet,
        risk,
        modelVersion: "outright-v1",
        strength: shouldBet ? "Outright value" : "Ei valuea",
      };

      return {
        ...analyzed,
        beginnerAction: getBeginnerAction(analyzed),
      };
    });
}

export function analyzeRows(
  match,
  market = "h2h",
  bankroll = 1000,
  selectedBookmakers = null
) {
  if (!match || !isBettableMatch(match)) return [];

  if (match.event_type === "outright") {
    return analyzeOutrights(match, bankroll, selectedBookmakers);
  }

  const model = getModelProbabilitiesV2(match);
  const modelSummary = getModelSummary(match);

  let rows = [];

  if (market === "totals") {
    const over = getBestBookPrice(match, "over", selectedBookmakers);
    const under = getBestBookPrice(match, "under", selectedBookmakers);

    rows = [
      {
        key: "over",
        market: "Over / Under",
        label: `Over ${match.bestOdds?.point ?? "-"}`,
        odds: over.odds,
        bookmaker: over.bookmaker,
        modelProb: totalsModel(match, "over"),
      },
      {
        key: "under",
        market: "Over / Under",
        label: `Under ${match.bestOdds?.point ?? "-"}`,
        odds: under.odds,
        bookmaker: under.bookmaker,
        modelProb: totalsModel(match, "under"),
      },
    ];
  } else if (market === "spreads") {
    const spreadHome = getBestBookPrice(match, "spreadHome", selectedBookmakers);
    const spreadAway = getBestBookPrice(match, "spreadAway", selectedBookmakers);

    rows = [
      {
        key: "spread-home",
        market: "Handicap",
        label: `${match.home_team} ${match.bestOdds?.spreadPointHome ?? ""}`,
        odds: spreadHome.odds,
        bookmaker: spreadHome.bookmaker,
        modelProb: spreadModel(match, "home"),
      },
      {
        key: "spread-away",
        market: "Handicap",
        label: `${match.away_team} ${match.bestOdds?.spreadPointAway ?? ""}`,
        odds: spreadAway.odds,
        bookmaker: spreadAway.bookmaker,
        modelProb: spreadModel(match, "away"),
      },
    ];
  } else {
    const home = getBestBookPrice(match, "home", selectedBookmakers);
    const draw = getBestBookPrice(match, "draw", selectedBookmakers);
    const away = getBestBookPrice(match, "away", selectedBookmakers);

    rows = [
      {
        key: "home",
        market: "1X2 / ML",
        label: match.home_team,
        odds: home.odds,
        bookmaker: home.bookmaker,
        modelProb: model.home,
      },
      {
        key: "draw",
        market: "1X2 / ML",
        label: "Tasapeli",
        odds: draw.odds,
        bookmaker: draw.bookmaker,
        modelProb: model.draw,
      },
      {
        key: "away",
        market: "1X2 / ML",
        label: match.away_team,
        odds: away.odds,
        bookmaker: away.bookmaker,
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
        modelVersion: "v2",
        modelSummary,
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

export function getBestBets(
  matches = [],
  bankroll = 1000,
  selectedBookmakers = null
) {
  const markets = ["h2h", "totals", "spreads"];

  return matches
    .filter(isBettableMatch)
    .flatMap((match) => {
      if (match.event_type === "outright") {
        return analyzeRows(match, "outright", bankroll, selectedBookmakers).map((pick) => ({
          ...pick,
          match,
          id: `${match.id}-outright-${pick.label}-${pick.bookmaker}`,
        }));
      }

      return markets.flatMap((market) =>
        analyzeRows(match, market, bankroll, selectedBookmakers).map((pick) => ({
          ...pick,
          match,
          id: `${match.id}-${market}-${pick.key}-${pick.bookmaker}`,
        }))
      );
    })
    .filter((pick) => pick.shouldBet)
    .sort((a, b) => bScore(b) - bScore(a))
    .slice(0, 3);
}

function bScore(pick) {
  const edgeScore = pick.edge * 100;
  const evScore = pick.ev * 10;
  const oddsPenalty = pick.odds > 10 ? 8 : 0;
  const modelBonus = pick.modelVersion === "v2" ? 1.5 : 0;

  return edgeScore + evScore + modelBonus - oddsPenalty;
}
