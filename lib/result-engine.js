export function normalizeTeamName(value = "") {
  return String(value).toLowerCase().trim();
}

export function findResultForBet(bet, results = []) {
  if (!bet?.match) return null;

  const home = normalizeTeamName(bet.match.home_team);
  const away = normalizeTeamName(bet.match.away_team);

  return (
    results.find((r) => {
      return (
        normalizeTeamName(r.home_team) === home &&
        normalizeTeamName(r.away_team) === away
      );
    }) || null
  );
}

export function getWinnerFromResult(result) {
  if (!result) return null;

  const homeScore = Number(result.home_score);
  const awayScore = Number(result.away_score);

  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}
