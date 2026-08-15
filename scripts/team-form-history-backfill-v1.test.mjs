import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchSportsDbTeamHistory,
  mergeTeamHistoryResults,
  resetSportsDbTeamHistoryForTests,
  SPORTSDATA_TEAM_HISTORY_POLICY,
  teamCompletedSampleCount
} from "../lib/thesportsdb-team-history-v1.mjs";
import {
  fetchRecentLeagueResults,
  resetResultsProviderCacheForTests,
  RESULTS_PROVIDER_POLICY
} from "../lib/results-provider.js";

const NOW = Date.parse("2026-08-15T01:00:00Z");
const KICKOFF = "2026-08-16T18:00:00Z";

function rawEvent(id, date, home, away, homeScore, awayScore, homeId, awayId, league = "Major League Soccer") {
  return {
    idEvent: id,
    strSport: "Soccer",
    idLeague: "4346",
    strLeague: league,
    dateEvent: date,
    strTime: "18:00:00",
    strTimestamp: `${date}T18:00:00`,
    strHomeTeam: home,
    strAwayTeam: away,
    intHomeScore: String(homeScore),
    intAwayScore: String(awayScore),
    idHomeTeam: String(homeId),
    idAwayTeam: String(awayId),
    strStatus: "Match Finished"
  };
}

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(data);
    }
  };
}

const baseLeagueEvents = [
  rawEvent("base-1", "2026-08-10", "Home FC", "Base Alpha", 2, 0, 100, 901),
  rawEvent("base-2", "2026-08-09", "Base Beta", "Away FC", 1, 1, 902, 200)
];

const homePrevious = [
  rawEvent("home-1", "2026-08-13", "Cup Alpha", "Home FC", 0, 1, 910, 100, "US Open Cup"),
  rawEvent("home-2", "2026-08-07", "Home FC", "League Gamma", 3, 1, 100, 911),
  rawEvent("home-3", "2026-08-03", "Home FC", "League Delta", 2, 2, 100, 912)
];

const awayPrevious = [
  rawEvent("away-1", "2026-08-12", "Away FC", "Cup Echo", 2, 1, 200, 920, "US Open Cup"),
  rawEvent("away-2", "2026-08-06", "League Foxtrot", "Away FC", 1, 0, 921, 200),
  rawEvent("away-3", "2026-08-02", "Away FC", "League Golf", 4, 2, 200, 922)
];

test("team history reuses Team ID from league results and calls only previous-team endpoint", async () => {
  resetSportsDbTeamHistoryForTests();
  const calls = [];
  const existingResults = [{
    id: "base-1",
    date: "2026-08-10",
    time: "18:00:00",
    home_team: "Home FC",
    away_team: "Base Alpha",
    home_score: 2,
    away_score: 0,
    is_finished: true,
    raw: baseLeagueEvents[0]
  }];

  const result = await fetchSportsDbTeamHistory({
    team: "Home FC",
    existingResults,
    now: NOW,
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      assert.equal(options.headers["X-API-KEY"], "test-key");
      return response({ schedule: homePrevious });
    }
  });
  resetSportsDbTeamHistoryForTests();

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /schedule\/previous\/team\/100$/);
  assert.doesNotMatch(calls[0].url, /search\/team/);
  assert.equal(result.mode, "live");
  assert.equal(result.teamId, "100");
  assert.equal(result.teamIdSource, "league-history");
  assert.equal(result.resultCount, 3);
  assert.equal(result.results.some((event) => event.league === "US Open Cup"), true);
});

test("team history resolves missing Team ID via v2 search and keeps API key out of URL", async () => {
  resetSportsDbTeamHistoryForTests();
  const calls = [];
  const result = await fetchSportsDbTeamHistory({
    team: "Home FC",
    existingResults: [],
    now: NOW,
    apiKey: "secret-test-key",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      assert.equal(url.includes("secret-test-key"), false);
      assert.equal(options.headers["X-API-KEY"], "secret-test-key");
      if (url.includes("/search/team/")) {
        return response({ teams: [{ idTeam: "100", strTeam: "Home FC" }] });
      }
      return response({ schedule: homePrevious });
    }
  });
  resetSportsDbTeamHistoryForTests();

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /search\/team\/home_fc$/);
  assert.match(calls[1].url, /schedule\/previous\/team\/100$/);
  assert.equal(result.mode, "live");
  assert.equal(result.teamIdSource, "team-search");
});

test("subscription failure is fail-closed and never invents form history", async () => {
  resetSportsDbTeamHistoryForTests();
  const result = await fetchSportsDbTeamHistory({
    team: "Home FC",
    existingResults: [],
    now: NOW,
    apiKey: "blocked",
    fetchImpl: async () => response({ message: "forbidden" }, 403)
  });
  resetSportsDbTeamHistoryForTests();

  assert.equal(result.ok, false);
  assert.equal(result.mode, "subscription_unavailable");
  assert.deepEqual(result.results, []);
});

