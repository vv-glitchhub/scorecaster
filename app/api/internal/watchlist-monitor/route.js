import { runAutoWatchRecommendationSync } from "../../../../lib/auto-watch-recommendation-service.js";
import { getSupabaseAdminClient } from "../../../../lib/supabase";
import {
  watchlistMonitorAuthorizationValid,
  watchlistMonitorConfiguration
} from "../../../../lib/watchlist-monitor-config";
import { runWatchlistMonitor } from "../../../../lib/watchlist-monitor";

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

function safeWorkerError(error, fallback) {
  return process.env.NODE_ENV === "production" ? fallback : String(error);
}

export async function GET(request) {
  const configuration = watchlistMonitorConfiguration();
  if (!configuration.cronSecretConfigured) {
    return response({ ok: false, error: "Watchlist Monitor cron secret is not configured" }, 503);
  }
  if (!watchlistMonitorAuthorizationValid(request)) {
    return response({ ok: false, error: "Unauthorized" }, 401);
  }
  if (!configuration.monitorActive) {
    return response({ ok: false, error: "Watchlist Monitor is disabled", configuration }, 503);
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);

  const origin = new URL(request.url).origin;
  let autoWatch;
  try {
    autoWatch = await runAutoWatchRecommendationSync({ admin, origin });
  } catch (error) {
    autoWatch = {
      ok: false,
      available: true,
      error: safeWorkerError(error, "Auto-Watch recommendation sync failed")
    };
  }

  try {
    const result = await runWatchlistMonitor({ admin, origin });
    const ok = result.ok === true && autoWatch.ok === true;
    return response({ ok, configuration, autoWatch, result }, ok ? 200 : 207);
  } catch (error) {
    return response({
      ok: false,
      autoWatch,
      error: safeWorkerError(error, "Watchlist Monitor failed")
    }, 500);
  }
}