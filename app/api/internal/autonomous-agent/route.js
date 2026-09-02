import { getSupabaseAdminClient } from "../../../../lib/supabase";
import {
  autonomousAgentAuthorizationValid,
  autonomousAgentConfiguration
} from "../../../../lib/autonomous-agent-config.js";
import { runAutonomousScorecasterV12 } from "../../../../lib/autonomous-scorecaster-v12-runner.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(payload, status) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

export async function GET(request) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id") || crypto.randomUUID();
  const config = autonomousAgentConfiguration();
  if (!config.cronSecretConfigured) return json({ ok: false, error: "Autonomous Agent secret is not configured" }, 503);
  if (!autonomousAgentAuthorizationValid(request)) return json({ ok: false, error: "Unauthorized" }, 401);
  if (!config.enabledFlag) return json({ ok: false, error: "Autonomous Agent is disabled" }, 503);
  if (!config.adminConfigured) return json({ ok: false, error: "Autonomous Agent database access is not configured" }, 503);
  if (!config.oddsProviderConfigured) return json({ ok: false, error: "Autonomous Agent market provider is not configured" }, 503);

  const admin = getSupabaseAdminClient();
  if (!admin) return json({ ok: false, error: "Autonomous Agent admin client is unavailable" }, 503);

  console.info("[autonomous-agent] cycle started", { requestId });
  try {
    const result = await runAutonomousScorecasterV12({ admin, origin: new URL(request.url).origin });
    console.info("[autonomous-agent] cycle completed", {
      requestId,
      durationMs: Date.now() - startedAt,
      processedUsers: result.processedUsers,
      savedPaperPicks: result.savedPaperPicks,
      failedSourceGroups: result.failedSourceGroups
    });
    return json(result, 200);
  } catch (error) {
    console.error("[autonomous-agent] cycle failed", {
      requestId,
      durationMs: Date.now() - startedAt,
      name: String(error?.name || "Error"),
      message: String(error?.message || error).slice(0, 300)
    });
    return json({
      ok: false,
      error: process.env.NODE_ENV === "production"
        ? "Autonomous Scorecaster V12 cycle failed"
        : String(error?.message || error)
    }, 500);
  }
}
