import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  attachFormDepthProvenance,
  safeFormDepthProvenance,
  FORM_DEPTH_PROVENANCE_POLICY,
  FORM_DEPTH_PROVENANCE_VERSION
} from "../lib/form-depth-provenance-v1.mjs";

const basePick = {
  consensusProbability: 0.56,
  modelProbability: 0.55,
  edge: 0.03,
  ev: 0.05,
  decision: "WATCH",
  productDecision: "CAUTION",
  formRestShadow: {
    status: "feature_only",
    shadowProbability: null,
    probabilityAppliedToProduction: false,
    provider: {
      source: "thesportsdb",
      mode: "live",
      resultCount: 8,
      cached: false
    },
    samplePolicy: {
      minimumGamesPerTeam: 3,
      homeSampleSize: 4,
      awaySampleSize: 3
    }
  }
};

const history = {
  source: "thesportsdb",
  mode: "live",
  teamDepth: {
    attempted: true,
    reason: "team-history-completed-depth",
    minimumResultsPerTeam: 3,
    addedResults: 5,
    rows: [
      {
        team: "Home FC",
        before: 1,
        after: 4,
        added: 3,
        requested: true,
        mode: "live",
        source: "thesportsdb-v2-team-history",
        teamIdSource: "league-history",
        cached: false
      },
      {
        team: "Away FC",
        before: 1,
        after: 3,
        added: 2,
        requested: true,
        mode: "live",
        source: "thesportsdb-v2-team-history",
        teamIdSource: "team-search",
        cached: true
      }
    ]
  }
};

test("form-depth provenance records before/after team history without raw result payloads", () => {
  const provenance = safeFormDepthProvenance(history);
  assert.equal(provenance.version, FORM_DEPTH_PROVENANCE_VERSION);
  assert.equal(provenance.attempted, true);
  assert.equal(provenance.reason, "team-history-completed-depth");
  assert.equal(provenance.minimumResultsPerTeam, 3);
  assert.equal(provenance.addedResults, 5);
  assert.equal(provenance.completedDepth, true);
  assert.deepEqual(provenance.rows.map((row) => [row.team, row.before, row.after, row.added]), [
    ["Home FC", 1, 4, 3],
    ["Away FC", 1, 3, 2]
  ]);
  assert.equal(JSON.stringify(provenance).includes("results"), false);
});

test("attaching form-depth provenance changes audit source only and preserves model outputs", () => {
  const attached = attachFormDepthProvenance(basePick, history);
  assert.equal(attached.formRestShadow.provider.source, "thesportsdb+team-history");
  assert.equal(attached.formRestShadow.provider.formDepthProvenance.addedResults, 5);
  assert.equal(attached.formDepthProvenance.completedDepth, true);
  assert.equal(attached.consensusProbability, basePick.consensusProbability);
  assert.equal(attached.modelProbability, basePick.modelProbability);
  assert.equal(attached.edge, basePick.edge);
  assert.equal(attached.ev, basePick.ev);
  assert.equal(attached.decision, basePick.decision);
  assert.equal(attached.productDecision, basePick.productDecision);
  assert.equal(attached.formRestShadow.status, basePick.formRestShadow.status);
  assert.deepEqual(attached.formRestShadow.samplePolicy, basePick.formRestShadow.samplePolicy);
  assert.equal(attached.formRestShadow.probabilityAppliedToProduction, false);
});

test("no team-depth audit leaves the form shadow unchanged", () => {
  const attached = attachFormDepthProvenance(basePick, { source: "thesportsdb", mode: "live" });
  assert.equal(attached, basePick);
});

test("zero added team history does not mislabel the provider source", () => {
  const attached = attachFormDepthProvenance(basePick, {
    ...history,
    teamDepth: {
      attempted: false,
      reason: "league-history-sufficient",
      minimumResultsPerTeam: 3,
      addedResults: 0,
      rows: [
        { team: "Home FC", before: 4, after: 4, added: 0, requested: false, mode: "league-history-sufficient" },
        { team: "Away FC", before: 3, after: 3, added: 0, requested: false, mode: "league-history-sufficient" }
      ]
    }
  });
  assert.equal(attached.formRestShadow.provider.source, "thesportsdb");
  assert.equal(attached.formRestShadow.provider.formDepthProvenance.completedDepth, true);
});

test("form-depth provenance policy is audit-only", () => {
  assert.equal(FORM_DEPTH_PROVENANCE_POLICY.probabilityChanged, false);
  assert.equal(FORM_DEPTH_PROVENANCE_POLICY.decisionChanged, false);
  assert.equal(FORM_DEPTH_PROVENANCE_POLICY.edgeChanged, false);
  assert.equal(FORM_DEPTH_PROVENANCE_POLICY.evChanged, false);
  assert.equal(FORM_DEPTH_PROVENANCE_POLICY.stakeChanged, false);
  assert.equal(FORM_DEPTH_PROVENANCE_POLICY.paperOnly, true);
});

test("live intelligence loader attaches form-depth provenance after building form/rest shadow", async () => {
  const loader = await readFile(new URL("../lib/agent-intelligence-loader.js", import.meta.url), "utf8");
  assert.match(loader, /attachFormDepthProvenance/);
  assert.match(loader, /attachFormDepthProvenance\(attachFormRestShadow\(pick, history, now\), history\)/);
});
