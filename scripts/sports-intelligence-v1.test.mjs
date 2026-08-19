import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applySportsIntelligenceGate, buildSportsIntelligenceReport } from "../lib/sports-intelligence-v1.mjs";
import { evaluateIndependentIntelligenceSafetyV1 } from "../lib/intelligence-play-safety-v1.mjs";
import { INJURY_FETCHER_POLICY, sportToSportsDataLeague } from "../lib/injury-fetcher.js";
import {
  fetchSportsDataSoccerLineupForMatch,
  normalizeSportsDataSoccerLineup,
  sportsDataSoccerBoxScoresPath,
  SPORTSDATA_SOCCER_LINEUP_POLICY
} from "../lib/sportsdata-soccer-lineup-provider.js";

const NOW = Date.parse("2026-07-18T12:00:00Z");
const match = {
  homeTeam: "Home United",
  awayTeam: "Away City",
  sport: "soccer",
  league: "Test League",
  eventId: "event-1",
  commenceTime: "2026-07-18T18:00:00Z"
};

const mlsMatch = {
  homeTeam: "LA Galaxy",
  awayTeam: "Seattle Sounders FC",
  sport: "soccer_usa_mls",
  league: "MLS",
  eventId: "mls-event-1",
  commenceTime: "2026-08-15T02:00:00Z"
};

function starterRows(teamId, prefix, count = 11) {
  return Array.from({ length: count }, (_, index) => ({
    LineupId: teamId * 100 + index,
    GameId: 501,
    Type: "Starter",
    TeamId: teamId,
    PlayerId: teamId * 1000 + index,
    Name: `${prefix} Starter ${index + 1}`,
    Position: index === 0 ? "GK" : index < 5 ? "D" : index < 9 ? "M" : "A"
  }));
}

function mlsBoxScore({ homeCount = 11, awayCount = 11, duplicate = false } = {}) {
  const row = {
    Game: {
      GameId: 501,
      HomeTeamId: 101,
      AwayTeamId: 102,
      HomeTeamName: "LA Galaxy",
      AwayTeamName: "Seattle Sounders",
      Updated: "2026-08-15T01:20:00Z"
    },
    Lineups: [
      ...starterRows(101, "Home", homeCount),
      ...starterRows(102, "Away", awayCount),
      { LineupId: 9999, GameId: 501, Type: "Bench", TeamId: 101, PlayerId: 9999, Name: "Home Bench" }
    ]
  };
  return duplicate ? [row, { ...row, Game: { ...row.Game, GameId: 502 } }] : [row];
}

function providerData({ injuries = [], lineups } = {}) {
  return {
    news: {
      ok: true,
      mode: "live",
      source: "newsapi",
      retrievedAt: "2026-07-18T11:00:00Z",
      data: [{
        title: "Home United vs Away City team news",
        description: "Verified match preview.",
        source: "Reliable Sports Desk",
        sourceType: "media",
        url: "https://example.com/preview",
        publishedAt: "2026-07-18T10:00:00Z"
      }]
    },
    injuries: {
      ok: true,
      mode: "live",
      source: "sportsdata",
      retrievedAt: "2026-07-18T11:00:00Z",
      coverageChecked: true,
      data: injuries
    },
    lineup: {
      ok: true,
      mode: "live",
      source: "lineup-provider",
      retrievedAt: "2026-07-18T11:00:00Z",
      data: {
        teams: lineups ?? [match.homeTeam, match.awayTeam].map((team) => ({
          team,
          startersConfirmed: true,
          keyPlayersAvailable: true,
          source: "Official lineup feed",
          sourceType: "official_data_provider",
          updatedAt: "2026-07-18T11:00:00Z"
        }))
      }
    }
  };
}

function playPick(selection = match.homeTeam) {
  return {
    id: match.eventId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    selection,
    productDecision: "PLAY",
    decision: "BET",
    consensusProbability: 0.55,
    edge: 0.04,
    ev: 0.08,
    sourceTrust: 0.9
  };
}

test("SportsData injury adapter covers WNBA before generic NBA matching", () => {
  assert.equal(sportToSportsDataLeague("basketball_wnba", "WNBA"), "wnba");
  assert.equal(sportToSportsDataLeague("basketball_nba", "NBA"), "nba");
  assert.ok(INJURY_FETCHER_POLICY.supportedLeagues.includes("wnba"));
  assert.ok(INJURY_FETCHER_POLICY.injuryCacheTtlMs > 0);
  assert.ok(INJURY_FETCHER_POLICY.teamDirectoryTtlMs > INJURY_FETCHER_POLICY.injuryCacheTtlMs);
});

