import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyAutonomousSystemCaps,
  AUTONOMOUS_HARD_LIMITS,
  buildAutonomousRiskGovernor,
  buildDailyPaperUsage
} from "../lib/autonomous-risk-governor.mjs";

function resultRows({ count = 20, result = "win", stake = 10, odds = 2, closingOdds = 1.9 } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${result}-${index}`,
    result,
    stake,
    odds,
    closingOdds,
    modelProbability: 0.55,
    createdAt: new Date(Date.UTC(2026, 6, 23, 12, 0) - index * 60_000).toISOString()
  }));
}

test("hard system caps can only tighten user bankroll settings", () => {
  assert.deepEqual(AUTONOMOUS_HARD_LIMITS, {
    maxStakePercent: 1,
    maxDailyExposurePercent: 5,
    maxLeagueExposurePercent: 2.5
  });
  const capped = applyAutonomousSystemCaps({
    bankroll: 1000,
    maxStakePercent: 4,
    maxTotalExposurePercent: 12,
    maxLeagueExposurePercent: 8
  });
  assert.equal(capped.maxStakePercent, 1);
  assert.equal(capped.maxTotalExposurePercent, 5);
  assert.equal(capped.maxLeagueExposurePercent, 2.5);

  const tighter = applyAutonomousSystemCaps({
    bankroll: 1000,
    maxStakePercent: 0.5,
    maxTotalExposurePercent: 3,
    maxLeagueExposurePercent: 1.5
  });
  assert.equal(tighter.maxStakePercent, 0.5);
  assert.equal(tighter.maxTotalExposurePercent, 3);
  assert.equal(tighter.maxLeagueExposurePercent, 1.5);
});

test("daily usage counts only autonomous paper rows and deduplicates event identities", () => {
  const usage = buildDailyPaperUsage([
    { stake: 10, match: "A vs B", raw_pick: { source: "scorecaster-autonomous-v12", eventId: "event-1" } },
    { stake: 12, match: "A vs B", raw_pick: { source: "scorecaster-autonomous-v12", eventId: "event-1" } },
    { stake: 8, match: "C vs D", raw_pick: { source: "scorecaster-autonomous-v2", eventId: "event-2" } },
    { stake: 99, match: "Manual", raw_pick: { source: "manual-paper" } }
  ]);
  assert.equal(usage.pickCount, 3);
  assert.equal(usage.totalStake, 30);
  assert.equal(usage.events.size, 2);
  assert.ok(usage.events.has("event-1"));
  assert.ok(usage.events.has("event-2"));
});

test("risk governor pauses on hard performance and drift failures", () => {
  const losses = resultRows({ count: 20, result: "loss", closingOdds: 2.1 });
  const governor = buildAutonomousRiskGovernor(losses, {
    modelLab: { drift: { status: "critical" } }
  });
  assert.equal(governor.mode, "paused");
  assert.equal(governor.allowNewExposure, false);
  assert.equal(governor.stakeMultiplier, 0);
  assert.ok(governor.hardReasons.includes("critical_model_drift"));
  assert.ok(governor.hardReasons.includes("loss_streak_6"));
  assert.ok(governor.hardReasons.includes("recent_roi_below_-25pct"));
});

test("risk governor enters caution and only reduces stakes", () => {
  const rows = [
    ...resultRows({ count: 3, result: "loss", closingOdds: 2.1 }),
    ...resultRows({ count: 17, result: "win", closingOdds: 2.05 })
  ];
  const governor = buildAutonomousRiskGovernor(rows, {
    modelLab: { drift: { status: "warning" } }
  });
  assert.equal(governor.mode, "caution");
  assert.equal(governor.allowNewExposure, true);
  assert.equal(governor.stakeMultiplier, 0.5);
  assert.equal(governor.priorityPenalty, 0.03);
  assert.ok(governor.cautionReasons.includes("model_drift_warning"));
});

test("daily worker is wired behind V12 and stores bounded decision tickets", async () => {
  const root = new URL("../", import.meta.url);
  const source = (path) => readFile(new URL(path, root), "utf8");
  const [worker, runner, route, packageJson] = await Promise.all([
    source("lib/autonomous-paper-agent-v2.js"),
    source("lib/autonomous-scorecaster-v12-runner.js"),
    source("app/api/internal/autonomous-agent/route.js"),
    source("package.json")
  ]);
  assert.match(worker, /gte\("created_at", dayStart\)/);
  assert.match(worker, /daily_pick_limit_reached/);
  assert.match(worker, /event_already_exposed_today/);
  assert.match(worker, /daily_exposure_full/);
  assert.match(worker, /scorecaster-autonomous-v12/);
  assert.match(worker, /decisionTicket: contextAudit/);
  assert.match(worker, /autonomyV12: decision\.autonomyV12/);
  assert.match(worker, /unifiedSportsData: decision\.unifiedSportsData/);
  assert.match(runner, /runAutonomousPaperAgentV2/);
  assert.match(runner, /persistentUtcDailyPickLimit: true/);
  assert.match(runner, /persistentDailyExposureCap: true/);
  assert.match(runner, /sameEventDailyDuplicateBlock: true/);
  assert.match(runner, /hardMaxStakePercent: 1/);
  assert.match(route, /runAutonomousScorecasterV12/);
  assert.match(packageJson, /autonomous-daily-governor\.test\.mjs/);
});

test("Mission Control exposes the same persistent budget on web and native mobile", async () => {
  const root = new URL("../", import.meta.url);
  const source = (path) => readFile(new URL(path, root), "utf8");
  const [api, web, mobile] = await Promise.all([
    source("app/api/cloud/autonomy-mission-control/route.js"),
    source("app/mission-control/MissionControlClient.jsx"),
    source("mobile/src/screens/MissionControlScreen.tsx")
  ]);
  for (const token of ["picksUsed", "picksRemaining", "stakeUsed", "exposureCap", "exposureRemaining", "hardLimits"]) {
    assert.match(api, new RegExp(token));
    assert.match(web, new RegExp(token));
    assert.match(mobile, new RegExp(token));
  }
  assert.match(api, /gte\("created_at", dayStart\)/);
  assert.match(api, /autonomy-mission-control-v12-daily-governor/);
  assert.match(web, /persistent UTC/);
  assert.match(web, /1% \/ 5% \/ 2\.5%/);
  assert.match(mobile, /PERSISTENT UTC DAILY BUDGET/);
  assert.match(mobile, /maxStakePercent/);
  assert.doesNotMatch(api, /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|ODDS_API_KEY/);
});