test("result merger deduplicates shared league/team events and chronology count ignores future events", () => {
  const base = [{ id: "same", date: "2026-08-10", time: "18:00:00", home_team: "Home FC", away_team: "X", home_score: 1, away_score: 0, is_finished: true }];
  const additions = [
    { ...base[0] },
    { id: "old", date: "2026-08-08", time: "18:00:00", home_team: "Y", away_team: "Home FC", home_score: 0, away_score: 2, is_finished: true },
    { id: "future", date: "2026-08-20", time: "18:00:00", home_team: "Home FC", away_team: "Z", home_score: 5, away_score: 0, is_finished: true }
  ];
  const merged = mergeTeamHistoryResults(base, additions);
  assert.equal(merged.length, 3);
  assert.equal(teamCompletedSampleCount(merged, "Home FC", Date.parse(KICKOFF)), 2);
});

test("league provider requests team backfill only for thin matchup samples", async () => {
  resetResultsProviderCacheForTests();
  resetSportsDbTeamHistoryForTests();
  const teamCalls = [];
  const fetchImpl = async (url) => {
    if (String(url).includes("eventspastleague.php")) return response({ events: baseLeagueEvents });
    if (String(url).includes("eventsseason.php")) return response({ events: baseLeagueEvents });
    throw new Error(`Unexpected base URL: ${url}`);
  };
  const fetchTeamHistory = async ({ team }) => {
    teamCalls.push(team);
    return {
      ok: true,
      source: "thesportsdb-v2-team-history",
      mode: "live",
      team,
      results: team === "Home FC"
        ? homePrevious.map((event) => ({
            id: event.idEvent, source: "thesportsdb", sport: event.strSport, league: event.strLeague, date: event.dateEvent,
            time: event.strTime, home_team: event.strHomeTeam, away_team: event.strAwayTeam,
            home_score: Number(event.intHomeScore), away_score: Number(event.intAwayScore), is_finished: true, raw: event
          }))
        : awayPrevious.map((event) => ({
            id: event.idEvent, source: "thesportsdb", sport: event.strSport, league: event.strLeague, date: event.dateEvent,
            time: event.strTime, home_team: event.strHomeTeam, away_team: event.strAwayTeam,
            home_score: Number(event.intHomeScore), away_score: Number(event.intAwayScore), is_finished: true, raw: event
          }))
    };
  };

  const result = await fetchRecentLeagueResults({
    sportKey: "soccer_usa_mls",
    league: "MLS",
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    commenceTime: KICKOFF,
    now: NOW,
    fetchImpl,
    fetchTeamHistory
  });
  resetResultsProviderCacheForTests();
  resetSportsDbTeamHistoryForTests();

  assert.deepEqual(teamCalls.sort(), ["Away FC", "Home FC"]);
  assert.equal(result.teamDepth.attempted, true);
  assert.equal(result.teamDepth.reason, "team-history-completed-depth");
  assert.ok(result.teamDepth.rows.every((row) => row.after >= 3));
  assert.ok(result.resultCount > baseLeagueEvents.length);
  assert.equal(teamCompletedSampleCount(result.results, "Home FC", Date.parse(KICKOFF)) >= 3, true);
  assert.equal(teamCompletedSampleCount(result.results, "Away FC", Date.parse(KICKOFF)) >= 3, true);
});

test("base league cache never suppresses backfill for a different matchup", async () => {
  resetResultsProviderCacheForTests();
  const baseCalls = [];
  const teamCalls = [];
  const fetchImpl = async (url) => {
    baseCalls.push(String(url));
    if (String(url).includes("eventspastleague.php")) return response({ events: baseLeagueEvents });
    if (String(url).includes("eventsseason.php")) return response({ events: baseLeagueEvents });
    throw new Error(`Unexpected base URL: ${url}`);
  };
  const fetchTeamHistory = async ({ team }) => {
    teamCalls.push(team);
    return { ok: true, source: "mock-team", mode: "insufficient_history", team, results: [] };
  };

  await fetchRecentLeagueResults({
    sportKey: "soccer_usa_mls", league: "MLS", homeTeam: "Home FC", awayTeam: "Away FC",
    commenceTime: KICKOFF, now: NOW, fetchImpl, fetchTeamHistory
  });
  await fetchRecentLeagueResults({
    sportKey: "soccer_usa_mls", league: "MLS", homeTeam: "Second Home", awayTeam: "Second Away",
    commenceTime: KICKOFF, now: NOW + 1000, fetchImpl, fetchTeamHistory
  });
  resetResultsProviderCacheForTests();

  assert.equal(baseCalls.filter((url) => url.includes("eventspastleague.php")).length, 1);
  assert.equal(baseCalls.filter((url) => url.includes("eventsseason.php")).length, 1);
  assert.equal(teamCalls.includes("Second Home"), true);
  assert.equal(teamCalls.includes("Second Away"), true);
  assert.equal(RESULTS_PROVIDER_POLICY.baseLeagueCacheDoesNotIncludeMatchSpecificTeamDepth, true);
});

test("team history policy is bounded and audit-only", () => {
  assert.equal(SPORTSDATA_TEAM_HISTORY_POLICY.maxAcquisitionsPerWindow, 8);
  assert.equal(SPORTSDATA_TEAM_HISTORY_POLICY.minimumUsefulResults, 3);
  assert.equal(SPORTSDATA_TEAM_HISTORY_POLICY.auth, "X-API-KEY");
  assert.equal(SPORTSDATA_TEAM_HISTORY_POLICY.probabilityChanged, false);
  assert.equal(RESULTS_PROVIDER_POLICY.teamDepthMinimumResults, 3);
  assert.equal(RESULTS_PROVIDER_POLICY.probabilityChanged, false);
});
