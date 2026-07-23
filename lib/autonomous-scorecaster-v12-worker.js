import { createHash } from "node:crypto";
import {
  autonomousV12RunFingerprint,
  buildAutonomousV12LearningReport,
  buildAutonomousV12Policy,
  evaluateAutonomousV12CircuitBreakers,
  nextAutonomousV12Check,
  selectAutonomousV12Picks
} from "./autonomous-scorecaster-v12.mjs";
import { applyAutonomousV12UserCircuitControls } from "./autonomous-v12-user-circuit.mjs";

const MAX_USERS_PER_RUN = 10;
const MAX_HISTORY_ROWS = 1000;
const MAX_OPEN_ROWS = 250;
const MAX_AUDIT_ROWS_PER_USER = 100;
const MAX_SAVED_PICKS_PER_RUN = 40;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 4) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function text(value, maximum = 240, fallback = "") {
  return String(value || fallback)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function normalized(value) {
  return text(value, 240).toLowerCase();
}

function eventId(pick = {}) {
  return text(pick.eventId || pick.gameId || pick.id, 180);
}

function selection(pick = {}) {
  return text(pick.selection || pick.label, 160);
}

function matchName(pick = {}) {
  return text(pick.match || [pick.homeTeam, pick.awayTeam].filter(Boolean).join(" vs "), 240);
}

function sportKey(pick = {}) {
  return text(pick.sportKey || pick.sport || pick.league, 120, "unknown");
}

function leagueName(pick = {}) {
  return text(pick.league || pick.leagueTitle || pick.sportTitle || pick.sportKey, 120, "unknown");
}

function resultOutcome(row = {}) {
  const status = text(row.status, 20).toLowerCase();
  if (status === "won" || status === "win") return 1;
  if (status === "lost" || status === "loss") return 0;
  return null;
}

function historyCalibration(history = []) {
  return history.map((row) => ({
    model_probability: row.raw_pick?.modelProbability ?? row.raw_pick?.consensusProbability ?? null,
    outcome: resultOutcome(row),
    created_at: row.created_at
  })).filter((row) => row.outcome !== null && Number.isFinite(Number(row.model_probability)));
}

function defaultControls() {
  return {
    kill_switch: false,
    autonomy_level: "balanced",
    max_daily_loss_percent: 4,
    max_drawdown_percent: 15,
    max_loss_streak: 10,
    allow_shadow_learning: true,
    allow_automatic_risk_tightening: true
  };
}

function defaultSettings() {
  return {
    enabled: false,
    sports: [],
    daily_pick_limit: 3,
    min_priority_score: 0.62,
    min_odds: 1.2,
    max_odds: 5
  };
}

function defaultBankroll() {
  return {
    bankroll: 1000,
    max_stake_percent: 1,
    max_daily_exposure_percent: 6,
    max_single_league_exposure_percent: 3,
    min_edge: 0.025,
    min_confidence: 0.58,
    paper_trading_mode: true
  };
}

async function fetchJson(url, options = {}) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeout || 30_000),
      headers: { Accept: "application/json", ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => null);
    return { ok: response.ok && payload?.ok !== false, status: response.status, payload };
  } catch (error) {
    return { ok: false, status: 0, payload: null, error };
  }
}

async function loadSystemHealth(origin) {
  const [dataLayer, diagnostics, calibration] = await Promise.all([
    fetchJson(new URL("/api/data-layer/health", origin), { timeout: 20_000 }),
    fetchJson(new URL("/api/diagnostics-v2?limit=24", origin), { timeout: 30_000 }),
    fetchJson(new URL("/api/data-layer/calibration?days=365&limit=1000", origin), { timeout: 30_000 })
  ]);
  const dataPayload = dataLayer.payload || {};
  const diagnosticPayload = diagnostics.payload || {};
  return {
    topPicksAvailable: true,
    oddsProviderConfigured: Boolean(process.env.ODDS_API_KEY),
    providerScore: diagnosticPayload.providerHealth?.score ?? null,
    staleRate: diagnosticPayload.snapshot?.dataQuality?.staleRate ?? diagnosticPayload.current?.dataQuality?.staleRate ?? null,
    captureAgeMinutes: dataPayload.captureAgeMinutes ?? dataPayload.capture?.ageMinutes ?? null,
    unifiedDataMigrationActive: dataPayload.migrationActive === true,
    unifiedDataCaptureFresh: dataPayload.captureFresh === true,
    calibrationAvailable: calibration.ok && calibration.payload?.available !== false,
    calibrationRows: calibration.ok && Array.isArray(calibration.payload?.rows) ? calibration.payload.rows : [],
    diagnosticsAvailable: diagnostics.ok,
    dataLayerAvailable: dataLayer.ok,
    raw: {
      providerStatus: diagnosticPayload.providerHealth?.status || null,
      dataLayerReason: dataPayload.reason || null
    }
  };
}

