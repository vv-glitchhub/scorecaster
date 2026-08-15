import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildUnifiedSportsDataLedger } from "../lib/unified-sports-data-v1.mjs";
import {
  attachSportsReportStartersToContext,
  buildUnifiedSportsDataLedgerWithLineupProvenance,
  UNIFIED_LINEUP_PROVENANCE_POLICY
} from "../lib/unified-lineup-provenance-v1.mjs";

const NOW = Date.parse("2026-08-15T01:00:00Z");
const pick = {
  id: "match-1",
  gameId: "match-1",
  homeTeam: "Home FC",
  awayTeam: "Away FC",
  selection: "Home FC",
  sportKey: "soccer_usa_mls",
  leagueTitle: "MLS",
  commenceTime: "2026-08-15T02:00:00Z",
  odds: 2.05,
  marketAverageOdds: 2.02,
  bookmakerCount: 7,
  confidence: 0.7,
  productDecision: "CAUTION",
  decision: "WATCH"
};

function starters(prefix, count = 11) {
  return Array.from({ length: count }, (_, index) => ({
    playerId: `${prefix}-${index + 1}`,
    name: `${prefix} Starter ${index + 1}`,
    position: index === 0 ? "GK" : index < 5 ? "D" : index < 9 ? "M" : "A",
    confirmed: true,
    importance: 1
  }));
}

function sportsReport() {
  return {
    providerLive: { news: false, injuries: false, lineup: true },
    injuries: [],
    news: [],
    lineups: [
      {
        team: "Home FC",
        side: "home",
        startersConfirmed: true,
        goalieConfirmed: false,
        keyPlayersAvailable: null,
        source: "sportsdata-soccer-lineups",
        sourceType: "official_data_provider",
        sourceTrust: 0.9,
        observedAt: "2026-08-15T00:45:00Z",
        startingPlayers: starters("Home"),
        impact: 0.0036
      },
      {
        team: "Away FC",
        side: "away",
        startersConfirmed: true,
        goalieConfirmed: false,
        keyPlayersAvailable: null,
        source: "sportsdata-soccer-lineups",
        sourceType: "official_data_provider",
        sourceTrust: 0.9,
        observedAt: "2026-08-15T00:45:00Z",
        startingPlayers: starters("Away"),
        impact: 0.0036
      }
    ]
  };
}

test("starter adapter preserves context mode and unrelated context fields", () => {
  const context = {
    ok: true,
    source: "sports-context-provider",
    mode: "not_configured",
    data: {
      home: { schedule: { restHours: 72 }, startingPlayers: [{ playerId: "Home-1", name: "Home Starter 1", confirmed: true }] },
      venue: { name: "Test Stadium" }
    }
  };
  const enriched = attachSportsReportStartersToContext(context, sportsReport());

  assert.equal(enriched.mode, "not_configured");
  assert.equal(enriched.data.home.schedule.restHours, 72);
  assert.equal(enriched.data.venue.name, "Test Stadium");
  assert.equal(enriched.data.home.startingPlayers.length, 11);
  assert.equal(enriched.data.away.startingPlayers.length, 11);
  assert.equal(enriched.data.home.lineupProvenance.providerStarterCount, 11);
  assert.equal(enriched.lineupProvenance.attachedStarters, 22);
  assert.equal(enriched.lineupProvenance.probabilityChanged, false);
});

test("Unified Data lineup factor exposes Sports Intelligence starter names and positions", () => {
  const report = sportsReport();
  const ledger = buildUnifiedSportsDataLedgerWithLineupProvenance({ pick, sportsReport: report, now: NOW });
  const lineup = ledger.factors.find((factor) => factor.key === "lineups-and-starters");
  const playerEvidence = lineup.evidence.filter((row) => row.player);

  assert.equal(lineup.status, "confirmed");
  assert.equal(lineup.usedByAi, true);
  assert.equal(playerEvidence.length, 11);
  assert.equal(playerEvidence[0].player, "Home Starter 1");
  assert.equal(playerEvidence[0].position, "GK");
  assert.equal(playerEvidence.every((row) => row.confirmed === true), true);
  assert.match(lineup.reason, /11 players/);
  assert.equal(ledger.policy.contextProbabilityApplied, false);
  assert.equal(ledger.policy.canUpgradeProductionDecision, false);
});

test("starter provenance enriches evidence without increasing factor confidence or coverage status", () => {
  const report = sportsReport();
  const base = buildUnifiedSportsDataLedger({ pick, sportsReport: report, now: NOW });
  const enriched = buildUnifiedSportsDataLedgerWithLineupProvenance({ pick, sportsReport: report, now: NOW });
  const baseLineup = base.factors.find((factor) => factor.key === "lineups-and-starters");
  const enrichedLineup = enriched.factors.find((factor) => factor.key === "lineups-and-starters");

  assert.equal(enrichedLineup.status, baseLineup.status);
  assert.equal(enrichedLineup.confidence, baseLineup.confidence);
  assert.equal(enrichedLineup.trust, baseLineup.trust);
  assert.equal(enrichedLineup.impact, baseLineup.impact);
  assert.equal(enriched.coverage.verifiedCoverageRate, base.coverage.verifiedCoverageRate);
  assert.equal(enriched.policy.contextProbabilityApplied, false);
  assert.equal(UNIFIED_LINEUP_PROVENANCE_POLICY.probabilityChanged, false);
  assert.equal(UNIFIED_LINEUP_PROVENANCE_POLICY.decisionChanged, false);
  assert.equal(UNIFIED_LINEUP_PROVENANCE_POLICY.stakeChanged, false);
});

test("Unified Data service uses the provenance wrapper and exposes lineup diagnostics", async () => {
  const service = await readFile(new URL("../lib/unified-sports-data-service.js", import.meta.url), "utf8");
  assert.match(service, /buildUnifiedSportsDataLedgerWithLineupProvenance/);
  assert.match(service, /lineupProviderSummary/);
  assert.match(service, /provenanceAttached:\s*starterCount > 0/);
  assert.doesNotMatch(service, /contextProbabilityApplied:\s*true/);
});
