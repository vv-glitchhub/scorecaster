import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  publicError
} from "../../../../lib/api-security";
import { buildFormRestShadowLab } from "../../../../lib/form-rest-shadow-lab.mjs";

export const dynamic = "force-dynamic";

const MAX_HISTORY = 1500;

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  }

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "form_rest_shadow_lab",
    limit: 30,
    windowSeconds: 300
  });
  if (limited) return limited;

  const { data, error } = await auth.supabase
    .from("bets")
    .select("id,status,result,created_at,updated_at,sport,league,raw_pick")
    .eq("user_id", auth.user.id)
    .neq("status", "open")
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY);

  if (error) {
    return jsonResponse(
      { ok: false, error: publicError(error, "Shadow model history could not be loaded") },
      500,
      requestId
    );
  }

  const report = buildFormRestShadowLab(data || []);
  return jsonResponse(
    {
      ok: true,
      source: "server-audited-paper-history",
      paperOnly: true,
      generatedAt: new Date().toISOString(),
      report
    },
    200,
    requestId
  );
}
