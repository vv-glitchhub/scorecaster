import { createHash } from "node:crypto";
import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  readJsonBody
} from "../../../../lib/api-security";
import { verifyAgentDecisionTicket } from "../../../../lib/agent-decision-ticket.mjs";
import {
  AGENT_EXPLANATION_JSON_SCHEMA,
  buildDeterministicAgentExplanation,
  canonicalAgentExplanationInput,
  sanitizeAgentExplanationInput,
  validateGeneratedAgentExplanation
} from "../../../../lib/agent-v10-explanation.mjs";

export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";
const REQUEST_TIMEOUT_MS = 18000;

function decisionHash(contract) {
  return createHash("sha256")
    .update(canonicalAgentExplanationInput(contract))
    .digest("hex")
    .slice(0, 24);
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return "";
}

function fallbackResponse(contract, requestId, reason, status = 200) {
  return jsonResponse(
    {
      ok: true,
      enhanced: false,
      decisionHash: decisionHash(contract),
      generatedAt: new Date().toISOString(),
      model: "deterministic",
      reason,
      explanation: buildDeterministicAgentExplanation(contract)
    },
    status,
    requestId,
    { "X-Scorecaster-AI-Mode": "deterministic-fallback" }
  );
}

function systemInstruction() {
  return [
    "You are Scorecaster Agent V10's grounded Finnish explanation layer.",
    "The deterministic decision object is the sole source of truth.",
    "Never change or dispute its decision, probability, edge, EV, stake, price guard or portfolio allocation.",
    "Write only a qualitative summary and limitation without digits or new facts.",
    "For strongestEvidenceIndex, counterArgumentIndex and nextCheckIndexes, select only valid indexes from the supplied arrays.",
    "The server, not you, will render the actual evidence, counterargument and verification text from those indexes.",
    "Do not invent news, injuries, lineups, weather, motivation, form or private information.",
    "Do not instruct the user to place a real-money bet and do not promise profit.",
    "Write concise, calm Finnish. Return only the required JSON object."
  ].join(" ");
}

async function generateGroundedExplanation(contract) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, reason: "OpenAI explanation service is not configured" };

  const model = String(process.env.OPENAI_AGENT_MODEL || DEFAULT_MODEL).trim().slice(0, 100) || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: 700,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemInstruction() }]
          },
          {
            role: "user",
            content: [{
              type: "input_text",
              text: `Explain this immutable decision contract without adding facts or changing metrics:\n${JSON.stringify(contract)}`
            }]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "scorecaster_agent_v10_explanation",
            description: "Grounded Finnish explanation that cannot alter the deterministic Scorecaster decision.",
            strict: true,
            schema: AGENT_EXPLANATION_JSON_SCHEMA
          }
        }
      })
    });

    if (!response.ok) {
      return { ok: false, reason: `Explanation provider returned ${response.status}` };
    }

    const payload = await response.json();
    const raw = extractOutputText(payload);
    if (!raw) return { ok: false, reason: "Explanation provider returned no text" };

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, reason: "Explanation provider returned invalid JSON" };
    }

    const explanation = validateGeneratedAgentExplanation(parsed, contract);
    if (!explanation) {
      return { ok: false, reason: "Generated explanation failed grounding validation" };
    }

    return {
      ok: true,
      model,
      responseId: typeof payload?.id === "string" ? payload.id.slice(0, 120) : null,
      explanation
    };
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === "AbortError"
        ? "Explanation provider timed out"
        : "Explanation provider request failed"
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }

  const body = await readJsonBody(request, 40 * 1024);
  if (!body.ok) {
    return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  }

  const clientContract = sanitizeAgentExplanationInput(body.data);
  const auth = await getAuthenticatedContext(request);

  if (!auth.ok) {
    if (!clientContract) {
      return jsonResponse({ ok: false, error: "Invalid Agent V10 decision contract" }, 400, requestId);
    }
    return fallbackResponse(
      clientContract,
      requestId,
      "Sign in to use a server-authoritative Agent decision and optional enhanced explanation"
    );
  }

  const verified = verifyAgentDecisionTicket(body.data?.ticket);
  if (!verified.ok) {
    if (!clientContract) {
      return jsonResponse({ ok: false, error: verified.error }, 400, requestId);
    }
    return fallbackResponse(
      clientContract,
      requestId,
      "Enhanced explanation requires a current server-signed Agent decision"
    );
  }

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "agent_v10_explanation",
    limit: 12,
    windowSeconds: 3600
  });
  if (limited) return limited;

  const contract = verified.contract;
  const generated = await generateGroundedExplanation(contract);
  if (!generated.ok) {
    return fallbackResponse(contract, requestId, generated.reason);
  }

  return jsonResponse(
    {
      ok: true,
      enhanced: true,
      authoritative: true,
      decisionHash: decisionHash(contract),
      ticketExpiresAt: new Date(verified.expiresAt).toISOString(),
      generatedAt: new Date().toISOString(),
      model: generated.model,
      responseId: generated.responseId,
      explanation: generated.explanation
    },
    200,
    requestId,
    { "X-Scorecaster-AI-Mode": "grounded-language-model" }
  );
}
