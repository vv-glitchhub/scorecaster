import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/validation-runway/page.jsx", import.meta.url), "utf8");
const client = await readFile(new URL("../app/validation-runway/ValidationRunwayClient.jsx", import.meta.url), "utf8");
const acceptance = await readFile(new URL("../app/acceptance-validation/page.jsx", import.meta.url), "utf8");

test("Validation Runway stays server-side and aggregate-only", () => {
  assert.match(page, /getSupabaseAdmin/);
  assert.match(page, /force-dynamic/);
  assert.match(page, /OWNED_FOOTBALL_LEAGUES/);
  assert.match(page, /scorecaster_pit_feature_snapshots_v1/);
  assert.match(page, /scorecaster_event_identity_map_v1/);
  assert.match(page, /verifiedIdentityMappings/);
  assert.match(page, /unmappedEvents/);
  assert.match(page, /chronologySafeStartedEvents/);
  assert.match(page, /aggregationOnly:\s*true/);
  assert.match(page, /teamNamesExposed:\s*false/);
  assert.match(page, /syntheticBackfillAllowed:\s*false/);
  assert.match(page, /automaticModelPromotionAllowed:\s*false/);
  assert.match(page, /realMoneyActionAvailable:\s*false/);
  assert.match(page, /paperOnly:\s*true/);
  assert.doesNotMatch(client, /getSupabaseAdmin/);
  assert.doesNotMatch(client, /event_id|source_event_id|home_team|away_team/);
});

test("Validation Runway does not create another live API route", async () => {
  await assert.rejects(
    readFile(new URL("../app/api/validation-runway/route.js", import.meta.url), "utf8"),
    (error) => error?.code === "ENOENT"
  );
  assert.doesNotMatch(client, /fetch\s*\(/);
});

test("Validation Runway communicates the evidence contract and is linked from acceptance", () => {
  assert.match(client, /data-validation-runway-v1="true"/);
  assert.match(client, /Pregame only/);
  assert.match(client, /Verified outcome/);
  assert.match(client, /No synthetic backfill/);
  assert.match(client, /Manual promotion/);
  assert.match(acceptance, /href="\/validation-runway"/);
});

test("Validation Runway timestamps are deterministic across Vercel and browsers", () => {
  assert.match(client, /OPERATIONAL_TIME_ZONE = "Europe\/Helsinki"/);
  assert.match(client, /timeZone:\s*OPERATIONAL_TIME_ZONE/);
  assert.match(client, /timeZone:\s*"UTC"/);
  assert.match(client, /hint=\{kickoff\.utc\}/);
  assert.doesNotMatch(client, /toLocaleString\(locale\)/);
});
