import { syncAlertInbox } from "./alert-inbox-service.js";
import { buildWatchlistState } from "./watchlist-alert-engine.mjs";
import {
  currentSnapshotFromPick,
  initialSnapshotFromWatchlist,
  materiallyDifferentSnapshot
} from "./market-timeline.mjs";
import { SPORTS } from "./sports.js";

const MAX_USERS_PER_RUN = 20;
const MAX_ITEMS_PER_USER = 50;
const MAX_SPORTS_PER_REQUEST = 6;
const MAX_SPORTS_PER_RUN = 12;
const MIN_TIMELINE_INTERVAL_MS = 15 * 60 * 1000;
const SUPPORTED_SPORTS = new Set(
  SPORTS.flatMap((group) => group.leagues.map((league) => league.key))
);
const WATCHLIST_SELECT = "id,user_id,event_id,sport,league,market,selection,home_team,away_team,match,commence_time,added_odds,added_decision,alert_move_percent,alert_before_minutes,active,raw_pick,created_at,updated_at";
const DEFAULT_NOTIFICATION_PREFERENCES = {
  in_app_enabled: true,
  push_enabled: false,
  high_enabled: true,
  medium_enabled: true,
  info_enabled: false,
  kickoff_enabled: true,
  decision_enabled: true,
  price_enabled: true
};

function text(value, maximum = 500) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function selectionKey(item = {}) {
  const eventId = text(item.event_id || item.eventId || item.gameId || item.id, 180);
  const market = text(item.market || item.marketKey || "h2h", 80).toLowerCase();
  const selection = text(item.selection || item.label, 160).toLowerCase();
  return `${eventId}::${market}::${selection}`;
}

function missingTable(error) {
  return error?.code === "42P01" || /does not exist|schema cache/i.test(error?.message || "");
}

function alertAllowed(alert, preferences) {
  if (!preferences.in_app_enabled) return false;
  if (alert.severity === "high" && !preferences.high_enabled) return false;
  if (alert.severity === "medium" && !preferences.medium_enabled) return false;
  if (alert.severity === "info" && !preferences.info_enabled) return false;
  if (alert.type === "kickoff_soon" && !preferences.kickoff_enabled) return false;
  if (alert.type === "decision_changed" && !preferences.decision_enabled) return false;
  if (["price_moved", "below_play_price"].includes(alert.type) && !preferences.price_enabled) return false;
  return true;
}

async function fetchJson(fetchImpl, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok || payload?.ok !== true || !Array.isArray(payload.data)) {
      throw new Error(payload?.error || `Top Picks returned HTTP ${response.status}`);
    }
    return payload.data;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadCurrentPicks(origin, sports, fetchImpl) {
  const uniqueSports = [...new Set(sports)]
    .filter((sport) => SUPPORTED_SPORTS.has(sport))
    .sort();
  if (uniqueSports.length > MAX_SPORTS_PER_RUN) {
    throw new Error("Watchlist Monitor sport budget exceeded");
  }

  const all = [];
  for (const group of chunks(uniqueSports, MAX_SPORTS_PER_REQUEST)) {
    const target = new URL("/api/top-picks", origin);
    target.searchParams.set("sports", group.join(","));
    all.push(...await fetchJson(fetchImpl, target));
  }

  const byKey = new Map();
  for (const pick of all) byKey.set(selectionKey(pick), pick);
  return [...byKey.values()];
}

async function claimUsers(admin) {
  const { data, error } = await admin.rpc("claim_watchlist_monitor_users", {
    p_limit: MAX_USERS_PER_RUN
  });
  if (error) throw error;
  return (data || []).map((row) => row.user_id).filter(Boolean);
}

async function loadItems(admin, userId) {
  const { data, error } = await admin
    .from("watchlist_items")
    .select(WATCHLIST_SELECT)
    .eq("user_id", userId)
    .order("commence_time", { ascending: true })
    .limit(MAX_ITEMS_PER_USER + 1);
  if (error) throw error;
  if ((data || []).length > MAX_ITEMS_PER_USER) {
    throw new Error(`Watchlist contains more than ${MAX_ITEMS_PER_USER} items`);
  }
  return data || [];
}

