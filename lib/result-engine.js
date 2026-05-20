import { namesMatch } from "@/lib/results-normalizer";

export function normalizeTeamName(value = "") {
  return String(value).toLowerCase().trim();
}

export function findResultForBet(bet, results = []) {
  if (!bet?.match) return null;

  const home = bet.match.home_team;
  const away = bet.match.away_team;

  if (bet.match.event_type === "outright") return null;

  return (
    results.find((result) => {
      return (
        namesMatch(result.home_team, home) &&
        namesMatch(result.away_team, away)
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
