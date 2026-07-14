import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "./supabase/server";
import { getSupabaseConfig } from "./supabase/config";

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;
const RATE_BUCKET_PATTERN = /^[a-z0-9:_-]{1,80}$/;

export function jsonResponse(data, status = 200, requestId = null, extraHeaders = {}) {
  return Response.json(
    requestId ? { ...data, requestId } : data,
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        ...extraHeaders
      }
    }
  );
}

export function getRequestId(request) {
  const supplied = request?.headers?.get("x-request-id") || "";
  if (REQUEST_ID_PATTERN.test(supplied)) return supplied;
  return crypto.randomUUID();
}

export function getBearerToken(request) {
  const authorization = request?.headers?.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length >= 20 && token.length <= 8192 ? token : null;
}

export function mutationOriginAllowed(request) {
  if (getBearerToken(request)) return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readJsonBody(request, maxBytes = DEFAULT_MAX_BODY_BYTES) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, status: 415, error: "Content-Type must be application/json" };
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, status: 413, error: "Request body is too large" };
  }

  let text;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400, error: "Unable to read request body" };
  }

  if (new TextEncoder().encode(text).length > maxBytes) {
    return { ok: false, status: 413, error: "Request body is too large" };
  }

  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body" };
  }
}

export function cleanText(value, maxLength, fallback = "") {
  const text = String(value ?? fallback)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, maxLength);
}

export function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function boundedNumber(value, { min, max, fallback = null }) {
  const number = finiteNumber(value, fallback);
  if (number === null || number < min || number > max) return fallback;
  return number;
}

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
  if (!auth?.ok || !RATE_BUCKET_PATTERN.test(bucket)) {
    return jsonResponse({ ok: false, error: "Invalid rate-limit context" }, 500, requestId);
  }

  const safeLimit = Math.min(1000, Math.max(1, Math.trunc(Number(limit) || 0)));
  const safeWindow = Math.min(86400, Math.max(1, Math.trunc(Number(windowSeconds) || 0)));

  const { data, error } = await auth.supabase.rpc("consume_api_quota", {
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
