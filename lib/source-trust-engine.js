const SOURCE_SCORES = {
  official_team: 1.0,
  official_league: 0.95,
  official_tournament: 0.95,
  official_data_provider: 0.9,

  official_nhl: 1.0,
  official_nba: 1.0,
  official_fifa: 0.95,
  official_uefa: 0.95,

  espn: 0.9,
  athletic: 0.9,
  rotowire: 0.85,
  actionnetwork: 0.85,

  major_media: 0.85,
  verified_journalist: 0.8,
  local_media: 0.7,
  betting_media: 0.65,
  odds_market: 0.75,
  polymarket: 0.7,
  newsapi: 0.78,

  twitter_verified: 0.65,
  social_media: 0.3,
  reddit: 0.3,
  fan_forum: 0.2,
  unknown: 0.45
};

export function getSourceTrust(type = "unknown") {
  return SOURCE_SCORES[type] ?? SOURCE_SCORES.unknown;
}

export function calculateAverageSourceTrust(sources = []) {
  const cleanSources = Array.isArray(sources) ? sources.filter(Boolean) : [];

  if (cleanSources.length === 0) {
    return SOURCE_SCORES.unknown;
  }

  const total = cleanSources.reduce((sum, source) => {
    return sum + getSourceTrust(source.type);
  }, 0);

  return total / cleanSources.length;
}

export function labelSourceTrust(score = SOURCE_SCORES.unknown) {
  if (score >= 0.85) return "Very High";
  if (score >= 0.7) return "High";
  if (score >= 0.5) return "Medium";
  if (score >= 0.3) return "Low";
  return "Very Low";
}

export function calculateSourceTrust(sources = []) {
  const score = calculateAverageSourceTrust(sources);

  return {
    score,
    label: labelSourceTrust(score)
  };
}
