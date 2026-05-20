export function normalizeName(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesMatch(a, b) {
  const x = normalizeName(a);
  const y = normalizeName(b);

  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;

  return false;
}

export function normalizeSportsDbEvent(event = {}) {
  const homeScore =
    event.intHomeScore !== null && event.intHomeScore !== undefined
      ? Number(event.intHomeScore)
      : null;

  const awayScore =
    event.intAwayScore !== null && event.intAwayScore !== undefined
      ? Number(event.intAwayScore)
      : null;

  return {
    id: event.idEvent || event.id,
    source: "thesportsdb",
    sport: event.strSport || "",
    league: event.strLeague || "",
    date: event.dateEvent || "",
    time: event.strTime || "",
    status: event.strStatus || "",
    home_team: event.strHomeTeam || "",
    away_team: event.strAwayTeam || "",
    home_score: Number.isFinite(homeScore) ? homeScore : null,
    away_score: Number.isFinite(awayScore) ? awayScore : null,
    is_finished: Number.isFinite(homeScore) && Number.isFinite(awayScore),
    raw: event,
  };
}

export function normalizeSportsDbEvents(events = []) {
  return events.map(normalizeSportsDbEvent).filter((event) => {
    return event.home_team && event.away_team && event.is_finished;
  });
}
