import assert from "node:assert/strict";

const original = {
  key: process.env.VEIKKAUS_ODDS_API_IO_KEY,
  enabled: process.env.VEIKKAUS_ODDS_ENABLED,
  commercial: process.env.VEIKKAUS_ODDS_COMMERCIAL_ALLOWED,
  vercelEnv: process.env.VERCEL_ENV,
  nodeEnv: process.env.NODE_ENV
};

function restore(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

try {
  delete process.env.VEIKKAUS_ODDS_API_IO_KEY;
  delete process.env.VEIKKAUS_ODDS_ENABLED;
  delete process.env.VEIKKAUS_ODDS_COMMERCIAL_ALLOWED;
  process.env.VERCEL_ENV = "production";

  const { GET } = await import("../app/api/veikkaus-status/route.js");

  const missingResponse = await GET();
  assert.equal(missingResponse.status, 200);
  assert.equal(missingResponse.headers.get("cache-control"), "no-store");
  const missing = await missingResponse.json();
  assert.equal(missing.mode, "not-configured");
  assert.equal(missing.active, false);
  assert.equal(missing.paperOnly, true);
  assert.equal(missing.realMoneyBetting, false);
  assert.equal(missing.capabilities.bookmakerLogin, false);
  assert.equal(missing.capabilities.betslipSubmission, false);
  assert.equal(missing.capabilities.realMoneyExecution, false);
  assert.equal("apiKey" in missing, false);

  process.env.VEIKKAUS_ODDS_API_IO_KEY = "must-never-leak";
  process.env.VEIKKAUS_ODDS_ENABLED = "true";
  delete process.env.VEIKKAUS_ODDS_COMMERCIAL_ALLOWED;

  const rightsResponse = await GET();
  const rights = await rightsResponse.json();
  assert.equal(rights.configured, true);
  assert.equal(rights.enabled, true);
  assert.equal(rights.mode, "rights-unverified");
  assert.equal(rights.active, false);
  assert.equal(JSON.stringify(rights).includes("must-never-leak"), false);

  process.env.VEIKKAUS_ODDS_COMMERCIAL_ALLOWED = "true";
  const readyResponse = await GET();
  const ready = await readyResponse.json();
  assert.equal(ready.mode, "ready");
  assert.equal(ready.active, true);
  assert.equal(ready.rightsSatisfied, true);
  assert.equal(ready.commercialUseAllowed, true);
  assert.equal(JSON.stringify(ready).includes("must-never-leak"), false);

  console.log("Veikkaus status regression tests passed");
} finally {
  restore("VEIKKAUS_ODDS_API_IO_KEY", original.key);
  restore("VEIKKAUS_ODDS_ENABLED", original.enabled);
  restore("VEIKKAUS_ODDS_COMMERCIAL_ALLOWED", original.commercial);
  restore("VERCEL_ENV", original.vercelEnv);
  restore("NODE_ENV", original.nodeEnv);
}
