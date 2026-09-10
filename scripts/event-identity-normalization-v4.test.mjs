import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const v3 = await readFile(new URL("../supabase/scorecaster_event_identity_normalization_v3.sql", import.meta.url), "utf8");
const v4 = await readFile(new URL("../supabase/scorecaster_event_identity_normalization_v4.sql", import.meta.url), "utf8");
const releaseManifest = JSON.parse(await readFile(new URL("../config/release-readiness.json", import.meta.url), "utf8"));

test("identity normalization stays deterministic and fail-closed", () => {
  const combined = `${v3}\n${v4}`;
  assert.match(combined, /create or replace function scorecaster_private\.normalize_team_identity/);
  assert.match(combined, /immutable/);
  assert.match(combined, /revoke all on function scorecaster_private\.normalize_team_identity\(text\) from public, anon, authenticated/);
  assert.match(combined, /grant execute on function scorecaster_private\.normalize_team_identity\(text\) to service_role/);
  assert.match(combined, /refresh_event_identity_map\(\)/);
  assert.doesNotMatch(combined, /similarity\s*\(/i);
  assert.doesNotMatch(combined, /levenshtein\s*\(/i);
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

test("identity normalization migrations are retained in reviewed dependency order", () => {
  const migrations = releaseManifest.supabaseMigrations;
  const fixtureMap = migrations.indexOf("supabase/scorecaster_event_identity_fixture_map_v3.sql");
  const v3Index = migrations.indexOf("supabase/scorecaster_event_identity_normalization_v3.sql");
  const v4Index = migrations.indexOf("supabase/scorecaster_event_identity_normalization_v4.sql");
  const chronologyFix = migrations.indexOf("supabase/scorecaster_outcome_chronology_fix_v1.sql");

  assert.equal(migrations.length, 48);
  assert.equal(v3Index, fixtureMap + 1);
  assert.equal(v4Index, v3Index + 1);
  assert.equal(chronologyFix, v4Index + 1);
});
