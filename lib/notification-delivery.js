import { getSupabaseAdminClient } from "./supabase";

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_SEND_BATCH = 100;
const MAX_RECEIPT_BATCH = 1000;
const MAX_QUEUE_ALERTS = 200;
const MAX_DEVICES = 500;
const MAX_ATTEMPTS = 5;
const MAX_ALERT_AGE_MS = 24 * 60 * 60 * 1000;
const RECEIPT_DELAY_MS = 15 * 60 * 1000;
const RECEIPT_EXPIRY_MS = 23 * 60 * 60 * 1000;

function text(value, maximum = 500, fallback = "") {
  return String(value || fallback)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function expoHeaders() {
  const headers = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json"
  };
  const accessToken = text(process.env.EXPO_ACCESS_TOKEN, 500);
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

async function expoRequest(fetchImpl, url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal
    });
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timeout);
  }
}

function categoryAllowed(alert, preferences) {
  if (!preferences?.push_enabled) return false;
  if (alert.severity === "high" && !preferences.high_enabled) return false;
  if (alert.severity === "medium" && !preferences.medium_enabled) return false;
  if (alert.severity === "info" && !preferences.info_enabled) return false;
  if (alert.alert_type === "kickoff_soon" && !preferences.kickoff_enabled) return false;
  if (alert.alert_type === "decision_changed" && !preferences.decision_enabled) return false;
  if (["price_moved", "below_play_price"].includes(alert.alert_type) && !preferences.price_enabled) return false;
  return true;
}

function retryAt(now, attemptCount) {
  const minutes = Math.min(360, 5 * (2 ** Math.max(0, attemptCount - 1)));
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString();
}

async function updateDelivery(admin, id, changes) {
  return admin.from("notification_deliveries").update(changes).eq("id", id);
}

async function failDelivery(admin, row, code, message, now) {
  return updateDelivery(admin, row.id, {
    status: "failed",
    lease_expires_at: null,
    failed_at: now.toISOString(),
    receipt_checked_at: row.expo_ticket_id ? now.toISOString() : null,
    error_code: text(code, 80, "delivery_failed"),
    error_message: text(message, 500, "Notification delivery failed")
  });
}

async function retryDelivery(admin, row, code, message, now) {
  if (Number(row.attempt_count || 0) >= MAX_ATTEMPTS) {
    return failDelivery(admin, row, code, message, now);
  }
  return updateDelivery(admin, row.id, {
    status: "retry",
    next_attempt_at: retryAt(now, Number(row.attempt_count || 0)),
    lease_expires_at: null,
    expo_ticket_id: null,
    ticket_status: null,
    receipt_status: null,
    receipt_checked_at: null,
    error_code: text(code, 80, "temporary_failure"),
    error_message: text(message, 500, "Temporary notification delivery failure")
  });
}

async function disableDevice(admin, deviceId) {
  if (!deviceId) return;
  await admin.from("notification_devices").update({ enabled: false }).eq("id", deviceId);
}

