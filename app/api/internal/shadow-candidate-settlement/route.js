import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { fetchRecentLeagueResults } from "../../../../lib/results-provider.js";
import { namesMatch } from "../../../../lib/results-normalizer.js";
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
const MAX_CANDIDATES = 1000;
const SETTLEMENT_RPC_BATCH_SIZE = 100;
const RETRY_AFTER_HOURS = 2;
const response = (body, status = 200) => Response.json(body, { status, headers: HEADERS });

function clean(value, maximum = 240) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function parseMatch(value) {
  const parts = clean(value, 320).split(/\s+vs\s+/i).map((item) => clean(item, 160)).filter(Boolean);
  return parts.length === 2 ? { homeTeam: parts[0], awayTeam: parts[1] } : { homeTeam: "", awayTeam: "" };
}

function eventDateMs(result) {
  const parsed = Date.parse(`${clean(result?.date, 20)}T12:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function resultWindow(candidate, commenceTime) {
  const created = Date.parse(candidate.created_at || "");
  const commence = Date.parse(commenceTime || "");
  if (Number.isFinite(commence)) {
    return { anchor: commence, earliest: commence - 2 * 86400000, latest: commence + 2 * 86400000 };
  }
  if (Number.isFinite(created)) {
    return { anchor: created + 2 * 86400000, earliest: created - 86400000, latest: created + 8 * 86400000 };
  }
  return { anchor: Date.now(), earliest: 0, latest: Number.MAX_SAFE_INTEGER };
}

function findResult(candidate, results, commenceTime) {
  const teams = parseMatch(candidate.match);
  if (!teams.homeTeam || !teams.awayTeam) return null;
  const window = resultWindow(candidate, commenceTime);
  return (Array.isArray(results) ? results : [])
    .filter((item) => namesMatch(item.home_team, teams.homeTeam) && namesMatch(item.away_team, teams.awayTeam))
    .map((item) => ({ item, time: eventDateMs(item) }))
    .filter((entry) => entry.time !== null && entry.time >= window.earliest && entry.time <= window.latest)
    .sort((left, right) => Math.abs(left.time - window.anchor) - Math.abs(right.time - window.anchor))[0]?.item || null;
}

function settleH2h(candidate, result) {
  const homeScore = finite(result?.home_score);
  const awayScore = finite(result?.away_score);
  if (homeScore === null || awayScore === null) return null;
  const teams = parseMatch(candidate.match);
  const selection = clean(candidate.selection, 160);
  const drawSelection = /^(draw|tie|x)$/i.test(selection);
  let won = null;

  if (namesMatch(selection, teams.homeTeam)) won = homeScore > awayScore;
  else if (namesMatch(selection, teams.awayTeam)) won = awayScore > homeScore;
  else if (drawSelection) won = homeScore === awayScore;
  else return null;

  return { result: won ? "win" : "loss", outcomeValue: won ? 1 : 0 };
}

function rowsByEvent(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.event_id)) map.set(row.event_id, []);
    map.get(row.event_id).push(row);
  }
  return map;
}

function candidateCommence(candidate, eventRows) {
  const direct = candidate.commence_time ? new Date(candidate.commence_time) : null;
  if (direct && Number.isFinite(direct.getTime())) return direct.toISOString();
  const snapshot = eventRows?.[0]?.commence_time ? new Date(eventRows[0].commence_time) : null;
  return snapshot && Number.isFinite(snapshot.getTime()) ? snapshot.toISOString() : null;
}

function closingEvidence(candidate, eventRows, commenceTime) {
  if (!eventRows?.length || !commenceTime || Date.now() < Date.parse(commenceTime)) return null;
  try {
    const analysis = buildMarketMicrostructure(eventRows, {
      eventId: candidate.event_id,
      market: candidate.market || "h2h",
      selection: candidate.selection,
      generatedAt: new Date(Math.max(Date.now(), Date.parse(commenceTime) + 1000)).toISOString()
    });
    const selected = analysis.selections?.find((item) =>
      clean(item.selection, 160).toLowerCase() === clean(candidate.selection, 160).toLowerCase()
    );
    if (!selected?.closing) return null;
    const probability = finite(selected.closing.probability);
    const providerCount = Math.max(0, Number(selected.closing.providerCount || 0));
    if (probability === null || probability <= 0 || probability >= 1 || providerCount < 2) return null;
    const timeline = Array.isArray(selected.timeline) ? selected.timeline : [];
    return {
      probability,
      fairOdds: 1 / probability,
      providerCount,
      capturedAt: timeline.at(-1)?.capturedAt || null
    };
  } catch {
    return null;
  }
}

async function loadCandidates(admin) {
  const retryBefore = new Date(Date.now() - RETRY_AFTER_HOURS * 3600000).toISOString();
  const { data, error } = await admin
    .from("autonomous_agent_decision_audit")
    .select("id,user_id,event_id,match,selection,sport,league,market,odds,edge,model_probability,entry_market_probability,commence_time,created_at,last_settlement_attempt_at,settlement_attempts")
    .eq("settlement_status", "open")
    .not("event_id", "is", null)
    .not("model_probability", "is", null)
    .or(`last_settlement_attempt_at.is.null,last_settlement_attempt_at.lt.${retryBefore}`)
    .order("created_at", { ascending: true })
    .limit(MAX_CANDIDATES);
  if (error) throw error;
  return data || [];
}

async function loadMarketRows(admin, eventIds) {
  const rows = [];
  for (let index = 0; index < eventIds.length; index += 100) {
    const { data, error } = await admin
      .from("market_provider_snapshots_v2")
      .select("event_id,sport,league,commence_time,market,selection,point,bookmaker_key,bookmaker_title,price,implied_probability,normalized_probability,market_overround,provider_last_update,captured_at,source_id,source_reference")
      .in("event_id", eventIds.slice(index, index + 100))
      .order("captured_at", { ascending: true })
      .limit(20000);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

async function loadResultGroups(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const key = `${clean(candidate.sport, 120)}|${clean(candidate.league, 160)}`;
    if (!groups.has(key)) groups.set(key, { sport: candidate.sport, league: candidate.league, results: [], ok: false, mode: null });
  }
  await Promise.all([...groups.entries()].map(async ([key, group]) => {
    try {
      const payload = await fetchRecentLeagueResults({ sportKey: group.sport, league: group.league });
      groups.set(key, {
        ...group,
        ok: payload.ok === true,
        mode: payload.mode || null,
        source: payload.source || null,
        results: Array.isArray(payload.results) ? payload.results : []
      });
    } catch {
      groups.set(key, { ...group, ok: false, mode: "provider-error", results: [] });
    }
  }));
  return groups;
}

async function createRun(admin, id, startedAt) {
  const { error } = await admin.from("shadow_candidate_settlement_runs_v1").insert({ id, started_at: startedAt, status: "running", paper_only: true });
  if (error) throw error;
}

async function finishRun(admin, id, changes) {
  const { error } = await admin.from("shadow_candidate_settlement_runs_v1").update(changes).eq("id", id);
  if (error) throw error;
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "CRON_SECRET is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);

  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  let runCreated = false;

  try {
    await createRun(admin, runId, startedAt);
    runCreated = true;
    const candidates = await loadCandidates(admin);
    if (!candidates.length) {
      const completedAt = new Date().toISOString();
      await finishRun(admin, runId, { completed_at: completedAt, status: "success" });
      return response({
        ok: true,
        version: "scorecaster-shadow-candidate-settlement-v1",
        status: "success",
        runId,
        candidatesSeen: 0,
        settled: 0,
        pending: 0,
        excluded: 0,
        closingAttached: 0,
        paperOnly: true,
        realMoneyExecution: false,
        productionProbabilityChanged: false,
        completedAt
      });
    }

    const eventIds = [...new Set(candidates.map((item) => item.event_id).filter(Boolean))];
    const marketRows = await loadMarketRows(admin, eventIds);
    const marketMap = rowsByEvent(marketRows);
    const resultGroups = await loadResultGroups(candidates);
    const updates = [];
    const diagnostics = [];
    let settled = 0;
    let pending = 0;
    let excluded = 0;
    let closingAttached = 0;
    let providerWarnings = 0;

    for (const candidate of candidates) {
      const eventRows = marketMap.get(candidate.event_id) || [];
      const commenceTime = candidateCommence(candidate, eventRows);
      const groupKey = `${clean(candidate.sport, 120)}|${clean(candidate.league, 160)}`;
      const group = resultGroups.get(groupKey);
      if (!group?.ok) providerWarnings += 1;
      const market = clean(candidate.market || "h2h", 40).toLowerCase();
      const matchedResult = group?.ok ? findResult(candidate, group.results, commenceTime) : null;
      const outcome = market === "h2h" && matchedResult ? settleH2h(candidate, matchedResult) : null;
      const close = closingEvidence(candidate, eventRows, commenceTime);
      const modelProbability = finite(candidate.model_probability);
      const entryMarketProbability = finite(candidate.entry_market_probability);
      const entryOdds = finite(candidate.odds);

      if (close) closingAttached += 1;

      if (market !== "h2h") {
        excluded += 1;
        updates.push({
          id: candidate.id,
          settlement_status: "excluded",
          result: null,
          outcome_value: null,
          commence_time: commenceTime,
          settled_at: null,
          closing_consensus_probability: close?.probability ?? null,
          closing_fair_odds: close?.fairOdds ?? null,
          closing_provider_count: close?.providerCount ?? 0,
          closing_captured_at: close?.capturedAt ?? null,
          price_clv: close && entryOdds ? priceClv(entryOdds, close.probability)?.value ?? null : null,
          probability_clv: close && entryMarketProbability ? probabilityClv(entryMarketProbability, close.probability)?.value ?? null : null,
          brier_score: null,
          log_loss: null,
          result_source: null,
          exclusion_reason: "unsupported-shadow-market"
        });
        continue;
      }

      if (!matchedResult || !outcome) {
        pending += 1;
        updates.push({
          id: candidate.id,
          settlement_status: "open",
          result: null,
          outcome_value: null,
          commence_time: commenceTime,
          settled_at: null,
          closing_consensus_probability: close?.probability ?? null,
          closing_fair_odds: close?.fairOdds ?? null,
          closing_provider_count: close?.providerCount ?? 0,
          closing_captured_at: close?.capturedAt ?? null,
          price_clv: close && entryOdds ? priceClv(entryOdds, close.probability)?.value ?? null : null,
          probability_clv: close && entryMarketProbability ? probabilityClv(entryMarketProbability, close.probability)?.value ?? null : null,
          brier_score: null,
          log_loss: null,
          result_source: null,
          exclusion_reason: matchedResult ? "unmatched-selection" : null
        });
        continue;
      }

      settled += 1;
      updates.push({
        id: candidate.id,
        settlement_status: "settled",
        result: outcome.result,
        outcome_value: outcome.outcomeValue,
        commence_time: commenceTime,
        settled_at: new Date().toISOString(),
        closing_consensus_probability: close?.probability ?? null,
        closing_fair_odds: close?.fairOdds ?? null,
        closing_provider_count: close?.providerCount ?? 0,
        closing_captured_at: close?.capturedAt ?? null,
        price_clv: close && entryOdds ? priceClv(entryOdds, close.probability)?.value ?? null : null,
        probability_clv: close && entryMarketProbability ? probabilityClv(entryMarketProbability, close.probability)?.value ?? null : null,
        brier_score: modelProbability === null ? null : binaryBrierScore(modelProbability, outcome.outcomeValue),
        log_loss: modelProbability === null ? null : binaryLogLoss(modelProbability, outcome.outcomeValue),
        result_source: group?.source || "thesportsdb",
        exclusion_reason: null
      });
    }

    if (updates.length) {
      for (let index = 0; index < updates.length; index += SETTLEMENT_RPC_BATCH_SIZE) {
        const batch = updates.slice(index, index + SETTLEMENT_RPC_BATCH_SIZE);
        const { error } = await admin.rpc("apply_shadow_candidate_settlements_v1", { p_rows: batch });
        if (error) throw error;
      }
    }

    for (const [key, group] of resultGroups) {
      if (!group.ok) diagnostics.push({ group: key, mode: group.mode || "provider-error" });
    }
    const status = excluded || diagnostics.length ? "partial" : "success";
    const completedAt = new Date().toISOString();
    await finishRun(admin, runId, {
      completed_at: completedAt,
      status,
      candidates_seen: candidates.length,
      settled_count: settled,
      pending_count: pending,
      excluded_count: excluded,
      closing_count: closingAttached,
      provider_warning_count: providerWarnings,
      diagnostics: diagnostics.slice(0, 100)
    });

    return response({
      ok: true,
      version: "scorecaster-shadow-candidate-settlement-v1",
      status,
      runId,
      candidatesSeen: candidates.length,
      settled,
      pending,
      excluded,
      closingAttached,
      settlementBatchSize: SETTLEMENT_RPC_BATCH_SIZE,
      providerWarnings,
      resultSource: "thesportsdb-verified-team-match",
      closingSource: "market-provider-snapshots-v2-final-prestart-consensus",
      counterfactualProfitCalculated: false,
      automaticModelPromotion: false,
      paperOnly: true,
      realMoneyExecution: false,
      productionProbabilityChanged: false,
      completedAt
    });
  } catch (error) {
    if (runCreated) {
      await finishRun(admin, runId, {
        completed_at: new Date().toISOString(),
        status: "failed",
        diagnostics: [{ error: "shadow-candidate-settlement-failed" }]
      }).catch(() => null);
    }
    return response({
      ok: false,
      version: "scorecaster-shadow-candidate-settlement-v1",
      error: process.env.NODE_ENV === "production" ? "Shadow candidate settlement failed" : String(error?.message || error),
      paperOnly: true,
      realMoneyExecution: false
    }, 500);
  }
}
