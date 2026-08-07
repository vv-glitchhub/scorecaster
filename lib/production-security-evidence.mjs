export const PRODUCTION_SECURITY_EVIDENCE_VERSION = "scorecaster-production-security-evidence-v1";

const clean = (value, maximum = 160) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

function present(env, name) {
  return clean(env?.[name], 4096).length > 0;
}

function entries(names, env) {
  return (Array.isArray(names) ? names : []).map((name) => ({
    name: clean(name, 100),
    present: present(env, name)
  }));
}

export function buildProductionSecurityEvidence({ policy = {}, env = process.env } = {}) {
  const publicVariables = entries(policy.publicClientVariables, env);
  const serverOnlyRequired = entries(policy.serverOnlyRequired, env);
  const serverOnlyConditional = entries(policy.serverOnlyConditional, env);
  const nonSecretServerConfiguration = entries(policy.serverOnlyNonSecretConfiguration, env);
  const prefixes = Array.isArray(policy.forbiddenClientPrefixes) ? policy.forbiddenClientPrefixes.map((item) => clean(item, 40)).filter(Boolean) : [];

  const forbiddenAliases = [];
  for (const item of [...serverOnlyRequired, ...serverOnlyConditional]) {
    for (const prefix of prefixes) {
      const alias = `${prefix}${item.name}`;
      if (present(env, alias)) forbiddenAliases.push(alias);
    }
  }

  const missingRequiredServerOnly = serverOnlyRequired.filter((item) => !item.present).map((item) => item.name);
  const missingPublicClient = publicVariables.filter((item) => !item.present).map((item) => item.name);
  const shadowLearningFlag = clean(env?.SCORECASTER_SHADOW_LEARNING_ENABLED, 16).toLowerCase();

  return {
    version: PRODUCTION_SECURITY_EVIDENCE_VERSION,
    product: clean(policy.product, 80) || "Scorecaster",
    policyVersion: Number.isInteger(Number(policy.version)) ? Number(policy.version) : null,
    generatedAt: new Date().toISOString(),
    publicVariables,
    serverOnlyRequired,
    serverOnlyConditional,
    nonSecretServerConfiguration,
    missingRequiredServerOnly,
    missingPublicClient,
    forbiddenClientAliases: forbiddenAliases,
    requiredConfigurationPresent: missingRequiredServerOnly.length === 0 && missingPublicClient.length === 0,
    serverOnlyBoundaryClean: forbiddenAliases.length === 0,
    shadowLearning: {
      configured: present(env, "SCORECASTER_SHADOW_LEARNING_ENABLED"),
      enabled: shadowLearningFlag === "true",
      rawValueIncluded: false
    },
    readyForProtectedWorkerProductionProbe: missingRequiredServerOnly.filter((name) => ["SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"].includes(name)).length === 0,
    safety: {
      secretValuesIncluded: false,
      authorizationHeadersIncluded: false,
      cookiesIncluded: false,
      userIdentifiersIncluded: false,
      bookmakerCredentialsIncluded: false,
      realMoneyExecution: false,
      paperOnly: true
    }
  };
}
