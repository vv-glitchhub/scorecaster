import { getSupabaseAdminClient } from "../../../../lib/supabase";
import {
  shadowLearningAuthorizationValid,
  shadowLearningConfiguration
} from "../../../../lib/shadow-learning-config.js";
import { runShadowLearningWorker } from "../../../../lib/shadow-learning-worker.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(payload, status) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

export async function GET(request) {
  const config = shadowLearningConfiguration();
  if (!config.cronSecretConfigured) return json({ ok: false, error: "Shadow Learning secret is not configured" }, 503);
  if (!shadowLearningAuthorizationValid(request)) return json({ ok: false, error: "Unauthorized" }, 401);
  if (!config.enabledFlag) return json({ ok: false, error: "Shadow Learning is disabled" }, 503);
  if (!config.adminConfigured) return json({ ok: false, error: "Shadow Learning database access is not configured" }, 503);

  const admin = getSupabaseAdminClient();
  if (!admin) return json({ ok: false, error: "Shadow Learning admin client is unavailable" }, 503);

  try {
    return json(await runShadowLearningWorker({ admin }), 200);
  } catch (error) {
    return json({
      ok: false,
      error: process.env.NODE_ENV === "production"
        ? "Shadow Learning cycle failed"
        : String(error?.message || error)
    }, 500);
  }
}
