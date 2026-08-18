import { hydrateAgentDecisionSigningEnvironment } from "./lib/agent-decision-signing-key.mjs";

export async function registerNodeRuntimeSecrets(options = {}) {
  const result = await hydrateAgentDecisionSigningEnvironment(options);
  if (!result.configured && process.env.NODE_ENV === "production") {
    console.warn("[scorecaster] Agent decision signing key is not configured; enhanced explanations remain fail-closed.");
  }
  return result;
}
