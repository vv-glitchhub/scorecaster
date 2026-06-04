const SOURCE_SCORES = {
  official_team: 1.0,
  official_league: 0.95,
  major_media: 0.85,
  local_media: 0.7,
  betting_media: 0.65,
  social_media: 0.3,
  unknown: 0.2
};

export function getSourceTrust(type) {
  return SOURCE_SCORES[type] ?? 0.2;
}
