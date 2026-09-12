import test from "node:test";
import assert from "node:assert/strict";
import { priorityScore, sanitizeTelemetry } from "../lib/caster-intelligence.js";

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
