export const GAME_CENTER_VERSION = "scorecaster-game-center-v1";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function gameCenterEventId(pick = {}) {
  return clean(pick.gameId || pick.eventId || pick.id);
}

export function normalizeGameCenterDecision(value) {
  const decision = clean(value).toUpperCase();
  if (decision === "BET") return "PLAY";
  if (decision === "PASS") return "SKIP";
  return ["PLAY", "CAUTION", "SKIP"].includes(decision) ? decision : "CAUTION";
}

export function buildGameCenterEvents(picks = []) {
  const events = new Map();

  for (const pick of Array.isArray(picks) ? picks : []) {
    const id = gameCenterEventId(pick);
    if (!id) continue;

    if (!events.has(id)) {
      events.set(id, {
        id,
        match: clean(pick.match || [pick.homeTeam, pick.awayTeam].filter(Boolean).join(" – ")),
        homeTeam: clean(pick.homeTeam),
        awayTeam: clean(pick.awayTeam),
        commenceTime: clean(pick.commenceTime || pick.commence_time) || null,
        league: clean(pick.leagueTitle || pick.league),
        sportKey: clean(pick.sportKey || pick.league),
        selections: []
      });
    }

    events.get(id).selections.push(pick);
  }

  return [...events.values()]
    .map((event) => ({
      ...event,
      // The API already ranks picks. Preserve that authority instead of silently
      // replacing it with a client-side edge-only ranking.
      primarySelection: event.selections[0] || null,
      decision: normalizeGameCenterDecision(event.selections[0]?.productDecision || event.selections[0]?.decision)
    }))
    .sort((left, right) => {
      const leftTime = timestamp(left.commenceTime);
      const rightTime = timestamp(right.commenceTime);
      if (leftTime === null && rightTime === null) return 0;
      if (leftTime === null) return 1;
      if (rightTime === null) return -1;
      return leftTime - rightTime;
    });
}

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function matchesTimeFilter(event, filter, now) {
  if (filter === "all") return true;
  const eventTime = timestamp(event.commenceTime);
  if (eventTime === null) return false;

  const current = new Date(now);
  const eventDate = new Date(eventTime);
  if (filter === "today") return localDateKey(eventDate) === localDateKey(current);
  if (filter === "tomorrow") {
    const tomorrow = new Date(current);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return localDateKey(eventDate) === localDateKey(tomorrow);
  }
  if (filter === "next24") return eventTime >= current.getTime() && eventTime <= current.getTime() + 24 * 60 * 60 * 1000;
  return true;
}

function searchableText(event) {
  return [
    event.match,
    event.homeTeam,
    event.awayTeam,
    event.league,
    event.sportKey,
    ...(event.selections || []).flatMap((selection) => [selection.selection, selection.label, selection.bookmaker])
  ].map(clean).join(" ").toLocaleLowerCase();
}

function sortableMetric(event, key) {
  const pick = event.primarySelection || {};
  if (key === "edge") return finite(pick.edge);
  if (key === "trust") return finite(pick.trustScore ?? pick.qualityScore);
  if (key === "confidence") return finite(pick.confidence);
  return null;
}

export function filterGameCenterEvents(events = [], options = {}) {
  const query = clean(options.query).toLocaleLowerCase();
  const decisionFilter = clean(options.decision || "all").toUpperCase();
  const timeFilter = clean(options.time || "all").toLowerCase();
  const sort = clean(options.sort || "kickoff").toLowerCase();
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());

  const filtered = (Array.isArray(events) ? events : []).filter((event) => {
    if (query && !searchableText(event).includes(query)) return false;
    if (decisionFilter !== "ALL" && normalizeGameCenterDecision(event.decision) !== decisionFilter) return false;
    return matchesTimeFilter(event, timeFilter, now);
  });

  return filtered.slice().sort((left, right) => {
    if (["edge", "trust", "confidence"].includes(sort)) {
      const leftValue = sortableMetric(left, sort);
      const rightValue = sortableMetric(right, sort);
      if (leftValue === null && rightValue === null) return 0;
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      return rightValue - leftValue;
    }

    if (sort === "decision") {
      const weight = { PLAY: 3, CAUTION: 2, SKIP: 1 };
      return (weight[normalizeGameCenterDecision(right.decision)] || 0) - (weight[normalizeGameCenterDecision(left.decision)] || 0);
    }

    const leftTime = timestamp(left.commenceTime);
    const rightTime = timestamp(right.commenceTime);
    if (leftTime === null && rightTime === null) return 0;
    if (leftTime === null) return 1;
    if (rightTime === null) return -1;
    return leftTime - rightTime;
  });
}

export function summarizeGameCenter(events = []) {
  return (Array.isArray(events) ? events : []).reduce((summary, event) => {
    summary.events += 1;
    const decision = normalizeGameCenterDecision(event.decision);
    summary[decision.toLowerCase()] += 1;
    return summary;
  }, { events: 0, play: 0, caution: 0, skip: 0 });
}
