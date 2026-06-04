const SOURCE_SCORES = {
  official_team: 1.0,
  official_league: 0.95,
  official_tournament: 0.95,
  major_media: 0.85,
  verified_journalist: 0.8,
  local_media: 0.7,
  betting_media: 0.65,
  odds_market: 0.75,
  polymarket: 0.7,
  social_media: 0.3,
  fan_forum: 0.2,
  unknown: 0.2
};

export function getSourceTrust(type = "unknown") {
  return SOURCE_SCORES[type] ?? SOURCE_SCORES.unknown;
}

export function calculateAverageSourceTrust(sources = []) {
  if (!sources.length) return SOURCE_SCORES.unknown;

  const total = sources.reduce(
    (sum, source) => sum + getSourceTrust(source.type),
    0
  );

  return total / sources.length;
}

export function labelSourceTrust(score = 0.2) {
  if (score >= 0.85) return "Very High";
  if (score >= 0.7) return "High";
  if (score >= 0.5) return "Medium";
  if (score >= 0.3) return "Low";
  return "Very Low";
}
