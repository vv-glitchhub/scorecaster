import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applySportsIntelligenceGate,
  buildSportsIntelligenceReport
} from "../lib/sports-intelligence-v1.mjs";

const NOW = Date.parse("2026-07-18T12:00:00Z");
const match = {
  homeTeam: "Home United",
  awayTeam: "Away City",
  sport: "soccer",
  league: "Test League",
  eventId: "event-1",
  commenceTime: "2026-07-18T18:00:00Z"
};

function intelligence({ injuries = [], lineups, news } = {}) {
  return {
    news: news || {
      ok: true,
      mode: "live",
      source: "newsapi",
      retrievedAt: "2026-07-18T11:00:00Z",
      data: [{
        title: "Home United vs Away City team news",
        description: "Verified match preview for Home United and Away City.",
        source: "Reliable Sports Desk",
        sourceType: "media",
        url: "https://example.com/match-preview",
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
        teams: lineups || [
          {
            team: "Home United",
            startersConfirmed: true,
            keyPlayersAvailable: true,
            source: "Official lineup feed",
            sourceType: "official_data_provider",
            updatedAt: "2026-07-18T11:00:00Z"
          },
          {
            team: "Away City",
            startersConfirmed: true,
            keyPlayersAvailable: true,
            source: "Official lineup feed",
            sourceType: "official_data_provider",
            updatedAt: "2026-07-18T11:00:00Z"
          }
        ]
      }
    }
  };
}

function playPick(selection) {
  return {
    id: "event-1",
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

test("market-only evidence can never create or preserve PLAY", () => {
  const report = buildSportsIntelligenceReport({
    match,
    intelligence: {
      news: { ok: true, mode: "not_configured", data: [] },
      injuries: { ok: true, mode: "not_configured", data: [] },
      lineup: { ok: true, mode: "not_configured", data: { teams: [] } }
    },
    now: NOW
  });
  const gated = applySportsIntelligenceGate(playPick(match.homeTeam), report);

  assert.equal(report.readiness.level, "market-only");
  assert.equal(gated.productDecision, "CAUTION");
  assert.equal(gated.decision, "WATCH");
  assert.equal(gated.probabilityAdjustedByIntelligence, false);
  assert.equal(gated.consensusProbability, 0.55);
});

test("clean verified evidence preserves an existing PLAY without changing probability", () => {
  const report = buildSportsIntelligenceReport({ match, intelligence: intelligence(), now: NOW });
  const gated = applySportsIntelligenceGate(playPick(match.homeTeam), report);

  assert.equal(report.readiness.level, "verified");
  assert.equal(gated.productDecision, "PLAY");
  assert.equal(gated.decision, "BET");
  assert.equal(gated.consensusProbability, 0.55);
  assert.equal(gated.probabilityAdjustedByIntelligence, false);
  assert.equal(gated.intelligenceUsedForUpgrade, false);
});

test("an away-team absence is negative only for the away selection", () => {
  const report = buildSportsIntelligenceReport({
    match,
    intelligence: intelligence({
      injuries: [{
        name: "Away Star",
        team: "Away City FC",
        status: "out",
        importance: 2,
        source: "sportsdata",
        sourceType: "official_data_provider",
        updatedAt: "2026-07-18T10:30:00Z"
      }]
    }),
    now: NOW
  });

  const away = applySportsIntelligenceGate(playPick(match.awayTeam), report);
  const home = applySportsIntelligenceGate(playPick(match.homeTeam), report);

  assert.equal(report.readiness.level, "verified");
  assert.ok(report.impacts.away < 0);
  assert.ok(away.intelligenceRelativeImpact < 0);
  assert.equal(away.productDecision, "CAUTION");
  assert.ok(home.intelligenceRelativeImpact > 0);
  assert.equal(home.productDecision, "PLAY");
  assert.equal(home.intelligenceUsedForUpgrade, false);
});

test("unattributed and stale injury rows are ignored", () => {
  const report = buildSportsIntelligenceReport({
    match,
    intelligence: intelligence({
      injuries: [
        {
          name: "Unknown Player",
          team: "Different Club",
          status: "out",
          importance: 3,
          sourceType: "official_data_provider",
          updatedAt: "2026-07-18T10:30:00Z"
        },
        {
          name: "Old Home Player",
          team: "Home United",
          status: "out",
          importance: 3,
          sourceType: "official_data_provider",
          updatedAt: "2026-07-01T10:30:00Z"
        }
      ]
    }),
    now: NOW
  });

  assert.equal(report.injuries.length, 0);
  assert.ok(report.impacts.home >= 0);
  assert.ok(report.impacts.away >= 0);
});

test("conflicting availability reports fail closed", () => {
  const report = buildSportsIntelligenceReport({
    match,
    intelligence: intelligence({
      injuries: [
        {
          name: "Home Captain",
          team: "Home United",
          status: "out",
          source: "Provider A",
          sourceType: "official_data_provider",
          updatedAt: "2026-07-18T10:00:00Z"
        },
        {
          name: "Home Captain",
          team: "Home United",
          status: "available",
          source: "Provider B",
          sourceType: "official_data_provider",
          updatedAt: "2026-07-18T10:10:00Z"
        }
      ]
    }),
    now: NOW
  });
  const gated = applySportsIntelligenceGate(playPick(match.homeTeam), report);

  assert.equal(report.conflicts.length, 1);
  assert.equal(report.readiness.checks.noConflicts, false);
  assert.equal(gated.productDecision, "CAUTION");
  assert.match(gated.evidenceGateReason, /unresolved conflict/i);
});

test("generic lineup payloads cannot impersonate team-attributed evidence", () => {
  const report = buildSportsIntelligenceReport({
    match,
    intelligence: intelligence({ lineups: [] }),
    now: NOW
  });

  assert.equal(report.lineups.length, 0);
  assert.notEqual(report.readiness.level, "verified");
  assert.ok(report.readiness.missing.includes("verified home lineup"));
  assert.ok(report.readiness.missing.includes("verified away lineup"));
});

test("Top Picks calculates the market decision first and only then applies downgrade rules", async () => {
  const route = await readFile(new URL("../app/api/top-picks/route.js", import.meta.url), "utf8");
  const marketIndex = route.indexOf("marketDecision = \"BET\"");
  const safetyIndex = route.indexOf("const decision = preserveSafetyGate(marketDecision, pick)");

  assert.match(route, /MAX_INTELLIGENCE_ENRICHMENTS\s*=\s*12/);
  assert.ok(marketIndex >= 0);
  assert.ok(safetyIndex > marketIndex);
  assert.match(route, /if \(marketDecision !== "BET"\) return marketDecision/);
  assert.match(route, /readiness\?\.level !== "verified"/);
  assert.match(route, /intelligenceRelativeImpact \|\| 0\) <= -0\.015/);
  assert.doesNotMatch(route, /upstream === "CAUTION"/);
  assert.match(route, /probabilityAdjustedByIntelligence:\s*false/);
  assert.match(route, /team-attributed-audit-only/);
});

test("provider secrets stay in headers and intelligence calls are cached", async () => {
  const newsFetcher = await readFile(new URL("../lib/news-fetcher.js", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/intelligence/route.js", import.meta.url), "utf8");

  assert.doesNotMatch(newsFetcher, /apiKey=\$\{apiKey\}/);
  assert.match(newsFetcher, /"X-Api-Key": apiKey/);
  assert.match(route, /CACHE_TTL_MS\s*=\s*5 \* 60 \* 1000/);
  assert.match(route, /sameOriginOrServerRequest/);
  assert.match(route, /buildSportsIntelligenceReport/);
});
