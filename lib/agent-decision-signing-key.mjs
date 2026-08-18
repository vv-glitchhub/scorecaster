import { getSupabaseAdmin } from "./supabase-admin.js";

export const AGENT_DECISION_SIGNING_VAULT_RPC = "scorecaster_agent_decision_signing_key";
export const AGENT_DECISION_SIGNING_MINIMUM_LENGTH = 32;
export const AGENT_DECISION_SIGNING_CACHE_MS = 5 * 60 * 1000;

let cachedVaultKey = null;
let cachedVaultKeyAt = 0;
let inFlightVaultLoad = null;

function validKey(value) {
  const key = typeof value === "string" ? value.trim() : "";
  return key.length >= AGENT_DECISION_SIGNING_MINIMUM_LENGTH ? key : null;
}

async function fetchVaultKey(admin) {
  if (!admin?.rpc) return null;
  try {
    const { data, error } = await admin.rpc(AGENT_DECISION_SIGNING_VAULT_RPC);
    if (error) return null;
    return validKey(data);
  } catch {
    return null;
  }
}

export async function resolveAgentDecisionSigningKey({
  envKey = process.env.AGENT_DECISION_SIGNING_KEY,
  admin = undefined,
  now = Date.now(),
  useCache = true
} = {}) {
  const environmentKey = validKey(envKey);
  if (environmentKey) {
    return { configured: true, key: environmentKey, source: "environment" };
  }

  if (useCache && cachedVaultKey && now - cachedVaultKeyAt < AGENT_DECISION_SIGNING_CACHE_MS) {
    return { configured: true, key: cachedVaultKey, source: "supabase-vault" };
  }

  const client = admin === undefined ? getSupabaseAdmin() : admin;
  if (!client) return { configured: false, key: null, source: "unconfigured" };

  if (!inFlightVaultLoad || !useCache) {
    inFlightVaultLoad = fetchVaultKey(client).finally(() => {
      if (!useCache) inFlightVaultLoad = null;
    });
  }

  const vaultKey = await inFlightVaultLoad;
  if (useCache) inFlightVaultLoad = null;
  if (!vaultKey) return { configured: false, key: null, source: "unconfigured" };

  if (useCache) {
    cachedVaultKey = vaultKey;
    cachedVaultKeyAt = now;
  }
  return { configured: true, key: vaultKey, source: "supabase-vault" };
}

export async function agentDecisionSigningReadiness(options = {}) {
  const resolved = await resolveAgentDecisionSigningKey(options);
  return {
    configured: resolved.configured,
    source: resolved.source,
    secretValueIncluded: false
  };
}

export function clearAgentDecisionSigningKeyCacheForTests() {
  cachedVaultKey = null;
  cachedVaultKeyAt = 0;
  inFlightVaultLoad = null;
}
