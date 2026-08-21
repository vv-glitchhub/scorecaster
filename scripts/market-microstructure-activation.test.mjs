import test from "node:test";
import assert from "node:assert/strict";
import {
  MARKET_MICROSTRUCTURE_REPOSITORY_DEFAULT,
  resolveMarketMicrostructureActivation
} from "../lib/market-microstructure-activation.mjs";

test("market capture is repository-enabled only in production when no override exists", () => {
  assert.equal(MARKET_MICROSTRUCTURE_REPOSITORY_DEFAULT, true);
  const production = resolveMarketMicrostructureActivation({ NODE_ENV: "production" });
  assert.equal(production.enabled, true);
  assert.equal(production.mode, "repository-production-enabled");

  const development = resolveMarketMicrostructureActivation({ NODE_ENV: "development" });
  assert.equal(development.enabled, false);
  assert.equal(development.mode, "nonproduction-default-disabled");
});

test("explicit false is an emergency stop and explicit true remains supported", () => {
  const stopped = resolveMarketMicrostructureActivation({ NODE_ENV: "production", MARKET_MICROSTRUCTURE_ENABLED: "false" });
  assert.equal(stopped.enabled, false);
  assert.equal(stopped.mode, "explicit-disabled");
  assert.equal(stopped.emergencyStopAvailable, true);

  const enabled = resolveMarketMicrostructureActivation({ NODE_ENV: "development", MARKET_MICROSTRUCTURE_ENABLED: "true" });
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.mode, "explicit-enabled");
});

test("unknown activation values fail closed", () => {
  const result = resolveMarketMicrostructureActivation({ NODE_ENV: "production", MARKET_MICROSTRUCTURE_ENABLED: "maybe" });
  assert.equal(result.enabled, false);
  assert.equal(result.mode, "invalid-value-disabled");
});