async function loadPreferences(admin, userIds) {
  if (!userIds.length) return new Map();
  const { data, error } = await admin
    .from("notification_preferences")
    .select("user_id,in_app_enabled,push_enabled,high_enabled,medium_enabled,info_enabled,kickoff_enabled,decision_enabled,price_enabled")
    .in("user_id", userIds);
  if (error && !missingTable(error)) throw error;
  return new Map((data || []).map((row) => [
    row.user_id,
    { ...DEFAULT_NOTIFICATION_PREFERENCES, ...row }
  ]));
}

async function latestTimelineByWatchlist(admin, userId, watchlistIds) {
  if (!watchlistIds.length) return { available: true, rows: new Map() };
  const { data, error } = await admin
    .from("market_timeline_snapshots")
    .select("watchlist_id,odds,decision,consensus_probability,bookmaker,captured_at")
    .eq("user_id", userId)
    .in("watchlist_id", watchlistIds)
    .order("captured_at", { ascending: false })
    .limit(1000);
  if (error && missingTable(error)) return { available: false, rows: new Map() };
  if (error) throw error;

  const rows = new Map();
  for (const row of data || []) {
    if (!rows.has(row.watchlist_id)) rows.set(row.watchlist_id, row);
  }
  return { available: true, rows };
}

async function captureTimelineSnapshots(admin, userId, items, currentByKey, now) {
  const activeItems = items.filter((item) => item.active !== false);
  const latest = await latestTimelineByWatchlist(
    admin,
    userId,
    activeItems.map((item) => item.id)
  );
  if (!latest.available) return { available: false, captured: 0 };

  const inserts = [];
  for (const item of activeItems) {
    const pick = currentByKey.get(selectionKey(item));
    if (!pick) continue;
    const current = currentSnapshotFromPick(pick, item, now.toISOString());
    if (!current) continue;

    const previous = latest.rows.get(item.id) || null;
    if (!previous) {
      const initial = initialSnapshotFromWatchlist(item);
      if (initial) inserts.push(initial);
      const baseline = initial || null;
      const baselineTime = baseline ? Date.parse(baseline.captured_at || "") : 0;
      if (!baseline || materiallyDifferentSnapshot(baseline, current) || now.getTime() - baselineTime >= MIN_TIMELINE_INTERVAL_MS) {
        inserts.push(current);
      }
      continue;
    }

    const previousTime = Date.parse(previous.captured_at || "");
    if (
      materiallyDifferentSnapshot(previous, current) ||
      !Number.isFinite(previousTime) ||
      now.getTime() - previousTime >= MIN_TIMELINE_INTERVAL_MS
    ) {
      inserts.push(current);
    }
  }

  if (!inserts.length) return { available: true, captured: 0 };
  const { error } = await admin.from("market_timeline_snapshots").insert(inserts.slice(0, 100));
  if (error) throw error;
  return { available: true, captured: Math.min(inserts.length, 100) };
}

async function completeUser(admin, userId, result) {
  const { error } = await admin.rpc("complete_watchlist_monitor_user", {
    p_user_id: userId,
    p_status: result.status,
    p_items_count: result.items || 0,
    p_alerts_count: result.alerts || 0,
    p_snapshots_count: result.snapshots || 0,
    p_error: result.error || null
  });
  if (error) throw error;
}

async function processUser(admin, entry, currentPicks, preferences, now) {
  const currentByKey = new Map(currentPicks.map((pick) => [selectionKey(pick), pick]));
  const state = buildWatchlistState({
    items: entry.items,
    currentPicks,
    now: now.getTime()
  });
  const allowedAlerts = state.alerts.filter((alert) => alertAllowed(alert, preferences));
  const inbox = await syncAlertInbox(admin, entry.userId, allowedAlerts, {
    now: now.toISOString()
  });
  if (inbox.error) throw inbox.error;

  const timeline = await captureTimelineSnapshots(
    admin,
    entry.userId,
    entry.items,
    currentByKey,
    now
  );

  const result = {
    status: "success",
    items: entry.items.length,
    alerts: allowedAlerts.length,
    snapshots: timeline.captured
  };
  await completeUser(admin, entry.userId, result);
  return result;
}

