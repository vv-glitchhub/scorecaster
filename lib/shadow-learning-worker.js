import { buildShadowLearningCycle } from "./shadow-learning-v1.mjs";

const MAX_USERS_PER_RUN = 10;
const MAX_SAMPLES_PER_USER = 2500;

function text(value, maximum = 500, fallback = "") {
  return String(value || fallback)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

async function claimUsers(admin) {
  const { data, error } = await admin.rpc("claim_shadow_learning_users", {
    p_limit: MAX_USERS_PER_RUN
  });
  if (error) throw error;
  return (data || []).map((row) => row.user_id).filter(Boolean);
}

async function loadSamples(admin, userId) {
  const { data, error } = await admin
    .from("shadow_learning_samples")
    .select("id,bet_id,sport,league,market,model_version,original_probability,odds_at_selection,stake,closing_odds,clv,result,profit,settled_at,created_at")
    .eq("user_id", userId)
    .eq("settlement_status", "settled")
    .in("result", ["win", "loss"])
    .order("settled_at", { ascending: false })
    .limit(MAX_SAMPLES_PER_USER);
  if (error) throw error;
  return (data || []).reverse();
}

async function saveCycle(admin, userId, report) {
  const { data, error } = await admin
    .from("shadow_learning_cycles")
    .insert({
      user_id: userId,
      status: report.status,
      sample_size: report.sampleSize,
      clv_sample: report.clvSample,
      metrics: report.metrics,
      calibration: report.calibration,
      segments: report.segments,
      gates: report.gates,
      promotion: report.promotion,
      safety: report.safety,
      report
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function completeUser(admin, userId, report, cycleId = null, errorMessage = null) {
  const { error } = await admin.rpc("complete_shadow_learning_user", {
    p_user_id: userId,
    p_status: errorMessage ? "error" : report.status,
    p_cycle_id: cycleId,
    p_sample_size: report.sampleSize || 0,
    p_clv_sample: report.clvSample || 0,
    p_review_ready: report.promotion?.reviewReady === true,
    p_error: errorMessage ? text(errorMessage, 500) : null,
    p_summary: report || {}
  });
  if (error) throw error;
}

async function processUser(admin, userId) {
  try {
    const samples = await loadSamples(admin, userId);
    const report = buildShadowLearningCycle(samples);
    const cycleId = await saveCycle(admin, userId, report);
    await completeUser(admin, userId, report, cycleId);
    return {
      userId,
      ok: true,
      cycleId,
      status: report.status,
      sampleSize: report.sampleSize,
      clvSample: report.clvSample,
      reviewReady: report.promotion.reviewReady
    };
  } catch (error) {
    const fallback = buildShadowLearningCycle([]);
    await completeUser(admin, userId, fallback, null, error?.message || "Shadow learning cycle failed");
    return {
      userId,
      ok: false,
      status: "error",
      sampleSize: 0,
      clvSample: 0,
      reviewReady: false,
      error: text(error?.message, 500, "Shadow learning cycle failed")
    };
  }
}

export async function runShadowLearningWorker({ admin } = {}) {
  if (!admin) throw new Error("Shadow Learning Worker requires a Supabase admin client");
  const userIds = await claimUsers(admin);
  const results = [];
  for (const userId of userIds) results.push(await processUser(admin, userId));

  return {
    ok: results.every((item) => item.ok),
    version: "shadow-learning-worker-v1",
    mode: "shadow-only",
    paperOnly: true,
    realMoneyBetting: false,
    automaticPromotionAllowed: false,
    claimedUsers: userIds.length,
    processedUsers: results.length,
    reviewReadyUsers: results.filter((item) => item.reviewReady).length,
    errors: results.filter((item) => !item.ok).length,
    results,
    limits: {
      usersPerRun: MAX_USERS_PER_RUN,
      samplesPerUser: MAX_SAMPLES_PER_USER
    },
    generatedAt: new Date().toISOString()
  };
}

export const SHADOW_LEARNING_WORKER_LIMITS = {
  usersPerRun: MAX_USERS_PER_RUN,
  samplesPerUser: MAX_SAMPLES_PER_USER
};
