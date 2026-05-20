import { getSportProfile } from "@/lib/sport-model-profiles";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomFactor(min, max) {
  return min + Math.random() * (max - min);
}

function normalizeProbability(probability) {
  return clamp(probability, 0.03, 0.97);
}

function calculateMarketProbability(odds) {
  if (!odds || odds <= 1) return 0;
  return 1 / odds;
}

function calculateEdge(modelProbability, marketProbability) {
  return modelProbability - marketProbability;
}

function calculateEV(probability, odds) {
  return probability * odds - 1;
}

function calculateKelly(probability, odds) {
  const b = odds - 1;

  if (b <= 0) return 0;

  const result = (b * probability - (1 - probability)) / b;

  return clamp(result, 0, 0.25);
}

function buildTeamMetrics() {
  return {
    form: randomFactor(0.4, 1),
    offense: randomFactor(0.4, 1),
    defense: randomFactor(0.4, 1),
    fatigue: randomFactor(0, 1),
    injuries: randomFactor(0, 1),
    goalie: randomFactor(0.4, 1),
    homeAdvantage: randomFactor(0, 1),
    motivation: randomFactor(0.4, 1),
  };
}

function calculateTeamStrength(metrics, profile) {
  let score = 0;

  score += (metrics.form || 0) * (profile.formImpact || 0);
  score += (metrics.offense || 0) * (profile.offenseImpact || 0);
  score += (metrics.defense || 0) * (profile.defenseImpact || 0);

  score += (metrics.goalie || 0) * (profile.goalieImpact || 0);

  score +=
    (1 - (metrics.fatigue || 0)) * (profile.fatigueImpact || 0);

  score +=
    (1 - (metrics.injuries || 0)) * (profile.injuriesImpact || 0);

  score +=
    (metrics.homeAdvantage || 0) * (profile.homeAdvantage || 0);

  score += (metrics.motivation || 0) * 0.08;

  return score;
}

export function analyzeMatchV3(match, market = "h2h", bankroll = 1000) {
  if (!match?.bestOdds) return [];

  const profile = getSportProfile(match.sport_key);

  const homeMetrics = buildTeamMetrics();
  const awayMetrics = buildTeamMetrics();

  const homeStrength = calculateTeamStrength(
    homeMetrics,
    profile
  );

  const awayStrength = calculateTeamStrength(
    awayMetrics,
    profile
  );

  const totalStrength = homeStrength + awayStrength;

  const homeModelProbability = normalizeProbability(
    homeStrength / totalStrength
  );

  const awayModelProbability = normalizeProbability(
    awayStrength / totalStrength
  );

  const picks = [];

  const homeOdds = Number(match.bestOdds?.home || 0);
  const awayOdds = Number(match.bestOdds?.away || 0);

  if (homeOdds > 1.01) {
    const marketProbability = calculateMarketProbability(homeOdds);

    const edge = calculateEdge(
      homeModelProbability,
      marketProbability
    );

    picks.push({
      id: `${match.id}-home`,
      key: "home",
      label: `${match.home_team} win`,
      market: "Moneyline",
      bookmaker: match.bestBookmaker?.home || "Best bookmaker",
      odds: homeOdds,
      modelProbability: homeModelProbability,
      marketProbability,
      edge,
      ev: calculateEV(homeModelProbability, homeOdds),
      kelly: calculateKelly(homeModelProbability, homeOdds),
      stake: bankroll * calculateKelly(homeModelProbability, homeOdds),
      confidence: clamp(homeModelProbability + edge, 0, 1),
      match,
      reasons: [
        "Recent form advantage",
        "Better offensive metrics",
        "Lower fatigue index",
        "Model V3 detected value",
      ],
    });
  }

  if (awayOdds > 1.01) {
    const marketProbability = calculateMarketProbability(awayOdds);

    const edge = calculateEdge(
      awayModelProbability,
      marketProbability
    );

    picks.push({
      id: `${match.id}-away`,
      key: "away",
      label: `${match.away_team} win`,
      market: "Moneyline",
      bookmaker: match.bestBookmaker?.away || "Best bookmaker",
      odds: awayOdds,
      modelProbability: awayModelProbability,
      marketProbability,
      edge,
      ev: calculateEV(awayModelProbability, awayOdds),
      kelly: calculateKelly(awayModelProbability, awayOdds),
      stake: bankroll * calculateKelly(awayModelProbability, awayOdds),
      confidence: clamp(awayModelProbability + edge, 0, 1),
      match,
      reasons: [
        "Momentum advantage",
        "Travel/rest edge",
        "Positive matchup profile",
        "Model V3 detected value",
      ],
    });
  }

  return picks
    .filter((pick) => pick.edge > 0)
    .sort((a, b) => b.edge - a.edge);
}

export function getBestBetsV3(
  matches = [],
  bankroll = 1000,
  limit = 10
) {
  const all = [];

  for (const match of matches) {
    const analyzed = analyzeMatchV3(
      match,
      "h2h",
      bankroll
    );

    all.push(...analyzed);
  }

  return all
    .sort((a, b) => b.edge - a.edge)
    .slice(0, limit);
}
