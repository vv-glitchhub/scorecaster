import { requestCasterAI } from './caster-ai-client.mjs';
import { validateGeneratedAgentExplanation } from './agent-v10-explanation.mjs';

// Called only after authentication, signed-contract verification and the existing rate limit.
export async function generateCasterExplanation(contract, language, options = {}) {
  const result = await requestCasterAI({ capability: 'scorecaster.explain', input: contract, language }, options);
  if (!result.ok) return result;
  const explanation = validateGeneratedAgentExplanation(result.output, contract, language);
  if (!explanation) return { ok: false, reason: 'caster_ai_grounding_rejected' };
  return { ok: true, explanation, model: result.model, modelVersion: result.modelVersion, responseId: result.responseId };
}