test("SportsData soccer lineup adapter uses v4 competition-scoped live BoxScores", () => {
  assert.equal(
    sportsDataSoccerBoxScoresPath(mlsMatch),
    "/v4/soccer/stats/JSON/BoxScoresByDate/8/2026-08-15"
  );
  assert.equal(
    sportsDataSoccerBoxScoresPath({
      ...mlsMatch,
      sport: "soccer_norway_eliteserien",
      league: "Eliteserien"
    }),
    "/v4/soccer/stats/JSON/BoxScoresByDate/42/2026-08-15"
  );
  assert.equal(
    sportsDataSoccerBoxScoresPath({
      ...mlsMatch,
      sport: "soccer_sweden_allsvenskan",
      league: "Allsvenskan"
    }),
    null
  );
  assert.equal(SPORTSDATA_SOCCER_LINEUP_POLICY.requiredStartersPerTeam, 11);
  assert.equal(SPORTSDATA_SOCCER_LINEUP_POLICY.confirmationRule, "exactly-11-starters-for-both-teams");
});

test("SportsData soccer lineup becomes live only with one exact match and 11 starters per team", () => {
  const verified = normalizeSportsDataSoccerLineup(mlsBoxScore(), mlsMatch);
  assert.equal(verified.ok, true);
  assert.equal(verified.mode, "live");
  assert.equal(verified.matchConfidence, 1);
  assert.deepEqual(verified.starterCounts, { home: 11, away: 11 });
  assert.equal(verified.data.teams.length, 2);
  assert.equal(verified.data.teams[0].startingPlayers.length, 11);
  assert.equal(verified.data.teams[1].startingPlayers.length, 11);
  assert.equal(verified.data.teams[0].startersConfirmed, true);

  const incomplete = normalizeSportsDataSoccerLineup(mlsBoxScore({ homeCount: 10 }), mlsMatch);
  assert.equal(incomplete.ok, true);
  assert.equal(incomplete.mode, "not_confirmed");
  assert.deepEqual(incomplete.starterCounts, { home: 10, away: 11 });
  assert.deepEqual(incomplete.data.teams, []);

  const ambiguous = normalizeSportsDataSoccerLineup(mlsBoxScore({ duplicate: true }), mlsMatch);
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.mode, "ambiguous_match");
});

test("SportsData soccer lineup fetch is capability-driven and does not call far-ahead fixtures", async () => {
  let calls = 0;
  const live = await fetchSportsDataSoccerLineupForMatch(mlsMatch, {
    now: Date.parse("2026-08-15T00:00:00Z"),
    get: async (path) => {
      calls += 1;
      assert.equal(path, "/v4/soccer/stats/JSON/BoxScoresByDate/8/2026-08-15");
      return { ok: true, source: "sportsdata", mode: "live", data: mlsBoxScore() };
    }
  });
  assert.equal(calls, 1);
  assert.equal(live.mode, "live");
  assert.equal(live.providerFamily, "sportsdataio");
  assert.equal(live.competitionId, "8");

  calls = 0;
  const early = await fetchSportsDataSoccerLineupForMatch(mlsMatch, {
    now: Date.parse("2026-08-14T12:00:00Z"),
    get: async () => {
      calls += 1;
      return { ok: true, source: "sportsdata", mode: "live", data: mlsBoxScore() };
    }
  });
  assert.equal(early.mode, "not_yet_available");
  assert.equal(calls, 0);
});

test("market-only context is neutral and preserves a market-qualified PLAY", () => {
  const report = buildSportsIntelligenceReport({
    match,
    intelligence: {
      news: { ok: true, mode: "not_configured", data: [] },
      injuries: { ok: true, mode: "not_configured", data: [] },
      lineup: { ok: true, mode: "not_configured", data: { teams: [] } }
    },
    now: NOW
  });
  const gated = applySportsIntelligenceGate(playPick(), report);

  assert.equal(report.readiness.level, "market-only");
  assert.equal(gated.productDecision, "PLAY");
  assert.equal(gated.decision, "BET");
  assert.equal(gated.intelligenceSafety.missingEvidenceIsDowngrade, false);
  assert.equal(gated.consensusProbability, 0.55);
  assert.equal(gated.probabilityAdjustedByIntelligence, false);
});

test("verified context preserves PLAY and remains downgrade-only", () => {
  const report = buildSportsIntelligenceReport({ match, intelligence: providerData(), now: NOW });
  const gated = applySportsIntelligenceGate(playPick(), report);

  assert.equal(report.readiness.level, "verified");
  assert.equal(gated.productDecision, "PLAY");
  assert.equal(gated.intelligenceUsedForUpgrade, false);
  assert.equal(gated.consensusProbability, 0.55);
});

test("team-attributed injury evidence affects only the matching selection", () => {
  const report = buildSportsIntelligenceReport({
    match,
    intelligence: providerData({ injuries: [{
      name: "Away Star",
      team: "Away City FC",
      status: "out",
      importance: 2,
      source: "sportsdata",
      sourceType: "official_data_provider",
      updatedAt: "2026-07-18T10:30:00Z"
    }] }),
    now: NOW
  });

  const away = applySportsIntelligenceGate(playPick(match.awayTeam), report);
  const home = applySportsIntelligenceGate(playPick(match.homeTeam), report);
  assert.ok(away.intelligenceRelativeImpact < 0);
  assert.equal(away.productDecision, "CAUTION");
  assert.ok(home.intelligenceRelativeImpact > 0);
  assert.equal(home.productDecision, "PLAY");
});

