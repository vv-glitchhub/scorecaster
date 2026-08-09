import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readConfig = async () => JSON.parse(await readFile(new URL("vercel.json", root), "utf8"));

test("automatic Git deployments are disabled by default and explicitly enabled for main", async () => {
  const config = await readConfig();
  assert.equal(config.git?.deploymentEnabled?.["*"], false);
  assert.equal(config.git?.deploymentEnabled?.main, true);
});

test("build-stage ignoreCommand is removed so canceled previews do not consume quota by design", async () => {
  const config = await readConfig();
  assert.equal(Object.prototype.hasOwnProperty.call(config, "ignoreCommand"), false);
});

test("production cron remains unchanged", async () => {
  const config = await readConfig();
  assert.deepEqual(config.crons, [{
    path: "/api/cron/update-ratings",
    schedule: "0 5 * * *"
  }]);
});

test("deployment policy is infrastructure-only", async () => {
  const raw = await readFile(new URL("vercel.json", root), "utf8");
  for (const forbidden of [
    /bookmaker/i,
    /placeBet/i,
    /submitBet/i,
    /payment/i,
    /stake/i,
    /probability/i,
    /SPORTSGAMEODDS_API_KEY/,
    /CRON_SECRET/
  ]) assert.doesNotMatch(raw, forbidden);
});
