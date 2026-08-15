import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchInjuriesForMatch,
  filterSportsDataInjuryRows,
  resetInjuryFetcherCachesForTests,
  sportsDataInjuryPath,
  INJURY_FETCHER_POLICY
} from "../lib/injury-fetcher.js";
import {
  fetchSportsDataOddsForMatch,
  resetSportsDataOddsCacheForTests,
  sportsDataWnbaOddsPath,
  SPORTSDATA_ODDS_POLICY
} from "../lib/sportsdata-odds-provider.js";

const WNBA_MATCH = {
  eventId: "wnba-provider-test",
  homeTeam: "Connecticut Sun",
  awayTeam: "New York Liberty",
  sportKey: "basketball_wnba",
  sport: "WNBA",
  league: "WNBA",
  commenceTime: "2026-08-15T00:00:00.000Z"
};

const TEAMS = [
  { TeamID: 1, Key: "CON", City: "Connecticut", Name: "Sun", FullName: "Connecticut Sun" },
  { TeamID: 2, Key: "NY", City: "New York", Name: "Liberty", FullName: "New York Liberty" }
];

const PLAYERS = [
  {
    PlayerID: 10,
    TeamID: 1,
    Team: "CON",
    FirstName: "Injured",
    LastName: "Sun Player",
    Name: "Injured Sun Player",
    Status: "Active",
    InjuryStatus: "Out",
    InjuryBodyPart: "Ankle",
    InjuryNotes: "Out",
    Updated: "2026-08-14T22:00:00Z"
  },
  {
    PlayerID: 20,
    TeamID: 2,
    Team: "NY",
    Name: "Questionable Liberty Player",
    Status: "Active",
    InjuryStatus: "Questionable",
    InjuryBodyPart: "Knee",
    Updated: "2026-08-14T22:05:00Z"
  },
  {
    PlayerID: 21,
    TeamID: 2,
    Team: "NY",
    Name: "Healthy Liberty Player",
    Status: "Active",
    InjuryStatus: null,
    InjuryBodyPart: null,
    Updated: "2026-08-14T22:05:00Z"
  }
];

const GAME_ODDS = [{
  GameID: 7001,
  HomeTeamName: "Connecticut Sun",
  AwayTeamName: "New York Liberty",
  PregameOdds: [
    { Sportsbook: "Book A", OddType: "Pregame", HomeMoneyLine: 115, AwayMoneyLine: -130, Updated: "2026-08-14T22:00:00Z" },
    { Sportsbook: "Book B", OddType: "Pregame", HomeMoneyLine: 110, AwayMoneyLine: -125, Updated: "2026-08-14T22:02:00Z" }
  ]
}];

test("WNBA injuries use Players while legacy league injury endpoints remain unchanged", () => {
  assert.equal(sportsDataInjuryPath("wnba"), "/v3/wnba/scores/JSON/Players");
  assert.equal(sportsDataInjuryPath("nhl"), "/v3/nhl/scores/json/Injuries");
  assert.equal(INJURY_FETCHER_POLICY.wnbaEndpoint, "/v3/wnba/scores/JSON/Players");
  assert.equal(INJURY_FETCHER_POLICY.wnbaHealthyPlayersExcluded, true);
});

test("WNBA Players feed excludes healthy active players and keeps explicit injury statuses", () => {
  const rows = filterSportsDataInjuryRows("wnba", PLAYERS);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.Name).sort(), ["Injured Sun Player", "Questionable Liberty Player"]);
  assert.equal(rows.some((row) => row.Name === "Healthy Liberty Player"), false);

  const unchanged = filterSportsDataInjuryRows("nhl", PLAYERS);
  assert.equal(unchanged.length, PLAYERS.length);
});

test("WNBA injury fetch verifies both teams from Players and Teams feeds", async () => {
  resetInjuryFetcherCachesForTests();
  const calls = [];
  const result = await fetchInjuriesForMatch(WNBA_MATCH, {
    get: async (path) => {
      calls.push(path);
      if (path === "/v3/wnba/scores/JSON/Players") {
        return { ok: true, source: "sportsdata", mode: "live", status: 200, path, data: PLAYERS };
      }
      if (path === "/v3/wnba/scores/json/Teams") {
        return { ok: true, source: "sportsdata", mode: "live", status: 200, path, data: TEAMS };
      }
      throw new Error(`Unexpected path: ${path}`);
    }
  });
  resetInjuryFetcherCachesForTests();

  assert.deepEqual(calls.sort(), ["/v3/wnba/scores/JSON/Players", "/v3/wnba/scores/json/Teams"].sort());
  assert.equal(result.ok, true);
  assert.equal(result.mode, "live");
  assert.equal(result.coverageChecked, true);
  assert.equal(result.path, "/v3/wnba/scores/JSON/Players");
  assert.equal(result.rawProviderCount, 3);
  assert.equal(result.injuryCandidateCount, 2);
  assert.equal(result.count, 2);
  assert.equal(result.data.some((row) => row.name === "Healthy Liberty Player"), false);
  assert.deepEqual(new Set(result.data.map((row) => row.team)), new Set(["Connecticut Sun", "New York Liberty"]));
  assert.deepEqual(new Set(result.data.map((row) => row.status)), new Set(["out", "questionable"]));
});

test("WNBA injury subscription failure stays fail-closed", async () => {
  resetInjuryFetcherCachesForTests();
  const result = await fetchInjuriesForMatch(WNBA_MATCH, {
    get: async (path) => ({
      ok: false,
      source: "sportsdata",
      mode: "subscription_unavailable",
      status: 403,
      path,
      data: []
    })
  });
  resetInjuryFetcherCachesForTests();

  assert.equal(result.ok, false);
  assert.equal(result.mode, "subscription_unavailable");
  assert.equal(result.coverageChecked, false);
  assert.deepEqual(result.data, []);
});

test("WNBA secondary odds fetch calls current scores GameOddsByDate endpoint and normalizes live prices", async () => {
  resetSportsDataOddsCacheForTests();
  let requestedPath = null;
  const result = await fetchSportsDataOddsForMatch(WNBA_MATCH, {
    get: async (path) => {
      requestedPath = path;
      return { ok: true, source: "sportsdata", mode: "live", status: 200, path, data: GAME_ODDS };
    }
  });
  resetSportsDataOddsCacheForTests();

  assert.equal(requestedPath, "/v3/wnba/scores/JSON/GameOddsByDate/2026-AUG-14");
  assert.equal(requestedPath, sportsDataWnbaOddsPath(WNBA_MATCH));
  assert.equal(result.ok, true);
  assert.equal(result.mode, "live");
  assert.equal(result.providerFamily, "sportsdataio");
  assert.equal(result.matchConfidence, 1);
  assert.equal(result.data.home.bookmakerCount, 2);
  assert.equal(result.data.away.bookmakerCount, 2);
  assert.equal(result.probabilityChanged, false);
  assert.equal(SPORTSDATA_ODDS_POLICY.probabilityChanged, false);
});

test("WNBA secondary odds subscription failure never becomes live", async () => {
  resetSportsDataOddsCacheForTests();
  const result = await fetchSportsDataOddsForMatch(WNBA_MATCH, {
    get: async (path) => ({
      ok: false,
      source: "sportsdata",
      mode: "subscription_unavailable",
      status: 403,
      path,
      data: []
    })
  });
  resetSportsDataOddsCacheForTests();

  assert.equal(result.ok, false);
  assert.equal(result.mode, "subscription_unavailable");
  assert.equal(result.subscriptionUnavailable, true);
  assert.equal(result.eventRequestMade, true);
});
