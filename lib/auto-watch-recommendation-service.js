import {
  AUTO_WATCH_SOURCE,
  normalizedAutoWatchPreferences,
  reconcileAutoWatchRows
} from "./auto-watch-recommendations.mjs";

const MAX_USERS_PER_RUN = 20;
const MAX_WATCHLIST_ROWS = 50;

function cleanError(error) {
  return String(error?.message || error || "Auto-Watch sync failed")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

async function loadExistingRows(client, userId) {
  const { data, error } = await client
    .from("watchlist_items")
    .select("id,event_id,market,selection,raw_pick")
    .eq("user_id", userId)
    .limit(MAX_WATCHLIST_ROWS + 1);
  if (error) throw error;
  if ((data || []).length > MAX_WATCHLIST_ROWS) {
    throw new Error(`Watchlist contains more than ${MAX_WATCHLIST_ROWS} items`);
  }
  return data || [];
}

export async function syncAutoWatchRecommendations({
  client,
  userId,
  recommendations = [],
  preferences = {}
} = {}) {
  if (!client || !userId) throw new Error("Auto-Watch sync requires a database client and user ID");
  const prefs = normalizedAutoWatchPreferences(preferences);
  const feed = Array.isArray(recommendations) ? recommendations : [];

  if (prefs.enabled && feed.length === 0) {
    return {
      ok: true,
      skipped: true,
      reason: "recommendation-feed-empty",
      inserted: 0,
      removed: 0,
      retainedAuto: 0,
      coveredByManual: 0
    };
  }

  const existingRows = await loadExistingRows(client, userId);
  const plan = reconcileAutoWatchRows({
    existingRows,
    recommendations: feed,
    preferences: prefs,
    userId
  });

  if (plan.inserts.length) {
    const { error } = await client
      .from("watchlist_items")
      .upsert(plan.inserts, {
        onConflict: "user_id,event_id,market,selection",
        ignoreDuplicates: true
      });
    if (error) throw error;
  }

  let removed = 0;
  if (plan.deleteIds.length) {
    const { data, error } = await client
      .from("watchlist_items")
      .delete()
      .eq("user_id", userId)
      .in("id", plan.deleteIds)
      .contains("raw_pick", { source: AUTO_WATCH_SOURCE })
      .select("id");
    if (error) throw error;
    removed = (data || []).length;
  }

  return {
    ok: true,
    skipped: false,
    inserted: plan.inserts.length,
    removed,
    retainedAuto: plan.retainedAuto,
    coveredByManual: plan.coveredByManual,
    requested: plan.requested
  };
}

async function loadRecommendationFeed(origin, fetchImpl) {
  const target = new URL("/api/recommendations", origin);
  target.searchParams.set("limit", "3");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetchImpl(target, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok || payload?.ok !== true || !Array.isArray(payload.recommendations)) {
      throw new Error(payload?.error || `Recommendations returned HTTP ${response.status}`);
    }
    return payload.recommendations;
  } finally {
    clearTimeout(timeout);
  }
}

async function completeUser(admin, userId, result) {
  const { error } = await admin.rpc("complete_auto_watch_recommendation_user", {
    p_user_id: userId,
    p_status: result.status,
    p_synced_count: result.synced || 0,
    p_removed_count: result.removed || 0,
    p_error: result.error || null
  });
  if (error) throw error;
}

export async function runAutoWatchRecommendationSync({
  admin,
  origin,
  fetchImpl = fetch
} = {}) {
  if (!admin) throw new Error("Auto-Watch requires a Supabase admin client");
  if (!origin) throw new Error("Auto-Watch requires an application origin");

  const { data, error } = await admin.rpc("claim_auto_watch_recommendation_users", {
    p_limit: MAX_USERS_PER_RUN
  });
  if (error) {
    if (error.code === "42883" || /does not exist|schema cache/i.test(error.message || "")) {
      return { ok: true, available: false, claimedUsers: 0, processedUsers: 0, failedUsers: 0, inserted: 0, removed: 0 };
    }
    throw error;
  }

  const claims = data || [];
  if (!claims.length) {
    return { ok: true, available: true, claimedUsers: 0, processedUsers: 0, failedUsers: 0, inserted: 0, removed: 0 };
  }

  let recommendations;
  try {
    recommendations = await loadRecommendationFeed(origin, fetchImpl);
    if (!recommendations.length) throw new Error("Recommendation feed is empty; existing Auto-Watch rows were retained");
  } catch (feedError) {
    const message = cleanError(feedError);
    for (const claim of claims) {
      await completeUser(admin, claim.user_id, { status: "error", error: message });
    }
    return {
      ok: false,
      available: true,
      claimedUsers: claims.length,
      processedUsers: 0,
      failedUsers: claims.length,
      inserted: 0,
      removed: 0,
      error: message
    };
  }

  let processedUsers = 0;
  let failedUsers = 0;
  let inserted = 0;
  let removed = 0;

  for (const claim of claims) {
    try {
      const sync = await syncAutoWatchRecommendations({
        client: admin,
        userId: claim.user_id,
        recommendations,
        preferences: {
          enabled: true,
          top_n: claim.top_n,
          alert_move_percent: claim.alert_move_percent,
          alert_before_minutes: claim.alert_before_minutes
        }
      });
      inserted += sync.inserted;
      removed += sync.removed;
      processedUsers += 1;
      await completeUser(admin, claim.user_id, {
        status: "success",
        synced: sync.inserted + sync.retainedAuto + sync.coveredByManual,
        removed: sync.removed
      });
    } catch (syncError) {
      failedUsers += 1;
      await completeUser(admin, claim.user_id, {
        status: "error",
        error: cleanError(syncError)
      });
    }
  }

  return {
    ok: failedUsers === 0,
    available: true,
    claimedUsers: claims.length,
    processedUsers,
    failedUsers,
    inserted,
    removed,
    recommendationCount: recommendations.length
  };
}
