import { getMatchRatingContext } from "@/lib/team-ratings";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function impliedProb(odds) {
  const n = Number(odds);
  if (!Number.isFinite(n) || n <= 1) return null;
  return 1 / n;
}

function normalize({ home, draw = 0, away }) {
  const h = Math.max(0, Number(home) || 0);
  const d = Math.max(0, Number(draw) || 0);
  const a = Math.max(0, Number(away) || 0);
  const total = h + d + a;

  if (!total) {
    return {
      home: 0.45,
      draw: 0.22,
      away: 0.33,
    };
  }

  return {
    home: h / total,
    draw: d / total,
    away: a / total,
  };
}

function marketBaseline(match) {
  return normalize({
    home: impliedProb(match?.bestOdds?.home) || 0.45,
    draw: impliedProb(match?.bestOdds?.draw) || 0,
    away: impliedProb(match?.bestOdds?.away) || 0.33,
  });
}

function logisticFromRating(diff) {
  return 1 / (1 + Math.pow(10, -diff / 400));
}

export function getModelProbabilitiesV2(match) {
  const market = marketBaseline(match);
  const context = getMatchRatingContext(match);

  const ratingHome = logisticFromRating(context.ratingDiff);
  const ratingAway = 1 - ratingHome;

  const formBoost = clamp(context.formDiff * 0.18, -0.035, 0.035);
  const attackBoost = clamp(context.attackDefenseDiff / 1000, -0.035, 0.035);

  const homeSignal = ratingHome + formBoost + attackBoost;
  const awaySignal = ratingAway - formBoost - attackBoost;

  const hasDraw = Boolean(match?.bestOdds?.draw);

  const blendMarket = 0.62;
  const blendModel = 0.38;

  let draw = hasDraw ? market.draw : 0;

  if (hasDraw) {
    const mismatch = Math.abs(homeSignal - awaySignal);
    draw = clamp(market.draw + (0.5 - mismatch) * 0.035, 0.12, 0.34);
  }

  const raw = normalize({
    home: market.home * blendMarket + homeSignal * blendModel,
    draw,
    away: market.away * blendMarket + awaySignal * blendModel,
  });

  return {
    home: clamp(raw.home, 0.03, 0.92),
    draw: hasDraw ? clamp(raw.draw, 0.03, 0.45) : 0,
    away: clamp(raw.away, 0.03, 0.92),
    context,
  };
}

export function getModelSummary(match) {
  const result = getModelProbabilitiesV2(match);
  const context = result.context;

  return {
    ratingDiff: context.ratingDiff,
    formDiff: context.formDiff,
    attackDefenseDiff: context.attackDefenseDiff,
    homeRating: context.home.rating,
    awayRating: context.away.rating,
    homeForm: context.home.form,
    awayForm: context.away.form,
  };
}