async function claimUsers(admin) {
  const { data, error } = await admin.rpc("claim_autonomous_agent_users", { p_limit: MAX_USERS_PER_RUN });
  if (error) throw error;
  return (data || []).map((row) => row.user_id).filter(Boolean);
}

async function loadUserContext(admin, userId, now) {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const [settingsResult, controlsResult, bankrollResult, openResult, historyResult, todayResult] = await Promise.all([
    admin.from("autonomous_agent_settings")
      .select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds")
      .eq("user_id", userId).maybeSingle(),
    admin.from("autonomous_agent_v12_controls")
      .select("kill_switch,autonomy_level,max_daily_loss_percent,max_drawdown_percent,max_loss_streak,allow_shadow_learning,allow_automatic_risk_tightening")
      .eq("user_id", userId).maybeSingle(),
    admin.from("bankroll_settings")
      .select("bankroll,max_stake_percent,max_daily_exposure_percent,max_single_league_exposure_percent,min_edge,min_confidence,paper_trading_mode")
      .eq("user_id", userId).maybeSingle(),
    admin.from("bets")
      .select("id,stake,odds,league,sport,match,status,commence_time,raw_pick,created_at")
      .eq("user_id", userId).eq("status", "open")
      .order("created_at", { ascending: true }).limit(MAX_OPEN_ROWS),
    admin.from("bets")
      .select("id,status,created_at,stake,odds,closing_odds,clv,sport,league,market,raw_pick")
      .eq("user_id", userId).neq("status", "open")
      .order("created_at", { ascending: false }).limit(MAX_HISTORY_ROWS),
    admin.from("bets")
      .select("id,status,created_at,stake,odds,closing_odds,clv,sport,league,match,raw_pick")
      .eq("user_id", userId).gte("created_at", dayStart.toISOString())
      .order("created_at", { ascending: false }).limit(100)
  ]);
  const error = settingsResult.error || controlsResult.error || bankrollResult.error || openResult.error || historyResult.error || todayResult.error;
  if (error) throw error;
  const openBets = openResult.data || [];
  const settlementBacklog = openBets.filter((row) => {
    const commence = Date.parse(row.commence_time || row.raw_pick?.commenceTime || "");
    return Number.isFinite(commence) && commence < now.getTime() - 3 * 60 * 60 * 1000;
  }).length;
  return {
    settings: { ...defaultSettings(), ...(settingsResult.data || {}) },
    controls: { ...defaultControls(), ...(controlsResult.data || {}) },
    bankroll: { ...defaultBankroll(), ...(bankrollResult.data || {}) },
    openBets,
    history: historyResult.data || [],
    todayRows: todayResult.data || [],
    settlementBacklog
  };
}

