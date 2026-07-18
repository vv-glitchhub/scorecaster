import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applySportsIntelligenceGate, buildSportsIntelligenceReport } from "../lib/sports-intelligence-v1.mjs";

const NOW = Date.parse("2026-07-18T12:00:00Z");
const match = {
  homeTeam: "Home United",
  awayTeam: "Away City",
  sport: "soccer",
  league: "Test League",
  eventId: "event-1",
  commenceTime: "2026-07-18T18:00:00Z"
};

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

test("market-only context downgrades PLAY without changing probability", () => {
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
  assert.equal(gated.productDecision, "CAUTION");
  assert.equal(gated.decision, "WATCH");
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
  assert.match(route, /readiness\?\.level !== "verified"/);
  assert.match(route, /probabilityAdjustedByIntelligence:\s*false/);
});

test("provider loading is internal, authenticated and bounded", async () => {
  const news = await readFile(new URL("../lib/news-fetcher.js", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/intelligence/route.js", import.meta.url), "utf8");
  const service = await readFile(new URL("../lib/intelligence-service.js", import.meta.url), "utf8");
  const internal = await readFile(new URL("../lib/sports-intelligence-service.js", import.meta.url), "utf8");

  assert.doesNotMatch(news, /apiKey=\$\{apiKey\}/);
  assert.match(news, /"X-Api-Key": apiKey/);
  assert.match(route, /getAuthenticatedContext\(request\)/);
  assert.match(route, /bucket:\s*"sports_intelligence"/);
  assert.doesNotMatch(route, /fetchNewsForMatch|fetchInjuriesForMatch|fetchLineupForMatch/);
  assert.match(service, /loadSportsIntelligence/);
  assert.doesNotMatch(service, /\/api\/intelligence/);
  assert.match(internal, /CACHE_TTL_MS\s*=\s*5 \* 60 \* 1000/);
  assert.match(internal, /PROVIDER_MISS_LIMIT\s*=\s*72/);
});
