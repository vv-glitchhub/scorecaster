import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchSportsDbTeamHistory,
  resetSportsDbTeamHistoryForTests,
  SPORTSDATA_TEAM_HISTORY_POLICY
} from "../lib/thesportsdb-team-history-v1.mjs";
import {
  fetchRecentLeagueResults,
  resetResultsProviderCacheForTests,
  RESULTS_PROVIDER_POLICY
} from "../lib/results-provider.js";

const NOW = Date.parse("2026-08-15T04:00:00Z");
const KICKOFF = "2026-08-16T18:00:00Z";

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(data); }
  };
}

function event(id, date, home = "Home FC", away = "Away FC") {
  return {
    idEvent: id,
    strSport: "Soccer",
    idLeague: "4346",
    strLeague: "Major League Soccer",
    dateEvent: date,
    strTime: "18:00:00",
    strTimestamp: `${date}T18:00:00`,
    strHomeTeam: home,
    strAwayTeam: away,
    intHomeScore: "1",
    intAwayScore: "0",
    idHomeTeam: "100",
    idAwayTeam: "200",
    strStatus: "Match Finished"
  };
}

test("documented free key 123 skips premium-only v2 team history without a network request", async () => {
  resetSportsDbTeamHistoryForTests();
  let calls = 0;
  const result = await fetchSportsDbTeamHistory({
    team: "Home FC",
    apiKey: "123",
    now: NOW,
    fetchImpl: async () => {
      calls += 1;
      throw new Error("free key must never call premium v2");
    }
  });
  resetSportsDbTeamHistoryForTests();

  assert.equal(calls, 0);
  assert.equal(result.ok, true);
  assert.equal(result.mode, "premium_key_required");
  assert.equal(result.premiumRequired, true);
  assert.equal(result.networkRequestMade, false);
  assert.deepEqual(result.results, []);
});

test("base v1 league history uses current free key and exposes premium blocker instead of inventing 3-game depth", async () => {
  const previous = process.env.THESPORTSDB_API_KEY;
  delete process.env.THESPORTSDB_API_KEY;
  resetResultsProviderCacheForTests();
  resetSportsDbTeamHistoryForTests();
  const calls = [];
  try {
    const fetchImpl = async (url) => {
      calls.push(String(url));
      if (String(url).includes("eventspastleague.php")) return response({ events: [event("recent", "2026-08-10")] });
      if (String(url).includes("eventsseason.php")) return response({ events: [event("recent", "2026-08-10")] });
      throw new Error(`unexpected network call ${url}`);
    };

    const result = await fetchRecentLeagueResults({
      sportKey: "soccer_usa_mls",
      league: "MLS",
      homeTeam: "Home FC",
      awayTeam: "Away FC",
      commenceTime: KICKOFF,
      now: NOW,
      fetchImpl
    });

    assert.equal(calls.length, 2);
    assert.ok(calls.every((url) => url.includes("/api/v1/json/123/")));
    assert.equal(calls.some((url) => url.includes("/api/v2/")), false);
    assert.equal(result.teamDepth.reason, "team-history-premium-required");
    assert.equal(result.teamDepth.premiumRequired, true);
    assert.ok(result.teamDepth.rows.every((row) => row.mode === "premium_key_required"));
    assert.ok(result.teamDepth.rows.every((row) => row.networkRequestMade === false));
    assert.ok(result.teamDepth.rows.every((row) => row.after < 3));
  } finally {
    resetResultsProviderCacheForTests();
    resetSportsDbTeamHistoryForTests();
    if (previous === undefined) delete process.env.THESPORTSDB_API_KEY;
    else process.env.THESPORTSDB_API_KEY = previous;
  }
});

test("explicit non-free key may attempt v2 but subscription denial stays fail-closed", async () => {
  resetSportsDbTeamHistoryForTests();
  let calls = 0;
  const result = await fetchSportsDbTeamHistory({
    team: "Home FC",
    existingResults: [{
      id: "base",
      date: "2026-08-10",
      time: "18:00:00",
      home_team: "Home FC",
      away_team: "Away FC",
      home_score: 1,
      away_score: 0,
      is_finished: true,
      raw: { idHomeTeam: "100", idAwayTeam: "200" }
    }],
    apiKey: "explicit-premium-candidate",
    now: NOW,
    fetchImpl: async () => {
      calls += 1;
      return response({ message: "subscription required" }, 401);
    }
  });
  resetSportsDbTeamHistoryForTests();

  assert.equal(calls, 1);
  assert.equal(result.ok, false);
  assert.equal(result.mode, "subscription_unavailable");
  assert.equal(result.status, 401);
  assert.equal(result.premiumRequired, true);
  assert.deepEqual(result.results, []);
});

test("capability policy keeps the minimum sample and paper-only model boundary unchanged", () => {
  assert.equal(SPORTSDATA_TEAM_HISTORY_POLICY.freeV1Key, "123");
  assert.equal(SPORTSDATA_TEAM_HISTORY_POLICY.v2RequiresPremiumCandidate, true);
  assert.equal(SPORTSDATA_TEAM_HISTORY_POLICY.freeKeySkipsV2Network, true);
  assert.equal(SPORTSDATA_TEAM_HISTORY_POLICY.minimumUsefulResults, 3);
  assert.equal(SPORTSDATA_TEAM_HISTORY_POLICY.probabilityChanged, false);
  assert.equal(SPORTSDATA_TEAM_HISTORY_POLICY.paperOnly, true);
  assert.equal(RESULTS_PROVIDER_POLICY.freeV1Key, "123");
  assert.equal(RESULTS_PROVIDER_POLICY.teamHistoryPremiumRequired, true);
  assert.equal(RESULTS_PROVIDER_POLICY.teamDepthMinimumResults, 3);
  assert.equal(RESULTS_PROVIDER_POLICY.probabilityChanged, false);
  assert.equal(RESULTS_PROVIDER_POLICY.paperOnly, true);
});