async function createRun(admin, userId, sports, now) {
  const { data, error } = await admin.from("autonomous_agent_runs").insert({
    user_id: userId,
    status: "running",
    sports,
    started_at: now.toISOString(),
    summary: {
      paperOnly: true,
      realMoneyBetting: false,
      agentVersion: "Autonomous-Scorecaster-V12",
      runFingerprint: autonomousV12RunFingerprint(userId, now)
    }
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function finishRun(admin, runId, result, summary, now) {
  const { error } = await admin.from("autonomous_agent_runs").update({
    status: result.status,
    candidate_count: result.candidateCount || 0,
    selected_count: result.selectedCount || 0,
    saved_count: result.savedCount || 0,
    skipped_count: result.skippedCount || 0,
    total_stake: result.totalStake || 0,
    summary,
    error: result.error ? text(result.error, 500) : null,
    completed_at: now.toISOString()
  }).eq("id", runId);
  if (error) throw error;
}

async function completeLegacyState(admin, userId, result) {
  const { error } = await admin.rpc("complete_autonomous_agent_user", {
    p_user_id: userId,
    p_status: result.status === "paused" ? "deferred" : result.status,
    p_run_id: result.runId || null,
    p_candidate_count: result.candidateCount || 0,
    p_selected_count: result.selectedCount || 0,
    p_saved_count: result.savedCount || 0,
    p_skipped_count: result.skippedCount || 0,
    p_total_stake: result.totalStake || 0,
    p_error: result.error ? text(result.error, 500) : null
  });
  if (error) throw error;
}

async function scheduleNextCheck(admin, userId, nextCheckAt, status, error = null) {
  const { error: updateError } = await admin.from("autonomous_agent_state").update({
    next_check_at: nextCheckAt,
    lease_expires_at: null,
    last_status: status === "paused" ? "deferred" : status,
    last_error: error ? text(error, 500) : null
  }).eq("user_id", userId);
  if (updateError) throw updateError;
}

async function loadTopPicks(origin, sports) {
  const url = new URL("/api/top-picks", origin);
  if (Array.isArray(sports) && sports.length) url.searchParams.set("sports", sports.slice(0, 6).join(","));
  const response = await fetchJson(url, { timeout: 60_000 });
  if (!response.ok) throw new Error(response.payload?.error || response.payload?.reason || "Top Picks could not be loaded");
  return {
    picks: Array.isArray(response.payload?.data) ? response.payload.data : [],
    source: text(response.payload?.source, 100, "no-vig-market-consensus"),
    fixtureSource: text(response.payload?.fixtureSource, 100, "live-odds-provider-only")
  };
}

function applyAutonomyLevel(policy, controls) {
  const result = { ...policy, automaticRiskTighteningEnabled: controls.allow_automatic_risk_tightening !== false };
  if (controls.autonomy_level === "observe") {
    result.state = result.state === "PAUSED" ? "PAUSED" : "LEARNING";
    result.maxPicks = 0;
    result.riskScale = 0;
  }
  if (controls.autonomy_level === "conservative" && result.state !== "PAUSED") {
    result.maxPicks = Math.min(result.maxPicks, 1);
    result.riskScale = Math.min(result.riskScale, 0.5);
    result.maxStakePercent = round(result.maxStakePercent * 0.5, 3);
    result.maxTotalExposurePercent = round(result.maxTotalExposurePercent * 0.6, 3);
    result.maxLeagueExposurePercent = round(result.maxLeagueExposurePercent * 0.6, 3);
    result.minPriorityScore = Math.min(0.95, result.minPriorityScore + 0.05);
    result.minConfidence = Math.min(0.95, result.minConfidence + 0.04);
  }
  return result;
}

function clientRef(userId, pick, now) {
  const day = now.toISOString().slice(0, 10);
  const digest = createHash("sha256")
    .update([userId, day, eventId(pick), selection(pick)].join("|"))
    .digest("hex").slice(0, 32);
  return `autonomous-v12-${day}-${digest}`;
}

function paperRow(userId, runId, pick, source, fixtureSource, learning, policy, circuit, now) {
  const odds = finite(pick.odds);
  return {
    user_id: userId,
    client_ref: clientRef(userId, pick, now),
    label: selection(pick),
    match: matchName(pick),
    market: text(pick.marketKey || pick.market, 80, "h2h"),
    bookmaker: text(pick.bookmaker, 120, "verified-market"),
    sport: sportKey(pick),
    league: leagueName(pick),
    home_team: text(pick.homeTeam, 160),
    away_team: text(pick.awayTeam, 160),
    odds,
    stake: finite(pick.autonomousStake),
    edge: finite(pick.edge),
    ev: finite(pick.ev),
    confidence: finite(pick.confidence),
    status: "open",
    raw_pick: {
      source: "scorecaster-autonomous-v12",
      eventId: eventId(pick),
      commenceTime: pick.commenceTime || pick.commence_time || null,
      modelProbability: pick.stressTest?.probability ?? pick.consensusProbability ?? pick.modelProbability ?? null,
      impliedProbability: odds > 1 ? 1 / odds : null,
      decision: "PLAY",
      productDecision: "PLAY",
      qualityGrade: text(pick.qualityGrade, 8),
      qualityScore: pick.qualityScore ?? null,
      priorityScore: round(pick.priorityScore, 6),
      robustnessScore: round(pick.robustnessScore, 6),
      autonomousV12Score: pick.autonomousV12Score,
      autonomousRunId: runId,
      agentVersion: "Autonomous-Scorecaster-V12",
      probabilitySource: "no-vig market consensus",
      providerSource: source,
      fixtureSource,
      unifiedDataCoverage: pick.unifiedSportsData?.coverage || null,
      dataProvenance: pick.dataProvenance || null,
      contextImpact: pick.contextImpact || 0,
      contextCanUpgrade: false,
      policy,
      circuitBreakers: circuit,
      learningStatus: learning.status,
      shadowChallenger: learning.challenger,
      generatedAt: now.toISOString(),
      paperOnly: true,
      realMoneyBetting: false
    }
  };
}

async function savePaperPick(admin, row) {
  const { data, error } = await admin.from("bets")
    .upsert(row, { onConflict: "user_id,client_ref", ignoreDuplicates: true })
    .select("id,client_ref,stake").maybeSingle();
  if (error) return { saved: false, duplicate: false, riskRejected: error.code === "23514", error };
  if (!data) return { saved: false, duplicate: true, riskRejected: false, error: null };
  return { saved: true, duplicate: false, riskRejected: false, error: null, data };
}

async function storeLearning(admin, userId, learning, policy, controls) {
  if (controls.allow_shadow_learning === false) return;
  const { error: cycleError } = await admin.from("autonomous_agent_v12_learning_cycles").insert({
    user_id: userId,
    status: learning.status,
    sample_size: learning.performance?.sampleSize || 0,
    clv_sample: learning.performance?.clvSample || 0,
    probability_sample: learning.performance?.probabilitySample || 0,
    metrics: learning.performance || {},
    calibration: learning.calibration || {},
    challenger: learning.challenger || {},
    policy
  });
  if (cycleError) throw cycleError;
  const { error: trimError } = await admin.rpc("trim_autonomous_v12_learning_cycles", { p_user_id: userId, p_keep: 180 });
  if (trimError) throw trimError;
}

async function storeV12State(admin, userId, state) {
  const { error } = await admin.from("autonomous_agent_v12_state").upsert({
    user_id: userId,
    operating_state: state.operatingState,
    policy: state.policy,
    circuit_breakers: state.circuit,
    learning_report: state.learning,
    shadow_champion_id: state.learning?.challenger?.eligibleForShadowChampion ? state.learning.challenger.id : null,
    last_audit: state.audit,
    last_learning_at: state.now,
    last_decision_at: state.savedCount > 0 ? state.now : null
  }, { onConflict: "user_id" });
  if (error) throw error;
}

async function storeAudit(admin, userId, runId, audit, circuit, now) {
  const rows = [];
  if (circuit.paused) {
    rows.push({
      user_id: userId,
      run_id: runId,
      event_id: null,
      selection: null,
      action: "PAUSE",
      reasons: circuit.reasons,
      evidence: { circuit, generatedAt: now.toISOString(), paperOnly: true }
    });
  }
  for (const item of audit.slice(0, MAX_AUDIT_ROWS_PER_USER)) {
    rows.push({
      user_id: userId,
      run_id: runId,
      event_id: item.eventId || null,
      selection: item.selection || null,
      action: item.selected ? "PLAY" : "SKIP",
      reasons: item.skipReasons || [],
      evidence: {
        league: item.league,
        odds: item.odds,
        edge: item.edge,
        confidence: item.confidence,
        priorityScore: item.priorityScore,
        verifiedCoverage: item.verifiedCoverage,
        contextImpact: item.contextImpact,
        generatedAt: now.toISOString(),
        paperOnly: true
      }
    });
  }
  if (!rows.length) return;
  const { error } = await admin.from("autonomous_agent_v12_audit").insert(rows);
  if (error) throw error;
}

async function processUser(admin, origin, userId, systemHealth, globalBudget, now) {
  let runId = null;
  try {
    const context = await loadUserContext(admin, userId, now);
    runId = await createRun(admin, userId, context.settings.sports, now);
    if (!context.settings.enabled) throw new Error("Autonomous Agent is disabled");
    const learning = buildAutonomousV12LearningReport({
      history: context.history,
      calibration: [...historyCalibration(context.history), ...systemHealth.calibrationRows],
      now
    });
    let circuit = evaluateAutonomousV12CircuitBreakers({
      learning,
      system: {
        ...systemHealth,
        killSwitch: context.controls.kill_switch,
        paperTradingMode: context.bankroll.paper_trading_mode,
        settlementBacklog: context.settlementBacklog
      },
      bankroll: context.bankroll,
      todayRows: context.todayRows,
      openBets: context.openBets
    });
    circuit = applyAutonomousV12UserCircuitControls({
      circuit,
      controls: context.controls,
      learning,
      bankroll: context.bankroll,
      todayRows: context.todayRows
    });
    let policy = buildAutonomousV12Policy({
      settings: context.settings,
      bankroll: context.bankroll,
      learning,
      circuit
    });
    policy = applyAutonomyLevel(policy, context.controls);

    let source = { picks: [], source: "unavailable", fixtureSource: "unavailable" };
    let sourceError = null;
    if (!circuit.paused) {
      try {
        source = await loadTopPicks(origin, context.settings.sports);
      } catch (error) {
        sourceError = error;
        circuit.paused = true;
        circuit.state = "PAUSED";
        circuit.reasons = [...new Set([...(circuit.reasons || []), "top_picks_unavailable"])];
        policy = { ...policy, state: "PAUSED", maxPicks: 0, riskScale: 0, maxStakePercent: 0 };
      }
    }

    const choice = selectAutonomousV12Picks({
      picks: source.picks,
      policy,
      bankroll: context.bankroll,
      openBets: context.openBets,
      todayRows: context.todayRows
    });
    const selected = choice.selected.slice(0, Math.max(0, globalBudget));
    let savedCount = 0;
    let duplicateCount = 0;
    let riskRejectedCount = 0;
    let saveErrorCount = 0;
    let totalStake = 0;
    for (const pick of selected) {
      const saved = await savePaperPick(admin, paperRow(userId, runId, pick, source.source, source.fixtureSource, learning, policy, circuit, now));
      if (saved.saved) {
        savedCount += 1;
        totalStake += finite(pick.autonomousStake);
      } else if (saved.duplicate) duplicateCount += 1;
      else if (saved.riskRejected) riskRejectedCount += 1;
      else saveErrorCount += 1;
    }

    const status = sourceError || saveErrorCount ? "error" : circuit.paused || policy.state === "LEARNING" ? "paused" : "success";
    const result = {
      status,
      runId,
      candidateCount: source.picks.length,
      selectedCount: selected.length,
      savedCount,
      skippedCount: choice.skipped.length + duplicateCount + riskRejectedCount + Math.max(0, choice.selected.length - selected.length),
      totalStake: round(totalStake, 2),
      error: sourceError ? text(sourceError.message, 500) : saveErrorCount ? `${saveErrorCount} paper picks could not be saved` : null
    };
    const operatingState = status === "error" ? "ERROR" : policy.state === "LEARNING" ? "LEARNING" : circuit.state;
    const summary = {
      paperOnly: true,
      realMoneyBetting: false,
      agentVersion: "Autonomous-Scorecaster-V12",
      operatingState,
      source: source.source,
      fixtureSource: source.fixtureSource,
      systemHealth: {
        providerScore: systemHealth.providerScore,
        staleRate: systemHealth.staleRate,
        captureAgeMinutes: systemHealth.captureAgeMinutes,
        unifiedDataMigrationActive: systemHealth.unifiedDataMigrationActive,
        calibrationAvailable: systemHealth.calibrationAvailable
      },
      learning,
      policy,
      circuit,
      duplicates: duplicateCount,
      riskRejected: riskRejectedCount,
      decisions: choice.audit.slice(0, MAX_AUDIT_ROWS_PER_USER)
    };

    await Promise.all([
      storeLearning(admin, userId, learning, policy, context.controls),
      storeAudit(admin, userId, runId, choice.audit, circuit, now)
    ]);
    await storeV12State(admin, userId, {
      operatingState,
      policy,
      circuit,
      learning,
      audit: { source: source.source, decisions: choice.audit.slice(0, 30) },
      now: now.toISOString(),
      savedCount
    });
    await finishRun(admin, runId, result, summary, now);
    await completeLegacyState(admin, userId, result);
    const nextCheckAt = nextAutonomousV12Check({ result, circuit, learning, now });
    await scheduleNextCheck(admin, userId, nextCheckAt, result.status, result.error);
    return { userId, ...result, operatingState, nextCheckAt };
  } catch (error) {
    const result = {
      status: "error",
      runId,
      candidateCount: 0,
      selectedCount: 0,
      savedCount: 0,
      skippedCount: 0,
      totalStake: 0,
      error: text(error?.message, 500, "Autonomous Scorecaster V12 failed")
    };
    if (runId) {
      try {
        await finishRun(admin, runId, result, {
          paperOnly: true,
          realMoneyBetting: false,
          agentVersion: "Autonomous-Scorecaster-V12",
          failureStage: "user_processing"
        }, now);
      } catch {
        // State completion remains the retry authority.
      }
    }
    try {
      await completeLegacyState(admin, userId, result);
      await scheduleNextCheck(admin, userId, new Date(now.getTime() + 60 * 60_000).toISOString(), "error", result.error);
    } catch {
      // The route surfaces the bounded aggregate failure.
    }
    return { userId, ...result, operatingState: "ERROR" };
  }
}

export async function runAutonomousScorecasterV12({ admin, origin, now = new Date() } = {}) {
  if (!admin) throw new Error("Autonomous Scorecaster V12 requires a Supabase admin client");
  if (!origin) throw new Error("Autonomous Scorecaster V12 requires a request origin");
  const clock = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(clock.getTime())) throw new Error("Autonomous Scorecaster V12 requires a valid clock");

  const systemHealth = await loadSystemHealth(origin);
  const userIds = await claimUsers(admin);
  const results = [];
  let remainingBudget = MAX_SAVED_PICKS_PER_RUN;
  for (const userId of userIds) {
    const result = await processUser(admin, origin, userId, systemHealth, remainingBudget, clock);
    remainingBudget = Math.max(0, remainingBudget - result.savedCount);
    results.push(result);
  }

  return {
    ok: true,
    version: "autonomous-scorecaster-v12-worker-v1",
    paperOnly: true,
    realMoneyBetting: false,
    productionProbabilityChanged: false,
    automaticRiskRelaxation: false,
    claimedUsers: userIds.length,
    processedUsers: results.length,
    runningUsers: results.filter((row) => row.operatingState === "RUNNING").length,
    cautionUsers: results.filter((row) => row.operatingState === "CAUTION").length,
    pausedUsers: results.filter((row) => ["PAUSED", "LEARNING"].includes(row.operatingState)).length,
    errorUsers: results.filter((row) => row.operatingState === "ERROR").length,
    candidates: results.reduce((sum, row) => sum + row.candidateCount, 0),
    selected: results.reduce((sum, row) => sum + row.selectedCount, 0),
    savedPaperPicks: results.reduce((sum, row) => sum + row.savedCount, 0),
    totalVirtualStake: round(results.reduce((sum, row) => sum + row.totalStake, 0), 2),
    systemHealth: {
      providerScore: systemHealth.providerScore,
      staleRate: systemHealth.staleRate,
      captureAgeMinutes: systemHealth.captureAgeMinutes,
      unifiedDataMigrationActive: systemHealth.unifiedDataMigrationActive,
      calibrationAvailable: systemHealth.calibrationAvailable
    },
    limits: {
      usersPerRun: MAX_USERS_PER_RUN,
      historyRowsPerUser: MAX_HISTORY_ROWS,
      openRowsPerUser: MAX_OPEN_ROWS,
      auditRowsPerUser: MAX_AUDIT_ROWS_PER_USER,
      savedPicksPerRun: MAX_SAVED_PICKS_PER_RUN
    },
    generatedAt: clock.toISOString()
  };
}
