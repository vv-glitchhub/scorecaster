import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const v3 = await readFile(new URL("../supabase/scorecaster_event_identity_normalization_v3.sql", import.meta.url), "utf8");
const v4 = await readFile(new URL("../supabase/scorecaster_event_identity_normalization_v4.sql", import.meta.url), "utf8");
const runwayRoute = await readFile(new URL("../app/api/validation-runway/route.js", import.meta.url), "utf8");
const runwayPage = await readFile(new URL("../app/validation-runway/ValidationRunwayClient.jsx", import.meta.url), "utf8");
const acceptancePage = await readFile(new URL("../app/acceptance-validation/page.jsx", import.meta.url), "utf8");

test("identity normalization stays deterministic and fail-closed", () => {
  const combined = `${v3}\n${v4}`;
  assert.match(combined, /create or replace function scorecaster_private\.normalize_team_identity/);
  assert.match(combined, /immutable/);
  assert.match(combined, /revoke all on function scorecaster_private\.normalize_team_identity\(text\) from public, anon, authenticated/);
  assert.match(combined, /grant execute on function scorecaster_private\.normalize_team_identity\(text\) to service_role/);
  assert.match(combined, /refresh_event_identity_map\(\)/);
  assert.doesNotMatch(combined, /similarity\s*\(/i);
  assert.doesNotMatch(combined, /levenshtein/i);
  assert.doesNotMatch(combined, /fuzzy/i);
});

test("observed provider/canonical aliases are regression-locked", () => {
  for (const token of [
    "Bayern Munich",
    "Athletic Bilbao",
    "Rennes",
    "Marseille",
    "Lazio",
    "Como",
    "Parma",
    "Angers SCO"
  ]) assert.match(`${v3}\n${v4}`, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
});

test("validation runway exposes only aggregate chronology-safe readiness", () => {
  assert.match(runwayRoute, /scorecaster-validation-runway-v1/);
  assert.match(runwayRoute, /OWNED_FOOTBALL_LEAGUES/);
  assert.match(runwayRoute, /verifiedIdentityMappings/);
  assert.match(runwayRoute, /unmappedEvents/);
  assert.match(runwayRoute, /chronologySafeStartedEvents/);
  assert.match(runwayRoute, /teamNamesExposed:\s*false/);
  assert.match(runwayRoute, /syntheticBackfillAllowed:\s*false/);
  assert.match(runwayRoute, /automaticModelPromotionAllowed:\s*false/);
  assert.match(runwayRoute, /realMoneyActionAvailable:\s*false/);
  assert.match(runwayRoute, /paperOnly:\s*true/);
});

test("validation runway is discoverable and explains no synthetic backfill", () => {
  assert.match(runwayPage, /data-validation-runway-v1="true"/);
  assert.match(runwayPage, /\/api\/validation-runway/);
  assert.match(runwayPage, /No synthetic backfill/);
  assert.match(runwayPage, /Pregame only/);
  assert.match(runwayPage, /Verified outcome/);
  assert.match(runwayPage, /Manual promotion/);
  assert.match(acceptancePage, /href="\/validation-runway"/);
});