test("conflicts and generic lineup payloads fail closed", () => {
  const conflictReport = buildSportsIntelligenceReport({
    match,
    intelligence: providerData({ injuries: [
      { name: "Home Captain", team: match.homeTeam, status: "out", source: "A", sourceType: "official_data_provider", updatedAt: "2026-07-18T10:00:00Z" },
      { name: "Home Captain", team: match.homeTeam, status: "available", source: "B", sourceType: "official_data_provider", updatedAt: "2026-07-18T10:10:00Z" }
    ] }),
    now: NOW
  });
  const genericReport = buildSportsIntelligenceReport({
    match,
    intelligence: providerData({ lineups: [] }),
    now: NOW
  });

  assert.equal(conflictReport.conflicts.length, 1);
  assert.equal(applySportsIntelligenceGate(playPick(), conflictReport).productDecision, "CAUTION");
  assert.equal(genericReport.lineups.length, 0);
  assert.notEqual(genericReport.readiness.level, "verified");
});

test("Top Picks calculates market value before intelligence downgrade rules", async () => {
  const route = await readFile(new URL("../app/api/top-picks/route.js", import.meta.url), "utf8");
  const marketIndex = route.indexOf("marketDecision = \"BET\"");
  const safetyIndex = route.indexOf("const decision = preserveSafetyGate(marketDecision, pick)");

  assert.match(route, /MAX_INTELLIGENCE_ENRICHMENTS\s*=\s*12/);
  assert.ok(marketIndex >= 0 && safetyIndex > marketIndex);
  assert.match(route, /evaluateIndependentIntelligenceSafetyV1/);
  assert.doesNotMatch(route, /readiness\?\.level !== "verified"/);
  assert.match(route, /probabilityAdjustedByIntelligence:\s*false/);
});

test("provider loading is internal, authenticated, bounded and uses verified lineup fallback", async () => {
  const news = await readFile(new URL("../lib/news-fetcher.js", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/intelligence/route.js", import.meta.url), "utf8");
  const service = await readFile(new URL("../lib/intelligence-service.js", import.meta.url), "utf8");
  const internal = await readFile(new URL("../lib/sports-intelligence-service.js", import.meta.url), "utf8");
  const injuries = await readFile(new URL("../lib/injury-fetcher.js", import.meta.url), "utf8");
  const lineups = await readFile(new URL("../lib/lineup-fetcher.js", import.meta.url), "utf8");
  const soccerLineups = await readFile(new URL("../lib/sportsdata-soccer-lineup-provider.js", import.meta.url), "utf8");

  assert.doesNotMatch(news, /apiKey=\$\{apiKey\}/);
  assert.match(news, /"X-Api-Key": apiKey/);
  assert.match(route, /getAuthenticatedContext\(request\)/);
  assert.match(route, /bucket:\s*"sports_intelligence"/);
  assert.doesNotMatch(route, /fetchNewsForMatch|fetchInjuriesForMatch|fetchLineupForMatch/);
  assert.match(service, /loadSportsIntelligence/);
  assert.doesNotMatch(service, /\/api\/intelligence/);
  assert.match(internal, /CACHE_TTL_MS\s*=\s*5 \* 60 \* 1000/);
  assert.match(internal, /PROVIDER_MISS_LIMIT\s*=\s*72/);
  assert.match(injuries, /TEAM_DIRECTORY_TTL_MS/);
  assert.match(injuries, /\/v3\/\$\{selectedLeague\}\/scores\/json\/Teams/);
  assert.match(lineups, /fetchSportsDataSoccerLineupForMatch/);
  assert.match(lineups, /fallbackRequiresBothTeamsConfirmed:\s*true/);
  assert.match(soccerLineups, /\/v4\/soccer\/stats\/JSON\/BoxScoresByDate/);
  assert.match(soccerLineups, /exactly-11-starters-for-both-teams/);
  assert.doesNotMatch(soccerLineups, /\/v3\/soccer\/stats\/json\/BoxScoresByDate/);
});

test("PLAY safety downgrades only verified negative evidence or unresolved conflicts", () => {
  const missing = evaluateIndependentIntelligenceSafetyV1({
    report: { readiness: { level: "market-only" }, conflicts: [] },
    relativeImpact: -0.08
  });
  assert.equal(missing.downgrade, false);
  assert.equal(missing.missingEvidenceIsDowngrade, false);

  const negative = evaluateIndependentIntelligenceSafetyV1({
    report: { readiness: { level: "verified" }, conflicts: [] },
    relativeImpact: -0.02
  });
  assert.equal(negative.downgrade, true);
  assert.equal(negative.negativeVerifiedEvidence, true);

  const conflict = evaluateIndependentIntelligenceSafetyV1({
    report: { readiness: { level: "partial" }, conflicts: ["conflict"] },
    relativeImpact: 0
  });
  assert.equal(conflict.downgrade, true);
  assert.equal(conflict.criticalConflict, true);
});