function chooseEntriesWithinSportBudget(entries) {
  const selectedSports = new Set();
  const accepted = [];
  const deferred = [];

  for (const entry of entries) {
    const sports = [...new Set(entry.items.map((item) => item.sport).filter(Boolean))];
    if (sports.some((sport) => !SUPPORTED_SPORTS.has(sport))) {
      deferred.push({ ...entry, reason: "Watchlist contains an unsupported sport" });
      continue;
    }
    const combined = new Set([...selectedSports, ...sports]);
    if (combined.size > MAX_SPORTS_PER_RUN) {
      deferred.push({ ...entry, reason: "Deferred by the per-run sport budget" });
      continue;
    }
    for (const sport of sports) selectedSports.add(sport);
    accepted.push(entry);
  }

  return { accepted, deferred, sports: [...selectedSports] };
}

export async function runWatchlistMonitor({
  admin,
  origin,
  fetchImpl = fetch,
  now = new Date()
} = {}) {
  if (!admin) throw new Error("Supabase admin client is required");
  if (!origin) throw new Error("Watchlist Monitor origin is required");

  const userIds = await claimUsers(admin);
  if (!userIds.length) {
    return {
      ok: true,
      claimedUsers: 0,
      processedUsers: 0,
      deferredUsers: 0,
      failedUsers: 0,
      items: 0,
      alerts: 0,
      snapshots: 0,
      sports: []
    };
  }

  const loaded = await Promise.all(userIds.map(async (userId) => {
    try {
      return { userId, items: await loadItems(admin, userId), loadError: null };
    } catch (error) {
      return { userId, items: [], loadError: error };
    }
  }));

  const ready = [];
  let failedUsers = 0;
  for (const entry of loaded) {
    if (!entry.loadError) {
      ready.push(entry);
      continue;
    }
    failedUsers += 1;
    await completeUser(admin, entry.userId, {
      status: "error",
      error: text(entry.loadError?.message || entry.loadError, 500)
    });
  }

  const budget = chooseEntriesWithinSportBudget(ready);
  for (const entry of budget.deferred) {
    await completeUser(admin, entry.userId, {
      status: "error",
      items: entry.items.length,
      error: entry.reason
    });
  }

  let currentPicks = [];
  if (budget.sports.length) {
    try {
      currentPicks = await loadCurrentPicks(origin, budget.sports, fetchImpl);
    } catch (error) {
      for (const entry of budget.accepted) {
        await completeUser(admin, entry.userId, {
          status: "error",
          items: entry.items.length,
          error: text(error?.message || error, 500)
        });
      }
      throw error;
    }
  }

  const preferencesByUser = await loadPreferences(
    admin,
    budget.accepted.map((entry) => entry.userId)
  );
  const results = [];

  for (const batch of chunks(budget.accepted, 4)) {
    const settled = await Promise.allSettled(batch.map(async (entry) => {
      try {
        return await processUser(
          admin,
          entry,
          currentPicks,
          preferencesByUser.get(entry.userId) || DEFAULT_NOTIFICATION_PREFERENCES,
          now
        );
      } catch (error) {
        const message = text(error?.message || error, 500);
        await completeUser(admin, entry.userId, {
          status: "error",
          items: entry.items.length,
          error: message
        });
        throw error;
      }
    }));
    results.push(...settled);
  }

  const successful = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  failedUsers += results.filter((result) => result.status === "rejected").length;

  return {
    ok: failedUsers === 0,
    claimedUsers: userIds.length,
    processedUsers: successful.length,
    deferredUsers: budget.deferred.length,
    failedUsers,
    items: successful.reduce((sum, item) => sum + item.items, 0),
    alerts: successful.reduce((sum, item) => sum + item.alerts, 0),
    snapshots: successful.reduce((sum, item) => sum + item.snapshots, 0),
    sports: budget.sports,
    currentPicks: currentPicks.length
  };
}