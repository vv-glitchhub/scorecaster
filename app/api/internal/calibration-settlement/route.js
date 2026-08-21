import { createHash, randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { resolveCalibrationSettlementActivation } from "../../../../lib/calibration-settlement-activation.mjs";
import {
  binaryBrierScore,
  binaryLogLoss,
  priceClv,
  probabilityClv
} from "../../../../lib/calibration-lab-v1.mjs";
import { buildMarketMicrostructure } from "../../../../lib/market-microstructure-v2.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const response = (body, status = 200) => Response.json(body, { status, headers: HEADERS });
const clean = (value, maximum = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function deterministicUuid(value) {
  const hex = createHash("sha256").update(String(value)).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

function rawPick(bet) {
  return bet?.raw_pick && typeof bet.raw_pick === "object" ? bet.raw_pick : {};
}

function eventId(bet) {
  const raw = rawPick(bet);
  return clean(raw.eventId ?? raw.event_id, 180);
}

function outcomeValue(status) {
  if (status === "won") return 1;
  if (status === "lost") return 0;
  return null;
}

function missingPatch(error) {
  return error?.code === "42P01" || /calibration_(observations|settlement_runs)_v1|market_provider_snapshots_v2|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

async function createRun(admin, id, startedAt) {
  const { error } = await admin.from("calibration_settlement_runs_v1").insert({
    id,
    started_at: startedAt,
    status: "running",
    paper_only: true
  });
  if (error) throw error;
}

async function finishRun(admin, id, changes) {
  const { error } = await admin.from("calibration_settlement_runs_v1").update(changes).eq("id", id);
  if (error) throw error;
}

async function loadSettledBets(admin) {
  const { data, error } = await admin
    .from("bets")
    .select("id,user_id,label,match,market,bookmaker,sport,league,odds,stake,status,result,profit,raw_pick,created_at,updated_at")
    .in("status", ["won", "lost", "void", "push"])
    .order("updated_at", { ascending: true })
    .limit(1000);
  if (error) throw error;
  return data || [];
}

async function existingBetIds(admin, ids) {
  if (!ids.length) return new Set();
  const found = [];
  for (let index = 0; index < ids.length; index += 500) {
    const { data, error } = await admin
      .from("calibration_observations_v1")
      .select("bet_id")
      .in("bet_id", ids.slice(index, index + 500));
    if (error) throw error;
    found.push(...(data || []));
  }
  return new Set(found.map((row) => row.bet_id));
}

async function loadMarketRows(admin, eventIds) {
  const rows = [];
  for (let index = 0; index < eventIds.length; index += 100) {
    const { data, error } = await admin
      .from("market_provider_snapshots_v2")
      .select("id,capture_id,event_id,sport,league,commence_time,market,selection,point,bookmaker_key,bookmaker_title,price,implied_probability,normalized_probability,market_overround,provider_last_update,captured_at,source_id,source_reference")
      .in("event_id", eventIds.slice(index, index + 100))
      .order("captured_at", { ascending: true })
      .limit(20000);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

function rowsByEvent(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.event_id)) map.set(row.event_id, []);
    map.get(row.event_id).push(row);
  }
  return map;
}

function exclusionFor({ bet, raw, event, close, commenceTime, modelProbability, entryMarketProbability, outcome }) {
  if (!event) return "missing-event-id";
  if (!String(raw.source || "").startsWith("scorecaster")) return "unverified-entry-source";
  if (!commenceTime) return "missing-kickoff";
  if (Date.parse(bet.created_at) >= Date.parse(commenceTime)) return "entry-at-or-after-kickoff";
  if (outcome === null) return "void-or-push-settlement";
  if (modelProbability === null || modelProbability <= 0 || modelProbability >= 1) return "missing-model-probability";
  if (entryMarketProbability === null || entryMarketProbability <= 0 || entryMarketProbability >= 1) return "missing-entry-market-probability";
  if (!close) return "missing-closing-selection";
  if (!close.closing) return "missing-eligible-closing-consensus";
  if (Number(close.closing.providerCount || 0) < 2) return "insufficient-closing-provider-coverage";
  if (!close.closing.probability || !close.closing.averagePrice) return "incomplete-closing-consensus";
  return null;
}

function observationFromBet(bet, eventRows) {
  const raw = rawPick(bet);
  const event = eventId(bet);
  const market = clean(bet.market || "h2h", 80).toLowerCase();
  const selection = clean(bet.label, 160);
  const modelProbability = finite(raw.modelProbability ?? raw.model_probability);
  const entryMarketProbability = finite(raw.entryMarketProbability ?? raw.impliedProbability ?? raw.entry_market_probability);
  const outcome = outcomeValue(clean(bet.status, 20).toLowerCase());
  const commenceTime = iso(eventRows?.[0]?.commence_time);
  let selectionEvidence = null;

  if (event && eventRows?.length && commenceTime && Date.now() >= Date.parse(commenceTime)) {
    const analysis = buildMarketMicrostructure(eventRows, {
      eventId: event,
      market,
      selection,
      generatedAt: new Date(Math.max(Date.now(), Date.parse(commenceTime) + 1000)).toISOString()
    });
    selectionEvidence = analysis.selections?.find((item) => item.selection.toLowerCase() === selection.toLowerCase()) || null;
  }

  const exclusionReason = exclusionFor({
    bet,
    raw,
    event,
    close: selectionEvidence,
    commenceTime,
    modelProbability,
    entryMarketProbability,
    outcome
  });
  const closingProbability = exclusionReason ? null : finite(selectionEvidence.closing.probability);
  const closingFairOdds = closingProbability ? 1 / closingProbability : null;
  const entryOdds = finite(bet.odds);
  const price = exclusionReason ? null : priceClv(entryOdds, closingProbability);
  const probability = exclusionReason ? null : probabilityClv(entryMarketProbability, closingProbability);
  const timeline = selectionEvidence?.timeline || [];
  const closingCapturedAt = exclusionReason ? null : timeline.at(-1)?.capturedAt || null;

  return {
    id: deterministicUuid(`calibration-v1|${bet.id}`),
    user_id: bet.user_id,
    bet_id: bet.id,
    event_id: event || `missing:${bet.id}`,
    sport: clean(bet.sport, 100) || "unknown",
    league: clean(bet.league, 140) || null,
    market: market || "h2h",
    selection: selection || "unknown",
    bookmaker: clean(bet.bookmaker, 120) || null,
    decision: clean(raw.decision, 30).toUpperCase() || null,
    model_version: clean(raw.modelVersion ?? raw.model_version ?? raw.agentVersion, 120) || "unknown",
    entry_odds: entryOdds,
    entry_market_probability: entryMarketProbability,
    model_probability: modelProbability,
    closing_consensus_probability: closingProbability,
    closing_fair_odds: closingFairOdds,
    closing_provider_count: exclusionReason ? 0 : Number(selectionEvidence.closing.providerCount || 0),
    closing_captured_at: closingCapturedAt,
    commence_time: commenceTime || new Date(Math.max(Date.now() + 1000, Date.parse(bet.created_at) + 1000)).toISOString(),
    bet_created_at: bet.created_at,
    settled_at: bet.updated_at,
    status: clean(bet.status, 20).toLowerCase(),
    outcome_value: outcome,
    stake: Math.max(0, finite(bet.stake) ?? 0),
    profit: finite(bet.profit),
    price_clv: price?.value ?? null,
    probability_clv: probability?.value ?? null,
    brier_score: exclusionReason ? null : binaryBrierScore(modelProbability, outcome),
    log_loss: exclusionReason ? null : binaryLogLoss(modelProbability, outcome),
    exclusion_reason: exclusionReason,
    evidence_version: "scorecaster-calibration-lab-v1",
    source_id: "market-microstructure-v2",
    paper_only: true
  };
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "CRON_SECRET is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);

  const activation = resolveCalibrationSettlementActivation();
  if (!activation.enabled) {
    return response({
      ok: true,
      version: "scorecaster-calibration-settlement-v1",
      status: "disabled",
      reason: activation.mode,
      activationMode: activation.mode,
      emergencyStopAvailable: activation.emergencyStopAvailable,
      simulatedClosingUsed: false,
      paperOnly: true
    });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  let runCreated = false;

  try {
    await createRun(admin, runId, startedAt);
    runCreated = true;
    const settled = await loadSettledBets(admin);
    const existing = await existingBetIds(admin, settled.map((bet) => bet.id));
    const pending = settled.filter((bet) => !existing.has(bet.id));
    const eventIds = [...new Set(pending.map(eventId).filter(Boolean))];
    const marketRows = await loadMarketRows(admin, eventIds);
    const marketMap = rowsByEvent(marketRows);
    const observations = pending.map((bet) => observationFromBet(bet, marketMap.get(eventId(bet)) || []));

    let inserted = [];
    if (observations.length) {
      const { data, error } = await admin
        .from("calibration_observations_v1")
        .upsert(observations, { onConflict: "bet_id", ignoreDuplicates: true })
        .select("id,bet_id,exclusion_reason");
      if (error) throw error;
      inserted = data || [];
    }

    const exclusions = inserted.filter((row) => row.exclusion_reason).length;
    const eligible = inserted.length - exclusions;
    const status = pending.length && !inserted.length ? "failed" : exclusions ? "partial" : "success";
    const completedAt = new Date().toISOString();
    await finishRun(admin, runId, {
      completed_at: completedAt,
      status,
      settled_bets_seen: settled.length,
      observations_written: eligible,
      exclusions_written: exclusions,
      duplicate_count: existing.size,
      diagnostics: observations.filter((item) => item.exclusion_reason).slice(0, 100).map((item) => ({ betId: item.bet_id, reason: item.exclusion_reason }))
    });

    return response({
      ok: status !== "failed",
      version: "scorecaster-calibration-settlement-v1",
      runId,
      startedAt,
      completedAt,
      status,
      activationMode: activation.mode,
      emergencyStopAvailable: activation.emergencyStopAvailable,
      settledBetsSeen: settled.length,
      pending: pending.length,
      eligibleObservationsWritten: eligible,
      exclusionsWritten: exclusions,
      duplicates: existing.size,
      closingSource: "market-provider-snapshots-v2-final-prestart-consensus",
      manuallyEnteredClosingOddsUsed: false,
      currentOddsFallbackUsed: false,
      simulatedClosingUsed: false,
      automaticModelPromotion: false,
      rawProviderPayloadStored: false,
      realMoneyExecution: false,
      paperOnly: true
    }, status === "failed" ? 503 : 200);
  } catch (error) {
    if (runCreated) {
      await finishRun(admin, runId, {
        completed_at: new Date().toISOString(),
        status: "failed",
        diagnostics: [{ error: missingPatch(error) ? "production-patch-missing" : "settlement-failed" }]
      }).catch(() => null);
    }
    return response({
      ok: false,
      version: "scorecaster-calibration-settlement-v1",
      error: missingPatch(error)
        ? "Calibration Lab or Market Microstructure production patch is not active"
        : process.env.NODE_ENV === "production" ? "Calibration settlement failed" : String(error),
      requiredPatches: missingPatch(error)
        ? ["scripts/apply-market-microstructure-v2.sql", "scripts/apply-calibration-lab-v1.sql"]
        : undefined,
      activationMode: activation.mode,
      emergencyStopAvailable: activation.emergencyStopAvailable,
      paperOnly: true
    }, missingPatch(error) ? 503 : 500);
  }
}
