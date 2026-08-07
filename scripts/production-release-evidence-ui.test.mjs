import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Production Evidence UI exposes the fail-closed release artifact without inventing missing metrics", async () => {
  const client = await source("app/production-evidence/ProductionEvidenceClient.jsx");
  assert.match(client, /format: "release"/);
  assert.match(client, /const releaseUrl = `\/api\/production-evidence\?\$\{releaseQuery\}`/);
  assert.match(client, />\s*Release JSON\s*</);
  assert.match(client, /Lataa release-evidenssi JSON/);
  assert.match(client, /Download release evidence JSON/);
  assert.match(client, /Descargar evidencia de release JSON/);
  assert.match(client, /Missing production proof remains unverified/);
  assert.match(client, /value !== null && value !== undefined && value !== ""/);
});
