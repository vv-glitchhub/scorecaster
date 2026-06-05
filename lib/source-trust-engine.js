const TRUST_SCORES = {
  official_team: 1.0,
  official_league: 1.0,
  official_nhl: 1.0,
  official_nba: 1.0,
  espn: 0.9,
  athletic: 0.9,
  rotowire: 0.85,
  actionnetwork: 0.85,
  bettingnews: 0.8,
  twitter_verified: 0.75,
  reddit: 0.4,
  unknown: 0.3
};

export function calculateSourceTrust(sources = []) {
  if (!sources.length) {
    return {
      score: 0.3,
      label: "Low"
    };
  }

  const total =
    sources.reduce((sum, source) => {
      return (
        sum +
        (TRUST_SCORES[source.type] ??
          TRUST_SCORES.unknown)
      );
    }, 0) / sources.length;

  let label = "Low";

  if (total >= 0.8) label = "High";
  else if (total >= 0.6) label = "Medium";

  return {
    score: total,
    label
  };
}
