import {
  notificationDeliveryAuthorizationValid,
  notificationDeliveryConfiguration
} from "../../../../lib/notification-delivery-config";
import { runNotificationDeliveryCycle } from "../../../../lib/notification-delivery";
import { getSupabaseAdminClient } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function response(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function GET(request) {
  const configuration = notificationDeliveryConfiguration();

  if (!configuration.cronSecretConfigured) {
    return response({ ok: false, error: "Notification delivery cron secret is not configured" }, 503);
  }
  if (!notificationDeliveryAuthorizationValid(request)) {
    return response({ ok: false, error: "Unauthorized" }, 401);
  }
  if (!configuration.enabledFlag) {
    return response({ ok: true, active: false, skipped: true, reason: "Notification delivery is disabled" });
  }
  if (!configuration.adminConfigured) {
    return response({ ok: false, active: false, error: "Notification delivery database access is not configured" }, 503);
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return response({ ok: false, active: false, error: "Notification delivery database access is unavailable" }, 503);

  try {
    const result = await runNotificationDeliveryCycle({ admin });
    return response({ ...result, active: true });
  } catch (error) {
    console.error("Notification delivery cycle failed", {
      message: error instanceof Error ? error.message : "Unknown delivery error"
    });
    return response({ ok: false, active: true, error: "Notification delivery cycle failed" }, 500);
  }
}
