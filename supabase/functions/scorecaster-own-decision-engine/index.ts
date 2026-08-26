import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CHAMPION_ID = "scorecaster-own-football-baseline";
const CHALLENGER_ID = "scorecaster-own-football-ml";
const VERSION = "scorecaster-own-decision-engine-v1";
const OUTCOMES = ["home", "draw", "away"] as const;
const finite = (v: unknown, fallback: number | null = null) => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const teamKey = (v: unknown) => String(v || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function bucket(date = new Date(), minutes = 30) { const d = new Date(date); d.setUTCMinutes(Math.floor(d.getUTCMinutes() / minutes) * minutes, 0, 0); return d.toISOString(); }
async function hash(value: unknown) { const b = new TextEncoder().encode(JSON.stringify(value)); const h = await crypto.subtle.digest("SHA-256", b); return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, "0")).join(""); }
function validP(p: any) { const vals = OUTCOMES.map(k => finite(p?.[k])); return vals.every(v => v !== null && v! >= 0 && v! <= 1) && Math.abs(vals.reduce((s, v) => s + Number(v), 0) - 1) < 0.02; }
function selection(probabilities: any) { return OUTCOMES.reduce((best, k) => probabilities[k] > probabilities[best] ? k : best, "home" as typeof OUTCOMES[number]); }
function confidence(probabilities: any) { const sorted = OUTCOMES.map(k => Number(probabilities[k])).sort((a, b) => b - a); return clamp(0.65 * sorted[0] + 0.35 * (sorted[0] - sorted[1])); }
function maxGap(left: any, right: any) { return validP(left) && validP(right) ? Math.max(...OUTCOMES.map(k => Math.abs(Number(left[k]) - Number(right[k])))) : null; }
async function fetchRows(admin: any, table: string, select: string, configure: (q: any) => any, max = 3000) { const rows: any[] = []; for (let from = 0; from < max; from += 1000) { let q = admin.from(table).select(select).range(from, from + 999); q = configure(q); const { data, error } = await q; if (error) throw error; rows.push(...(data || [])); if (!data || data.length < 1000) break; } return rows; }
function latestBy(rows: any[], keyFn: (r: any) => string) { const map = new Map<string, any>(); for (const row of rows) { const key = keyFn(row); if (key && !map.has(key)) map.set(key, row); } return map; }
function expectedSelection(outcome: string, fixture: any) { return outcome === "draw" ? "draw" : teamKey(outcome === "home" ? fixture.home_team : fixture.away_team); }

