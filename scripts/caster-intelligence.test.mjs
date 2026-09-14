import test from "node:test";
import assert from "node:assert/strict";
import { isTelemetryOriginAllowed, priorityScore, sanitizeTelemetry } from "../lib/caster-intelligence.js";

test("telemetry rejects cross-site and unknown origins while allowing trusted fetch sites", () => {
  assert.equal(isTelemetryOriginAllowed("cross-site"), false);
  assert.equal(isTelemetryOriginAllowed("same-origin"), true);
  assert.equal(isTelemetryOriginAllowed("same-site"), true);
  assert.equal(isTelemetryOriginAllowed("none"), true);
  assert.equal(isTelemetryOriginAllowed(null), true);
  assert.equal(isTelemetryOriginAllowed("unexpected"), false);
});

test("Caster Intelligence strips sensitive telemetry keys", () => {
  const clean = sanitizeTelemetry({ route: "/today", email: "private@example.com", nested: { token: "secret", status: "error" } });
  assert.equal(clean.email, undefined);
  assert.equal(clean.nested.token, undefined);
  assert.equal(clean.nested.status, "error");
});

test("GREEN candidates outrank equal YELLOW and RED candidates", () => {
  const input = { impact: 4, confidence: 0.8, urgency: 4 };
  assert.ok(priorityScore({ ...input, risk: "GREEN" }) > priorityScore({ ...input, risk: "YELLOW" }));
  assert.ok(priorityScore({ ...input, risk: "YELLOW" }) > priorityScore({ ...input, risk: "RED" }));
});
