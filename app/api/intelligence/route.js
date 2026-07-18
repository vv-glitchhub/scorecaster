import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  readJsonBody
} from "../../../lib/api-security";
import { loadSportsIntelligence } from "../../../lib/sports-intelligence-service";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const requestId = getRequestId(request);

  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }

  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  }

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "sports_intelligence",
    limit: 20,
    windowSeconds: 300
  });
  if (limited) return limited;

  const parsed = await readJsonBody(request, 8192);
  if (!parsed.ok) {
    return jsonResponse({ ok: false, error: parsed.error }, parsed.status, requestId);
  }

  const result = await loadSportsIntelligence(parsed.data);
  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.error || "Invalid match input" }, 400, requestId);
  }

  return jsonResponse(result, 200, requestId);
}