Deno.serve(async req => {
  if (req.method !== "POST") return Response.json({ ok: false, error: "POST required" }, { status: 405 });
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return Response.json({ ok: false, error: "Supabase environment unavailable" }, { status: 503 });
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const presented = req.headers.get("x-scorecaster-cron-token") || "";
  const { data: auth } = await admin.from("scorecaster_internal_secrets_v1").select("secret_value").eq("name", "own_decision_engine_cron").single();
  if (!presented || presented !== auth?.secret_value) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const now = new Date(), asOf = now.toISOString(), asOfBucket = bucket(now), futureEnd = new Date(now.getTime() + 14 * 86400000).toISOString();
  try {
    const [fixtures, championRows, challengerRows, identityRows, artifactResult] = await Promise.all([
      fetchRows(admin, "scorecaster_event_outcomes_v1", "event_id,sport_key,league,home_team,away_team,commence_time,status", q => q.in("status", ["scheduled", "unknown"]).gte("commence_time", asOf).lte("commence_time", futureEnd).order("commence_time", { ascending: true }), 5000),
      fetchRows(admin, "scorecaster_model_predictions_v1", "event_id,as_of,model_id,model_version,probabilities,expected_scores,training_data_hash,prediction_hash,independent_from_market,shadow_only", q => q.eq("model_id", CHAMPION_ID).order("as_of", { ascending: false }), 3000),
      fetchRows(admin, "scorecaster_model_predictions_v1", "event_id,as_of,model_id,model_version,probabilities,expected_scores,training_data_hash,prediction_hash,independent_from_market,shadow_only", q => q.eq("model_id", CHALLENGER_ID).order("as_of", { ascending: false }), 3000),
      fetchRows(admin, "scorecaster_event_identity_map_v1", "canonical_event_id,source_id,source_event_id,match_confidence,verified,lineage,updated_at", q => q.eq("verified", true).order("updated_at", { ascending: false }), 3000),
      admin.from("scorecaster_model_artifacts_v1").select("model_version,promotion_gate,artifact_hash,trained_at").eq("model_id", CHALLENGER_ID).order("trained_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (artifactResult.error) throw artifactResult.error;
    const champions = latestBy(championRows, r => r.event_id);
    const challengers = latestBy(challengerRows, r => r.event_id);
    const identities = latestBy(identityRows, r => r.canonical_event_id);
    const sourceEventIds = [...new Set(identityRows.map(r => r.source_event_id).filter(Boolean))];
    const marketRows = sourceEventIds.length ? await fetchRows(admin, "collector_records", "source_id,event_id,metric,value,payload,collected_at", q => q.in("event_id", sourceEventIds).in("metric", ["event_snapshot", "market_probability", "best_odds"]).order("collected_at", { ascending: false }), 9000) : [];
    const marketLatest = latestBy(marketRows, r => `${r.event_id}:${r.metric}`);
    const challengerGate = artifactResult.data?.promotion_gate || {};
    const challengerTrusted = challengerGate?.ownBaselineReviewCandidate === true;
    const rows: any[] = [];
    const samples: any[] = [];

    for (const fixture of fixtures) {
      const champion = champions.get(fixture.event_id);
      if (!champion || !validP(champion.probabilities)) continue;
      const challenger = challengers.get(fixture.event_id) || null;
      const picked = selection(champion.probabilities);
      const fairP = Number(champion.probabilities[picked]);
      const fairOdds = fairP > 0 ? 1 / fairP : null;
      const conf = confidence(champion.probabilities);
      const gap = challenger && validP(challenger.probabilities) ? maxGap(champion.probabilities, challenger.probabilities) : null;
      const reasons: string[] = ["scorecaster-owned-baseline-ready", "market-not-used-by-champion"];
      let decision = "OWN_PREDICTION_READY";
      const sorted = OUTCOMES.map(k => Number(champion.probabilities[k])).sort((a, b) => b - a);
      const margin = sorted[0] - sorted[1];
      if (fairP < 0.42 || margin < 0.07) { decision = "OWN_PREDICTION_CAUTION"; reasons.push("low-separation"); }
      if (challenger) {
        reasons.push(challengerTrusted ? "challenger-review-candidate" : "challenger-shadow-not-trusted-for-gating");
        if (challengerTrusted && gap !== null && gap > 0.12) { decision = "OWN_PREDICTION_CAUTION"; reasons.push("trusted-challenger-disagreement"); }
      } else reasons.push("challenger-unavailable");

      let marketMapped = false, marketSourceId = null, marketSourceEventId = null, marketProbability = null, marketOdds = null, paperEdge = null, paperEv = null;
      const identity = identities.get(fixture.event_id);
      if (identity) {
        const snapshot = marketLatest.get(`${identity.source_event_id}:event_snapshot`);
        const probability = marketLatest.get(`${identity.source_event_id}:market_probability`);
        const odds = marketLatest.get(`${identity.source_event_id}:best_odds`);
        const actualSelection = String(snapshot?.payload?.selection || "").toLowerCase() === "draw" ? "draw" : teamKey(snapshot?.payload?.selection);
        if (actualSelection && actualSelection === expectedSelection(picked, fixture)) {
          marketMapped = true; marketSourceId = identity.source_id; marketSourceEventId = identity.source_event_id;
          marketProbability = finite(probability?.value); marketOdds = finite(odds?.value);
          if (marketProbability !== null) paperEdge = fairP - marketProbability;
          if (marketOdds !== null) paperEv = fairP * marketOdds - 1;
          reasons.push("market-price-mapped-for-paper-comparison");
        } else reasons.push("market-mapping-selection-mismatch");
      } else reasons.push("market-event-unmapped");

      const decisionHash = await hash({ eventId: fixture.event_id, asOfBucket, championVersion: champion.model_version, challengerVersion: challenger?.model_version || null, championPredictionHash: champion.prediction_hash });
      const row = {
        decision_hash: decisionHash, event_id: fixture.event_id, sport_key: fixture.sport_key || "soccer", league: fixture.league,
        home_team: fixture.home_team, away_team: fixture.away_team, commence_time: fixture.commence_time, as_of: asOf, as_of_bucket: asOfBucket,
        intelligence_decision: decision, selected_outcome: picked, fair_probability: fairP, fair_odds: fairOdds, confidence_score: conf,
        champion_model_id: champion.model_id, champion_model_version: champion.model_version, champion_probabilities: champion.probabilities,
        challenger_model_id: challenger?.model_id || null, challenger_model_version: challenger?.model_version || null,
        challenger_probabilities: challenger?.probabilities || null, challenger_status: challenger ? (challengerTrusted ? "review-candidate" : "shadow") : "unavailable", disagreement_gap: gap,
        market_mapped: marketMapped, market_source_id: marketSourceId, market_source_event_id: marketSourceEventId,
        market_probability: marketProbability, market_odds: marketOdds, paper_edge: paperEdge, paper_ev: paperEv,
        reason_codes: [...new Set(reasons)],
        provenance: { engineVersion: VERSION, championPredictionHash: champion.prediction_hash, championTrainingDataHash: champion.training_data_hash, challengerArtifactHash: artifactResult.data?.artifact_hash || null, eventIdentity: identity || null },
        production_play_upgrade_allowed: false, production_probability_changed: false, automatic_model_promotion_allowed: false, real_money_action_available: false, paper_only: true,
      };
      rows.push(row);
      if (samples.length < 8) samples.push({ eventId: row.event_id, match: `${row.home_team} vs ${row.away_team}`, decision, selection: picked, fairProbability: fairP, fairOdds, confidence: conf, challengerGap: gap, marketMapped });
    }
    for (let i = 0; i < rows.length; i += 300) { const { error } = await admin.from("scorecaster_own_decisions_v1").upsert(rows.slice(i, i + 300), { onConflict: "decision_hash", ignoreDuplicates: true }); if (error) throw error; }
    await admin.from("scorecaster_source_health_snapshots_v1").insert({ captured_at: asOf, source_id: "scorecaster_own_decision_engine", status: rows.length ? "healthy" : "degraded", last_observed_at: asOf, age_minutes: 0, records_24h: rows.length, rights_ok: true, training_rights_ok: true, dependency_class: "primary", diagnostics: { version: VERSION, decisions: rows.length, ready: rows.filter(r => r.intelligence_decision === "OWN_PREDICTION_READY").length, caution: rows.filter(r => r.intelligence_decision === "OWN_PREDICTION_CAUTION").length, marketMapped: rows.filter(r => r.market_mapped).length, championModelId: CHAMPION_ID, challengerTrusted, independentFromMarketChampion: true }, paper_only: true });
    return Response.json({ ok: true, version: VERSION, asOf, decisions: rows.length, ready: rows.filter(r => r.intelligence_decision === "OWN_PREDICTION_READY").length, caution: rows.filter(r => r.intelligence_decision === "OWN_PREDICTION_CAUTION").length, marketMapped: rows.filter(r => r.market_mapped).length, champion: { id: CHAMPION_ID, role: "owned-data-baseline-champion" }, challenger: { id: CHALLENGER_ID, trustedForGating: challengerTrusted, gate: challengerGate }, samples, productionPlayUpgradeAllowed: false, productionProbabilityChanged: false, automaticModelPromotionAllowed: false, realMoneyActionAvailable: false, paperOnly: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, version: VERSION, error: error instanceof Error ? error.message : String(error), paperOnly: true }, { status: 500 });
  }
});
