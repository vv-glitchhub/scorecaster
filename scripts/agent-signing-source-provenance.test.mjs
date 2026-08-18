import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_DECISION_SIGNING_VAULT_RPC,
  agentDecisionSigningReadiness,
  clearAgentDecisionSigningKeyCacheForTests,
  hydrateAgentDecisionSigningEnvironment,
  resolveAgentDecisionSigningKey
} from "../lib/agent-decision-signing-key.mjs";

const envKey = "explicit-environment-agent-signing-key-for-ci-0123456789abcdef";
const vaultKey = "vault-hydrated-agent-signing-key-for-ci-0123456789abcdef";

function fakeAdmin() {
  return {
    rpc: async (name) => {
      assert.equal(name, AGENT_DECISION_SIGNING_VAULT_RPC);
      return { data: vaultKey, error: null };
    }
  };
}

function snapshotEnvironment() {
  return {
    key: process.env.AGENT_DECISION_SIGNING_KEY,
    source: process.env.AGENT_DECISION_SIGNING_KEY_SOURCE
  };
}

function restoreEnvironment(previous) {
  if (previous.key === undefined) delete process.env.AGENT_DECISION_SIGNING_KEY;
  else process.env.AGENT_DECISION_SIGNING_KEY = previous.key;
  if (previous.source === undefined) delete process.env.AGENT_DECISION_SIGNING_KEY_SOURCE;
  else process.env.AGENT_DECISION_SIGNING_KEY_SOURCE = previous.source;
  clearAgentDecisionSigningKeyCacheForTests();
}

test("Vault hydration keeps supabase-vault provenance on later request-scoped readiness checks", async () => {
  const previous = snapshotEnvironment();
  delete process.env.AGENT_DECISION_SIGNING_KEY;
  delete process.env.AGENT_DECISION_SIGNING_KEY_SOURCE;
  clearAgentDecisionSigningKeyCacheForTests();
  try {
    const hydrated = await hydrateAgentDecisionSigningEnvironment({ admin: fakeAdmin(), useCache: false });
    assert.deepEqual(hydrated, {
      configured: true,
      source: "supabase-vault",
      secretValueIncluded: false
    });
    assert.equal(process.env.AGENT_DECISION_SIGNING_KEY, vaultKey);
    assert.equal(process.env.AGENT_DECISION_SIGNING_KEY_SOURCE, "supabase-vault");

    const readiness = await agentDecisionSigningReadiness({ admin: null });
    assert.deepEqual(readiness, {
      configured: true,
      source: "supabase-vault",
      secretValueIncluded: false
    });
    assert.doesNotMatch(JSON.stringify(readiness), new RegExp(vaultKey));
  } finally {
    restoreEnvironment(previous);
  }
});

test("an explicitly supplied key is still reported as environment by default", async () => {
  const previous = snapshotEnvironment();
  process.env.AGENT_DECISION_SIGNING_KEY_SOURCE = "supabase-vault";
  try {
    const resolved = await resolveAgentDecisionSigningKey({ envKey, admin: fakeAdmin(), useCache: false });
    assert.equal(resolved.configured, true);
    assert.equal(resolved.key, envKey);
    assert.equal(resolved.source, "environment");
  } finally {
    restoreEnvironment(previous);
  }
});

test("unknown source hints cannot escape the reviewed provenance allowlist", async () => {
  const previous = snapshotEnvironment();
  process.env.AGENT_DECISION_SIGNING_KEY = envKey;
  process.env.AGENT_DECISION_SIGNING_KEY_SOURCE = "client-or-unknown-source";
  try {
    const readiness = await agentDecisionSigningReadiness({ admin: null });
    assert.equal(readiness.configured, true);
    assert.equal(readiness.source, "environment");
    assert.equal(readiness.secretValueIncluded, false);
  } finally {
    restoreEnvironment(previous);
  }
});

test("explicit reviewed source can be preserved only when the caller explicitly supplies it", async () => {
  const resolved = await resolveAgentDecisionSigningKey({
    envKey: vaultKey,
    envSource: "supabase-vault",
    admin: null,
    useCache: false
  });
  assert.equal(resolved.configured, true);
  assert.equal(resolved.source, "supabase-vault");
});
