import { getSupabaseAdminClient } from "../../../../lib/supabase";
import {
  autonomousAgentAuthorizationValid,
  autonomousAgentConfiguration
} from "../../../../lib/autonomous-agent-config.js";
import { runAutonomousScorecasterV12 } from "../../../../lib/autonomous-scorecaster-v12-worker.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function response(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function GET(request) {
  const config = autonomousAgentConfiguration();
  if (!config.cronSecretConfigured) return response({ ok: false, error: "Autonomous V12 secret is not configured" }, 503);
  if (!autonomousAgentAuthorizationValid(request)) return response({ ok: false, error: "Unauthorized" }, 401);
  if (!config.enabledFlag) return response({ ok: false, error: "Autonomous V12 is disabled" }, 503);
  if (!config.adminConfigured) return response({ ok: false, error: "Autonomous V12 database access is not configured" }, 503);
  if (!config.oddsProviderConfigured) return response({ ok: false, error: "Autonomous V12 market provider is not configured" }, 503);

  const admin = getSupabaseAdminClient();
  if (!admin) return response({ ok: false, error: "Autonomous V12 admin client is unavailable" }, 503);

  try {
    const result = await runAutonomousScorecasterV12({
      admin,
      origin: new URL(request.url).origin,
      now: new Date()
    });
    return response(result, 200);
  } catch (error) {
    return response({
      ok: false,
      paperOnly: true,
      realMoneyBetting: false,
      error: process.env.NODE_ENV === "production"
        ? "Autonomous Scorecaster V12 cycle failed"
        : String(error?.message || error)
    }, 500);
  }
}
