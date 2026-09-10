import { SPORTS } from "./sports.js";

const LEAGUES = new Set(SPORTS.flatMap(group => group.leagues.map(league => league.key)));
const oneOf = (value, values, fallback) => values.includes(value) ? value : fallback;

export function readEventFilters(params) {
  const view = oneOf(params.get("view"), ["directory", "analysis"], "directory");
  return {
    view, league: LEAGUES.has(params.get("league")) ? params.get("league") : "",
    query: String(params.get("q") || "").slice(0, 120),
    time: oneOf(params.get("time"), ["today", "tomorrow", "next24"], "all"),
    decision: view === "analysis" ? oneOf(params.get("decision"), ["PLAY", "CAUTION", "SKIP"], "all") : "all",
    sort: view === "analysis" ? oneOf(params.get("sort"), ["decision", "edge", "trust", "confidence"], "kickoff") : "kickoff"
  };
}

export function eventFiltersHref(filters) {
  const params = new URLSearchParams();
  if (filters.view === "analysis") params.set("view", "analysis");
  if (filters.league) params.set("league", filters.league);
  if (filters.query) params.set("q", filters.query);
  if (filters.time !== "all") params.set("time", filters.time);
  if (filters.view === "analysis" && filters.decision !== "all") params.set("decision", filters.decision);
  if (filters.view === "analysis" && filters.sort !== "kickoff") params.set("sort", filters.sort);
  return "/events" + (params.size ? "?" + params : "");
}
