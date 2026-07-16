function normalizeName(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function numericScore(event, teamName) {
  const target = normalizeName(teamName);
  const score = Array.isArray(event?.scores)
    ? event.scores.find((item) => normalizeName(item?.name) === target)?.score
    : null;
  const number = Number(score);
  return Number.isFinite(number) ? number : null;
}

function explicitEventId(bet = {}) {
  const direct = String(bet?.raw_pick?.eventId || bet?.event_id || "").trim();
  if (direct) return direct;

  const clientRef = String(bet?.client_ref || "");
  const match = clientRef.match(/^([a-f0-9]{32})(?:-|$)/i);
  return match?.[1] || "";
}

function parseMatchTeams(match = "") {
  const parts = String(match).split(/\s+(?:vs\.?|v|–|—|-)\s+/i);
  if (parts.length !== 2) return { home: "", away: "" };
  return { home: parts[0].trim(), away: parts[1].trim() };
}

function betTeams(bet = {}) {
  const parsed = parseMatchTeams(bet.match);
  return {
    home: bet.home_team || bet.homeTeam || parsed.home,
    away: bet.away_team || bet.awayTeam || parsed.away
  };
}

export function findScoreEventForBet(bet, events = []) {
  const eventId = explicitEventId(bet);
  if (eventId) {
    const exact = events.find((event) => String(event?.id || "") === eventId);
    if (exact) return exact;
  }

  const teams = betTeams(bet);
  if (!teams.home || !teams.away) return null;
  const home = normalizeName(teams.home);
  const away = normalizeName(teams.away);

  return events.find((event) =>
    normalizeName(event?.home_team) === home &&
    normalizeName(event?.away_team) === away
  ) || null;
}

export function settlePaperBetFromScore(bet, event) {
  if (!bet || !event?.completed || !Array.isArray(event.scores)) return null;

  const homeScore = numericScore(event, event.home_team);
  const awayScore = numericScore(event, event.away_team);
  if (homeScore === null || awayScore === null) return null;

  const selection = normalizeName(bet.label || bet.selection);
  const home = normalizeName(event.home_team);
  const away = normalizeName(event.away_team);
  const drawSelections = new Set(["draw", "tie", "tasapeli", "x"]);

  let selectedResult = null;
  if (drawSelections.has(selection)) {
    selectedResult = homeScore === awayScore ? "won" : "lost";
  } else if (selection === home) {
    selectedResult = homeScore > awayScore ? "won" : "lost";
  } else if (selection === away) {
    selectedResult = awayScore > homeScore ? "won" : "lost";
  }

  if (!selectedResult) return null;

  const odds = Number(bet.odds);
  const stake = Number(bet.stake);
  if (!Number.isFinite(odds) || odds <= 1 || !Number.isFinite(stake) || stake < 0) return null;

  const profit = selectedResult === "won"
    ? stake * (odds - 1)
    : -stake;
  const scoreText = `${event.home_team} ${homeScore}-${awayScore} ${event.away_team}`.slice(0, 80);

  return {
    status: selectedResult,
    result: scoreText,
    profit: Number(profit.toFixed(4)),
    eventId: String(event.id || ""),
    finalScore: {
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      homeScore,
      awayScore
    },
    completedAt: event.last_update || null,
    settlementSource: "odds-api-scores"
  };
}
