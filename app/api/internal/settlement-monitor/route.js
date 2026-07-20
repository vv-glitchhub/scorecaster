import { getSupabaseAdminClient } from "../../../../lib/supabase";
import { settlementMonitorAuthorizationValid, settlementMonitorConfiguration } from "../../../../lib/settlement-monitor-config.js";
import { runSettlementMonitor } from "../../../../lib/settlement-monitor.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(payload, status) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

export async function GET(request) {
  const config = settlementMonitorConfiguration();
  if (!config.cronSecretConfigured) return json({ ok: false, error: "Settlement Monitor secret is not configured" }, 503);
  if (!settlementMonitorAuthorizationValid(request)) return json({ ok: false, error: "Unauthorized" }, 401);
  if (!config.enabledFlag) return json({ ok: false, error: "Settlement Monitor is disabled" }, 503);
  if (!config.adminConfigured) return json({ ok: false, error: "Settlement Monitor database access is not configured" }, 503);
  if (!config.scoresProviderConfigured) return json({ ok: false, error: "Settlement Monitor scores provider is not configured" }, 503);

  const admin = getSupabaseAdminClient();
  if (!admin) return json({ ok: false, error: "Settlement Monitor admin client is unavailable" }, 503);

  try {
    return json(await runSettlementMonitor({ admin }), 200);
  } catch (error) {
    return json({ ok: false, error: process.env.NODE_ENV === "production" ? "Settlement Monitor cycle failed" : String(error?.message || error) }, 500);
  }
}
