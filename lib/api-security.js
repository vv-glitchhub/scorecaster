import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "./supabase/server";
import { getSupabaseConfig } from "./supabase/config";
import { getSupabaseAdmin } from "./supabase-admin";
import {
  boundedNumber,
  cleanText,
  finiteNumber,
  getBearerToken,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  readJsonBody
} from "./api-security-core.mjs";

export {
  boundedNumber,
  cleanText,
  finiteNumber,
  getBearerToken,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  readJsonBody
};

const RATE_BUCKET_PATTERN = /^[a-z0-9:_-]{1,80}$/;

function createBearerClient(token) {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;

  return createSupabaseClient(config.url, config.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

export async function getAuthenticatedContext(request) {
  if (!getSupabaseConfig().isConfigured) {
    return { ok: false, status: 503, error: "Authentication service is not configured" };
  }

  const bearerToken = getBearerToken(request);
  const supabase = bearerToken
    ? createBearerClient(bearerToken)
    : await createServerClient();

  if (!supabase) {
    return { ok: false, status: 503, error: "Authentication service is not configured" };
  }

  const {
    data: { user },
    error
  } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false, status: 401, error: "Authentication required" };
  }

  return {
    ok: true,
    supabase,
    user,
    authMode: bearerToken ? "bearer" : "cookie"
  };
}

export async function enforceRateLimit(auth, requestId, {
  bucket,
  limit,
  windowSeconds
}) {
  if (!auth?.ok || !auth?.user?.id || !RATE_BUCKET_PATTERN.test(bucket)) {
    return jsonResponse({ ok: false, error: "Invalid rate-limit context" }, 500, requestId);
  }

  const safeLimit = Math.min(1000, Math.max(1, Math.trunc(Number(limit) || 0)));
  const safeWindow = Math.min(86400, Math.max(1, Math.trunc(Number(windowSeconds) || 0)));
  const admin = getSupabaseAdmin();

  if (!admin) {
    return jsonResponse(
      { ok: false, error: "Security rate limiter is unavailable" },
      503,
      requestId
    );
  }

  const { data, error } = await admin.rpc("consume_api_quota_for_user", {
    p_user_id: auth.user.id,
    p_bucket: bucket,
    p_limit: safeLimit,
    p_window_seconds: safeWindow
  });

  if (error) {
    return jsonResponse(
      {
        ok: false,
        error: "Security rate limiter is unavailable",
        hint: process.env.NODE_ENV === "production"
          ? undefined
          : "Run supabase/scorecaster_api_rate_limits.sql"
      },
      503,
      requestId
    );
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.allowed) {
    const retryAfter = Math.max(1, Number(result?.retryAfter || result?.retry_after || safeWindow));
    return jsonResponse(
      { ok: false, error: "Too many requests", retryAfter },
      429,
      requestId,
      { "Retry-After": String(retryAfter) }
    );
  }

  return null;
}

export function publicError(error, fallback = "Request failed") {
  if (process.env.NODE_ENV !== "production" && error?.message) {
    return `${fallback}: ${error.message}`;
  }
  return fallback;
}
