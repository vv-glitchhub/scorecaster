import { getSupabaseAdminClient } from "../../../../lib/supabase";
import {
  autonomousAgentAuthorizationValid,
  autonomousAgentConfiguration
} from "../../../../lib/autonomous-agent-config.js";
import { runAutonomousPaperAgent } from "../../../../lib/autonomous-paper-agent.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(payload, status) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

export async function GET(request) {
  const config = autonomousAgentConfiguration();
  if (!config.cronSecretConfigured) return json({ ok: false, error: "Autonomous Agent secret is not configured" }, 503);
  if (!autonomousAgentAuthorizationValid(request)) return json({ ok: false, error: "Unauthorized" }, 401);
  if (!config.enabledFlag) return json({ ok: false, error: "Autonomous Agent is disabled" }, 503);
  if (!config.adminConfigured) return json({ ok: false, error: "Autonomous Agent database access is not configured" }, 503);
  if (!config.oddsProviderConfigured) return json({ ok: false, error: "Autonomous Agent market provider is not configured" }, 503);

  const admin = getSupabaseAdminClient();
  if (!admin) return json({ ok: false, error: "Autonomous Agent admin client is unavailable" }, 503);

  try {
    return json(await runAutonomousPaperAgent({ admin, origin: new URL(request.url).origin }), 200);
  } catch (error) {
    return json({
      ok: false,
      error: process.env.NODE_ENV === "production"
        ? "Autonomous Paper Agent cycle failed"
        : String(error?.message || error)
    }, 500);
  }
}
