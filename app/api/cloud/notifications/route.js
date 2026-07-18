import {
  cleanText,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  publicError,
  readJsonBody
} from "../../../../lib/api-security";
import { notificationDeliveryConfiguration } from "../../../../lib/notification-delivery-config";

export const dynamic = "force-dynamic";

const TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{20,200}\]$/;
const DEFAULT_PREFERENCES = {
  in_app_enabled: true,
  push_enabled: false,
  high_enabled: true,
  medium_enabled: true,
  info_enabled: false,
  kickoff_enabled: true,
  decision_enabled: true,
  price_enabled: true
};
const CLIENT_PREFERENCE_KEYS = Object.keys(DEFAULT_PREFERENCES).filter((key) => key !== "push_enabled");
const DEVICE_SELECT = "id,platform,app_version,build_version,enabled,last_seen_at,created_at,updated_at";

function isMissingTable(error) {
  return error?.code === "42P01" || /does not exist|schema cache/i.test(error?.message || "");
}

function deliveryState() {
  const configuration = notificationDeliveryConfiguration();
  return {
    deliveryActive: configuration.deliveryActive,
    deliveryConfigured: configuration.adminConfigured && configuration.cronSecretConfigured,
    deliverySchedulingManagedExternally: configuration.schedulingManagedExternally
  };
}

async function loadState(auth) {
  const [preferencesResult, devicesResult] = await Promise.all([
    auth.supabase.from("notification_preferences").select("in_app_enabled,push_enabled,high_enabled,medium_enabled,info_enabled,kickoff_enabled,decision_enabled,price_enabled,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("notification_devices").select(DEVICE_SELECT).eq("user_id", auth.user.id).order("last_seen_at", { ascending: false }).limit(20)
  ]);
  const error = preferencesResult.error || devicesResult.error;
  if (error) {
    if (isMissingTable(error)) return { available: false, preferences: DEFAULT_PREFERENCES, devices: [], warning: "Notification registry migration is not active" };
    return { available: false, error };
  }
  return { available: true, preferences: { ...DEFAULT_PREFERENCES, ...(preferencesResult.data || {}) }, devices: devicesResult.data || [], warning: null };
}

async function requireMutation(request, requestId, bucket, limit = 30) {
  if (!mutationOriginAllowed(request)) return { response: jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId) };
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return { response: jsonResponse({ ok: false, error: auth.error }, auth.status, requestId) };
  const limited = await enforceRateLimit(auth, requestId, { bucket, limit, windowSeconds: 300 });
  if (limited) return { response: limited };
  return { auth };
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  const limited = await enforceRateLimit(auth, requestId, { bucket: "notification_registry_read", limit: 60, windowSeconds: 60 });
  if (limited) return limited;
  const state = await loadState(auth);
  if (state.error) return jsonResponse({ ok: false, error: publicError(state.error, "Notification settings could not be loaded") }, 500, requestId);
  return jsonResponse({ ok: true, paperOnly: true, ...deliveryState(), ...state }, 200, requestId);
}

export async function PUT(request) {
  const requestId = getRequestId(request);
  const guarded = await requireMutation(request, requestId, "notification_preferences_write", 30);
  if (guarded.response) return guarded.response;
  const auth = guarded.auth;
  const body = await readJsonBody(request, 4096);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  const supplied = Object.entries(body.data || {}).filter(([key]) => CLIENT_PREFERENCE_KEYS.includes(key));
  if (!supplied.length || supplied.some(([, value]) => typeof value !== "boolean")) return jsonResponse({ ok: false, error: "At least one valid boolean notification preference is required" }, 400, requestId);
  const { error } = await auth.supabase.from("notification_preferences").upsert({ user_id: auth.user.id, ...Object.fromEntries(supplied) }, { onConflict: "user_id" });
  if (error) return jsonResponse({ ok: false, error: publicError(error, "Notification preferences could not be saved") }, isMissingTable(error) ? 503 : 500, requestId);
  return jsonResponse({ ok: true, ...deliveryState(), ...await loadState(auth) }, 200, requestId);
}

export async function POST(request) {
  const requestId = getRequestId(request);
  const guarded = await requireMutation(request, requestId, "notification_device_register", 10);
  if (guarded.response) return guarded.response;
  const auth = guarded.auth;
  const body = await readJsonBody(request, 4096);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  const token = cleanText(body.data?.expoPushToken, 260);
  const platform = cleanText(body.data?.platform, 20).toLowerCase();
  const appVersion = cleanText(body.data?.appVersion, 40) || null;
  const buildVersion = cleanText(body.data?.buildVersion, 40) || null;
  if (!TOKEN_PATTERN.test(token) || !["ios", "android"].includes(platform)) return jsonResponse({ ok: false, error: "A valid Expo push token and supported platform are required" }, 400, requestId);
  const { data: deviceId, error: claimError } = await auth.supabase.rpc("claim_notification_device", { p_expo_push_token: token, p_platform: platform, p_app_version: appVersion, p_build_version: buildVersion });
  if (claimError) return jsonResponse({ ok: false, error: publicError(claimError, "Notification device could not be registered") }, isMissingTable(claimError) ? 503 : 500, requestId);
  const { error: preferenceError } = await auth.supabase.from("notification_preferences").upsert({ user_id: auth.user.id, push_enabled: true }, { onConflict: "user_id" });
  if (preferenceError) {
    await auth.supabase.from("notification_devices").delete().eq("user_id", auth.user.id).eq("id", deviceId);
    return jsonResponse({ ok: false, error: publicError(preferenceError, "Push preference could not be enabled") }, 500, requestId);
  }
  return jsonResponse({ ok: true, deviceId, ...deliveryState(), ...await loadState(auth) }, 200, requestId);
}

export async function DELETE(request) {
  const requestId = getRequestId(request);
  const guarded = await requireMutation(request, requestId, "notification_device_remove", 20);
  if (guarded.response) return guarded.response;
  const auth = guarded.auth;
  const body = await readJsonBody(request, 2048);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  const id = cleanText(body.data?.id, 80);
  if (!id) return jsonResponse({ ok: false, error: "Notification device ID is required" }, 400, requestId);
  const { data, error } = await auth.supabase.from("notification_devices").delete().eq("user_id", auth.user.id).eq("id", id).select("id");
  if (error) return jsonResponse({ ok: false, error: publicError(error, "Notification device could not be removed") }, isMissingTable(error) ? 503 : 500, requestId);
  if (!(data || []).length) return jsonResponse({ ok: false, error: "Notification device not found" }, 404, requestId);
  const { count, error: countError } = await auth.supabase.from("notification_devices").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id).eq("enabled", true);
  if (!countError && Number(count || 0) === 0) await auth.supabase.from("notification_preferences").upsert({ user_id: auth.user.id, push_enabled: false }, { onConflict: "user_id" });
  return jsonResponse({ ok: true, ...deliveryState(), ...await loadState(auth) }, 200, requestId);
}
