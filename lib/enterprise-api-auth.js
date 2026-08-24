import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "./supabase-admin";

const KEY_PATTERN = /^sc_(?:live|test)_[A-Za-z0-9_-]{24,128}$/;

function bearer(request) {
  const value = String(request.headers.get("authorization") || "").trim();
  if (!value.toLowerCase().startsWith("bearer ")) return null;
  const key = value.slice(7).trim();
  return KEY_PATTERN.test(key) ? key : null;
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function scopeAllowed(required, keyScopes = [], tenantScopes = []) {
  return keyScopes.includes(required) && tenantScopes.includes(required);
}

export async function authenticateEnterpriseApi(request, requiredScope) {
  const rawKey = bearer(request);
  if (!rawKey) return { ok: false, status: 401, error: "Valid Enterprise API bearer key required" };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, status: 503, error: "Enterprise API database is not configured" };

  const hash = sha256(rawKey);
  const { data: keyRow, error: keyError } = await admin
    .from("scorecaster_enterprise_api_keys")
    .select("id,tenant_id,key_prefix,label,scopes,active,expires_at,revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (keyError) return { ok: false, status: 503, error: "Enterprise API credential registry unavailable" };
  if (!keyRow || keyRow.active !== true || keyRow.revoked_at) return { ok: false, status: 401, error: "Enterprise API key is invalid or revoked" };
  if (keyRow.expires_at && Date.parse(keyRow.expires_at) <= Date.now()) return { ok: false, status: 401, error: "Enterprise API key has expired" };

  const { data: tenant, error: tenantError } = await admin
    .from("scorecaster_enterprise_api_tenants")
    .select("id,slug,name,status,allowed_scopes,rate_limit_per_minute")
    .eq("id", keyRow.tenant_id)
    .maybeSingle();
  if (tenantError) return { ok: false, status: 503, error: "Enterprise API tenant registry unavailable" };
  if (!tenant || tenant.status !== "active") return { ok: false, status: 403, error: "Enterprise API tenant is not active" };
  if (!scopeAllowed(requiredScope, keyRow.scopes || [], tenant.allowed_scopes || [])) return { ok: false, status: 403, error: "Enterprise API scope is not allowed" };

  const { data: quotaRows, error: quotaError } = await admin.rpc("consume_scorecaster_enterprise_api_quota", {
    p_tenant_id: tenant.id,
    p_limit: tenant.rate_limit_per_minute
  });
  if (quotaError) return { ok: false, status: 503, error: "Enterprise API quota service unavailable" };
  const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
  if (quota?.allowed !== true) return {
    ok: false,
    status: 429,
    error: "Enterprise API rate limit exceeded",
    rateLimit: { limit: Number(quota?.limit_per_minute || tenant.rate_limit_per_minute), remaining: 0 }
  };

  void admin.from("scorecaster_enterprise_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
  return {
    ok: true,
    admin,
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    key: { id: keyRow.id, prefix: keyRow.key_prefix, label: keyRow.label },
    rateLimit: {
      limit: Number(quota?.limit_per_minute || tenant.rate_limit_per_minute),
      remaining: Math.max(0, Number(quota?.limit_per_minute || tenant.rate_limit_per_minute) - Number(quota?.request_count || 0))
    }
  };
}

export function enterpriseApiHeaders(auth) {
  return {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Scorecaster-Data-Boundary": "derived-analysis-only",
    ...(auth?.rateLimit ? {
      "X-RateLimit-Limit": String(auth.rateLimit.limit),
      "X-RateLimit-Remaining": String(auth.rateLimit.remaining)
    } : {})
  };
}

export function enterpriseRecommendationView(item = {}) {
  return {
    id: item.id || null,
    eventId: item.eventId || null,
    match: item.match || null,
    sportKey: item.sportKey || null,
    league: item.league || item.sportTitle || null,
    commenceTime: item.commenceTime || null,
    selection: item.selection || null,
    marketKey: item.marketKey || null,
    decision: item.decision || "CAUTION",
    score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
    edge: Number.isFinite(Number(item.edge)) ? Number(item.edge) : null,
    ev: Number.isFinite(Number(item.ev)) ? Number(item.ev) : null,
    confidence: Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : null,
    trustScore: Number.isFinite(Number(item.trustScore)) ? Number(item.trustScore) : null,
    bookmakerCount: Number.isFinite(Number(item.bookmakerCount)) ? Number(item.bookmakerCount) : null,
    freshness: item.freshness || null,
    readiness: item.readiness || null,
    nextGate: item.nextGate || null,
    nearPlay: item.intelligenceV2?.nearPlay === true,
    visibleGateSummary: item.intelligenceV2?.visibleGateSummary || null,
    scoreDecomposition: item.intelligenceV2?.scoreDecomposition || null,
    paperOnly: true,
    realMoneyActionAvailable: false
  };
}