async function queueEligibleDeliveries(admin, now) {
  const newestAllowed = new Date(now.getTime() - MAX_ALERT_AGE_MS).toISOString();
  const { data: alerts, error: alertError } = await admin
    .from("alert_inbox")
    .select("id,user_id,alert_type,severity,title,message,match,selection,details,active,read_at,dismissed_at,last_seen_at")
    .eq("active", true)
    .is("read_at", null)
    .is("dismissed_at", null)
    .gte("last_seen_at", newestAllowed)
    .order("last_seen_at", { ascending: false })
    .limit(MAX_QUEUE_ALERTS);
  if (alertError) throw alertError;
  if (!(alerts || []).length) return 0;

  const userIds = [...new Set(alerts.map((item) => item.user_id).filter(Boolean))];
  const [{ data: preferences, error: preferenceError }, { data: devices, error: deviceError }] = await Promise.all([
    admin
      .from("notification_preferences")
      .select("user_id,push_enabled,high_enabled,medium_enabled,info_enabled,kickoff_enabled,decision_enabled,price_enabled")
      .in("user_id", userIds)
      .eq("push_enabled", true),
    admin
      .from("notification_devices")
      .select("id,user_id")
      .in("user_id", userIds)
      .eq("enabled", true)
      .limit(MAX_DEVICES)
  ]);
  if (preferenceError) throw preferenceError;
  if (deviceError) throw deviceError;

  const preferencesByUser = new Map((preferences || []).map((item) => [item.user_id, item]));
  const devicesByUser = new Map();
  for (const device of devices || []) {
    if (!devicesByUser.has(device.user_id)) devicesByUser.set(device.user_id, []);
    devicesByUser.get(device.user_id).push(device);
  }

  const rows = [];
  for (const alert of alerts || []) {
    if (!categoryAllowed(alert, preferencesByUser.get(alert.user_id))) continue;
    for (const device of devicesByUser.get(alert.user_id) || []) {
      rows.push({
        user_id: alert.user_id,
        alert_id: alert.id,
        device_id: device.id,
        status: "queued",
        next_attempt_at: now.toISOString(),
        queued_at: now.toISOString()
      });
    }
  }
  if (!rows.length) return 0;

  const { data, error } = await admin
    .from("notification_deliveries")
    .upsert(rows, { onConflict: "alert_id,device_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return (data || []).length;
}

async function claimDeliveries(admin) {
  const { data, error } = await admin.rpc("claim_notification_deliveries", { p_limit: MAX_SEND_BATCH });
  if (error) throw error;
  return data || [];
}

async function hydrateClaims(admin, claims) {
  if (!claims.length) return [];
  const alertIds = [...new Set(claims.map((row) => row.alert_id))];
  const deviceIds = [...new Set(claims.map((row) => row.device_id))];
  const [{ data: alerts, error: alertError }, { data: devices, error: deviceError }] = await Promise.all([
    admin
      .from("alert_inbox")
      .select("id,user_id,alert_type,severity,title,message,match,selection,details,active,read_at,dismissed_at")
      .in("id", alertIds),
    admin
      .from("notification_devices")
      .select("id,user_id,expo_push_token,platform,enabled")
      .in("id", deviceIds)
  ]);
  if (alertError) throw alertError;
  if (deviceError) throw deviceError;
  const alertsById = new Map((alerts || []).map((item) => [item.id, item]));
  const devicesById = new Map((devices || []).map((item) => [item.id, item]));
  return claims.map((row) => ({ ...row, alert: alertsById.get(row.alert_id), device: devicesById.get(row.device_id) }));
}

function buildMessage(row) {
  const alert = row.alert;
  return {
    to: row.device.expo_push_token,
    sound: "default",
    channelId: "scorecaster-alerts",
    title: text(alert.title, 120, "Scorecaster alert"),
    body: text(alert.message, 240, "A watched selection changed."),
    data: {
      screen: "alerts",
      alertId: alert.id,
      alertType: text(alert.alert_type, 80),
      severity: text(alert.severity, 20)
    },
    ttl: 3600,
    priority: alert.severity === "high" ? "high" : "default"
  };
}

async function sendClaimedDeliveries(admin, fetchImpl, now) {
  const claims = await hydrateClaims(admin, await claimDeliveries(admin));
  const ready = [];
  let failed = 0;

  for (const row of claims) {
    const alertUsable = row.alert && row.alert.active && !row.alert.read_at && !row.alert.dismissed_at;
    const deviceUsable = row.device && row.device.enabled && row.device.user_id === row.user_id;
    if (!alertUsable || !deviceUsable || row.alert?.user_id !== row.user_id) {
      await failDelivery(admin, row, "delivery_no_longer_eligible", "Alert or device is no longer eligible", now);
      failed += 1;
    } else {
      ready.push(row);
    }
  }

  if (!ready.length) return { claimed: claims.length, ticketed: 0, retried: 0, failed };

  let response;
  try {
    response = await expoRequest(fetchImpl, EXPO_SEND_URL, ready.map(buildMessage));
  } catch (error) {
    for (const row of ready) await retryDelivery(admin, row, "expo_network_error", String(error), now);
    return { claimed: claims.length, ticketed: 0, retried: ready.length, failed };
  }

  if (!response.ok || !Array.isArray(response.payload?.data)) {
    const transient = response.status === 429 || response.status >= 500;
    for (const row of ready) {
      if (transient) await retryDelivery(admin, row, `expo_http_${response.status}`, "Expo Push Service request failed", now);
      else await failDelivery(admin, row, `expo_http_${response.status}`, "Expo Push Service rejected the request", now);
    }
    return {
      claimed: claims.length,
      ticketed: 0,
      retried: transient ? ready.length : 0,
      failed: failed + (transient ? 0 : ready.length)
    };
  }

  let ticketed = 0;
  let retried = 0;
  for (let index = 0; index < ready.length; index += 1) {
    const row = ready[index];
    const ticket = response.payload.data[index];
    if (ticket?.status === "ok" && ticket.id) {
      await updateDelivery(admin, row.id, {
        status: "ticketed",
        expo_ticket_id: text(ticket.id, 180),
        ticket_status: "ok",
        sent_at: now.toISOString(),
        lease_expires_at: null,
        error_code: null,
        error_message: null
      });
      ticketed += 1;
      continue;
    }

    const code = text(ticket?.details?.error, 80, "expo_ticket_error");
    const message = text(ticket?.message, 500, "Expo Push Service returned an error ticket");
    if (code === "DeviceNotRegistered") {
      await disableDevice(admin, row.device_id);
      await failDelivery(admin, row, code, message, now);
      failed += 1;
    } else if (code === "MessageRateExceeded") {
      await retryDelivery(admin, row, code, message, now);
      retried += 1;
    } else {
      await failDelivery(admin, row, code, message, now);
      failed += 1;
    }
  }

  return { claimed: claims.length, ticketed, retried, failed };
}

async function checkReceipts(admin, fetchImpl, now) {
  const cutoff = new Date(now.getTime() - RECEIPT_DELAY_MS).toISOString();
  const { data: rows, error } = await admin
    .from("notification_deliveries")
    .select("id,device_id,expo_ticket_id,sent_at,attempt_count")
    .eq("status", "ticketed")
    .is("receipt_checked_at", null)
    .lte("sent_at", cutoff)
    .order("sent_at", { ascending: true })
    .limit(MAX_RECEIPT_BATCH);
  if (error) throw error;
  if (!(rows || []).length) return { checked: 0, providerAccepted: 0, retried: 0, failed: 0, pending: 0 };

  let response;
  try {
    response = await expoRequest(fetchImpl, EXPO_RECEIPTS_URL, { ids: rows.map((row) => row.expo_ticket_id) });
  } catch {
    return { checked: 0, providerAccepted: 0, retried: 0, failed: 0, pending: rows.length };
  }
  if (!response.ok || !response.payload?.data || Array.isArray(response.payload.data)) {
    return { checked: 0, providerAccepted: 0, retried: 0, failed: 0, pending: rows.length };
  }

  let checked = 0;
  let providerAccepted = 0;
  let retried = 0;
  let failed = 0;
  let pending = 0;

  for (const row of rows) {
    const receipt = response.payload.data[row.expo_ticket_id];
    if (!receipt) {
      const sentAt = Date.parse(row.sent_at || "");
      if (Number.isFinite(sentAt) && now.getTime() - sentAt >= RECEIPT_EXPIRY_MS) {
        await failDelivery(admin, row, "expo_receipt_missing", "Expo receipt was not available before expiry", now);
        failed += 1;
      } else {
        pending += 1;
      }
      continue;
    }

    checked += 1;
    if (receipt.status === "ok") {
      await updateDelivery(admin, row.id, {
        status: "provider_accepted",
        receipt_status: "ok",
        receipt_checked_at: now.toISOString(),
        provider_accepted_at: now.toISOString(),
        error_code: null,
        error_message: null
      });
      providerAccepted += 1;
      continue;
    }

    const code = text(receipt?.details?.error, 80, "expo_receipt_error");
    const message = text(receipt?.message, 500, "Expo receipt reported a delivery error");
    if (code === "DeviceNotRegistered") {
      await disableDevice(admin, row.device_id);
      await failDelivery(admin, row, code, message, now);
      failed += 1;
    } else if (code === "MessageRateExceeded") {
      await retryDelivery(admin, row, code, message, now);
      retried += 1;
    } else {
      await failDelivery(admin, row, code, message, now);
      failed += 1;
    }
  }

  return { checked, providerAccepted, retried, failed, pending };
}

export async function runNotificationDeliveryCycle({ admin = getSupabaseAdminClient(), fetchImpl = fetch, now = new Date() } = {}) {
  if (!admin) throw new Error("Supabase admin client is not configured");
  const receipts = await checkReceipts(admin, fetchImpl, now);
  const queued = await queueEligibleDeliveries(admin, now);
  const sends = await sendClaimedDeliveries(admin, fetchImpl, now);
  return {
    ok: true,
    generatedAt: now.toISOString(),
    queued,
    sends,
    receipts
  };
}

export const NOTIFICATION_DELIVERY_LIMITS = {
  sendBatch: MAX_SEND_BATCH,
  receiptBatch: MAX_RECEIPT_BATCH,
  maxAttempts: MAX_ATTEMPTS,
  maxAlertAgeHours: MAX_ALERT_AGE_MS / 3_600_000,
  receiptDelayMinutes: RECEIPT_DELAY_MS / 60_000,
  receiptExpiryHours: RECEIPT_EXPIRY_MS / 3_600_000
};
