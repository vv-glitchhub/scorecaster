import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL_ID = "scorecaster-own-football-baseline";
const MODEL_VERSION = "1.0.0";
const MODEL_FAMILY = "elo-goal-strength-poisson-ensemble";
const STATE_VERSION = "scorecaster-football-team-state-v1";
const EPS = 1e-12;

type Outcome = {
  id: string; event_id: string; sport_key: string; league: string | null;
  home_team: string; away_team: string; commence_time: string; status: string;
  home_score: number; away_score: number; outcome: string; resolved_at: string;
  observed_at: string; finality_verified: boolean; source_ids: string[];
};
type TeamState = {
  teamKey: string; teamName: string; matches: number; wins: number; draws: number; losses: number; points: number;
  elo: number; gfEwma: number; gaEwma: number; homeGfEwma: number; homeGaEwma: number;
  awayGfEwma: number; awayGaEwma: number; lastMatchAt: string | null; formPointsEwma: number;
  sourceIds: Set<string>; league: string | null; sportKey: string;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const finite = (v: unknown, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
function teamKey(value: unknown) { return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function timeBucket(value: Date, minutes = 30) { const d = new Date(value); d.setUTCMinutes(Math.floor(d.getUTCMinutes() / minutes) * minutes, 0, 0); return d.toISOString(); }
function ewma(current: number, value: number, alpha: number, count: number) { return count === 0 ? value : alpha * value + (1 - alpha) * current; }
function expectedElo(homeElo: number, awayElo: number, homeAdvantage = 65) { return 1 / (1 + 10 ** (-((homeElo + homeAdvantage) - awayElo) / 400)); }
function resultScore(home: number, away: number) { return home > away ? 1 : home < away ? 0 : 0.5; }
function poisson(goals: number, lambda: number) { let factorial = 1; for (let i = 2; i <= goals; i += 1) factorial *= i; return Math.exp(-lambda) * lambda ** goals / factorial; }
function poissonThreeWay(homeLambda: number, awayLambda: number, maxGoals = 10) {
  const out = { home: 0, draw: 0, away: 0 };
  for (let h = 0; h <= maxGoals; h += 1) for (let a = 0; a <= maxGoals; a += 1) {
    const joint = poisson(h, homeLambda) * poisson(a, awayLambda);
    if (h > a) out.home += joint; else if (h < a) out.away += joint; else out.draw += joint;
  }
  const total = out.home + out.draw + out.away || 1;
  return { home: out.home / total, draw: out.draw / total, away: out.away / total };
}
function normalize(p: { home: number; draw: number; away: number }) {
  const values = [Math.max(EPS, p.home), Math.max(EPS, p.draw), Math.max(EPS, p.away)];
  const total = values.reduce((s, v) => s + v, 0);
  return { home: values[0] / total, draw: values[1] / total, away: values[2] / total };
}
async function sha256(value: unknown) {
  const text = JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function fetchAll(admin: ReturnType<typeof createClient>, table: string, select: string, configure: (query: any) => any, max = 20000) {
  const rows: any[] = [];
  for (let from = 0; from < max; from += 1000) {
    let query: any = admin.from(table).select(select).range(from, from + 999);
    query = configure(query);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}
function getState(states: Map<string, TeamState>, name: string, league: string | null, sportKey: string) {
  const key = teamKey(name);
  if (!states.has(key)) states.set(key, {
    teamKey: key, teamName: name, matches: 0, wins: 0, draws: 0, losses: 0, points: 0,
    elo: 1500, gfEwma: 1.35, gaEwma: 1.35, homeGfEwma: 1.45, homeGaEwma: 1.25,
    awayGfEwma: 1.20, awayGaEwma: 1.50, lastMatchAt: null, formPointsEwma: 1.35,
    sourceIds: new Set(), league, sportKey,
  });
  return states.get(key)!;
}
function buildStates(outcomes: Outcome[]) {
  const states = new Map<string, TeamState>();
  const alpha = 0.22; const k = 24;
  const sorted = [...outcomes].sort((a, b) => Date.parse(a.commence_time) - Date.parse(b.commence_time));
  for (const row of sorted) {
    const home = getState(states, row.home_team, row.league, row.sport_key);
    const away = getState(states, row.away_team, row.league, row.sport_key);
    const hg = finite(row.home_score); const ag = finite(row.away_score);
    const expected = expectedElo(home.elo, away.elo); const actual = resultScore(hg, ag);
    const delta = k * (1 + Math.log1p(Math.abs(hg - ag)) * 0.25) * (actual - expected);
    home.elo += delta; away.elo -= delta;
    const hp = actual === 1 ? 3 : actual === 0.5 ? 1 : 0; const ap = actual === 0 ? 3 : actual === 0.5 ? 1 : 0;
    home.gfEwma = ewma(home.gfEwma, hg, alpha, home.matches); home.gaEwma = ewma(home.gaEwma, ag, alpha, home.matches);
    away.gfEwma = ewma(away.gfEwma, ag, alpha, away.matches); away.gaEwma = ewma(away.gaEwma, hg, alpha, away.matches);
    home.homeGfEwma = ewma(home.homeGfEwma, hg, alpha, home.matches); home.homeGaEwma = ewma(home.homeGaEwma, ag, alpha, home.matches);
    away.awayGfEwma = ewma(away.awayGfEwma, ag, alpha, away.matches); away.awayGaEwma = ewma(away.awayGaEwma, hg, alpha, away.matches);
    home.formPointsEwma = ewma(home.formPointsEwma, hp, alpha, home.matches); away.formPointsEwma = ewma(away.formPointsEwma, ap, alpha, away.matches);
    home.matches += 1; away.matches += 1; home.points += hp; away.points += ap;
    if (hg > ag) { home.wins += 1; away.losses += 1; } else if (hg < ag) { away.wins += 1; home.losses += 1; } else { home.draws += 1; away.draws += 1; }
    home.lastMatchAt = row.observed_at; away.lastMatchAt = row.observed_at;
    for (const source of row.source_ids || []) { home.sourceIds.add(source); away.sourceIds.add(source); }
    home.league = row.league || home.league; away.league = row.league || away.league;
    home.sportKey = row.sport_key || home.sportKey; away.sportKey = row.sport_key || away.sportKey;
  }
  return states;
}
function prediction(home: TeamState, away: TeamState) {
  const homeLambda = clamp(Math.sqrt(Math.max(EPS, home.homeGfEwma * away.awayGaEwma)), 0.15, 4.5);
  const awayLambda = clamp(Math.sqrt(Math.max(EPS, away.awayGfEwma * home.homeGaEwma)), 0.15, 4.2);
  const pp = poissonThreeWay(homeLambda, awayLambda);
  const eloHome = expectedElo(home.elo, away.elo);
  const draw = clamp(0.27 - Math.abs(home.elo - away.elo) / 4000, 0.18, 0.30);
  const ep = normalize({ home: eloHome * (1 - draw), draw, away: (1 - eloHome) * (1 - draw) });
  return { probabilities: normalize({ home: 0.68 * pp.home + 0.32 * ep.home, draw: 0.68 * pp.draw + 0.32 * ep.draw, away: 0.68 * pp.away + 0.32 * ep.away }), expectedScores: { home: homeLambda, away: awayLambda } };
}
function serializableState(state: TeamState) { return { ...state, elo: Number(state.elo.toFixed(3)), gfEwma: Number(state.gfEwma.toFixed(4)), gaEwma: Number(state.gaEwma.toFixed(4)), homeGfEwma: Number(state.homeGfEwma.toFixed(4)), homeGaEwma: Number(state.homeGaEwma.toFixed(4)), awayGfEwma: Number(state.awayGfEwma.toFixed(4)), awayGaEwma: Number(state.awayGaEwma.toFixed(4)), formPointsEwma: Number(state.formPointsEwma.toFixed(4)), sourceIds: [...state.sourceIds].sort() }; }

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ ok: false, error: "POST required" }, { status: 405 });
  const url = Deno.env.get("SUPABASE_URL"); const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return Response.json({ ok: false, error: "Supabase environment unavailable" }, { status: 503 });
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const presented = req.headers.get("x-scorecaster-cron-token") || "";
  const { data: auth } = await admin.from("scorecaster_internal_secrets_v1").select("secret_value").eq("name", "own_football_materializer_cron").single();
  if (!presented || presented !== auth?.secret_value) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const now = new Date(); const asOf = now.toISOString(); const bucket = timeBucket(now, 30);
  try {
    const finals = await fetchAll(admin, "scorecaster_event_outcomes_v1", "id,event_id,sport_key,league,home_team,away_team,commence_time,status,home_score,away_score,outcome,resolved_at,observed_at,finality_verified,source_ids", (q) => q.eq("status", "final").eq("finality_verified", true).lte("observed_at", asOf).order("commence_time", { ascending: true }), 20000) as Outcome[];
    const futureEnd = new Date(now.getTime() + 14 * 86_400_000).toISOString();
    const fixtures = await fetchAll(admin, "scorecaster_event_outcomes_v1", "id,event_id,sport_key,league,home_team,away_team,commence_time,status,home_score,away_score,outcome,resolved_at,observed_at,finality_verified,source_ids", (q) => q.in("status", ["scheduled", "unknown"]).gte("commence_time", asOf).lte("commence_time", futureEnd).order("commence_time", { ascending: true }), 5000) as Outcome[];
    const states = buildStates(finals);
    const trainingDataHash = await sha256({ source: "openfootball_cc0", finalCount: finals.length, latest: finals.at(-1)?.event_id || null });

    const stateRows: any[] = [];
    for (const state of states.values()) {
      const plain = serializableState(state);
      stateRows.push({ team_key: state.teamKey, sport_key: state.sportKey || "soccer", league: state.league, as_of: asOf, as_of_bucket: bucket, state_version: STATE_VERSION, state: plain, history_matches: state.matches, input_hash: await sha256({ state: plain, asOf: bucket }), source_lineage: [{ sourceId: "openfootball_cc0", license: "CC0-1.0", modelTrainingAllowed: true }], leakage_guard_passed: true, paper_only: true });
    }
    for (let i = 0; i < stateRows.length; i += 300) { const { error } = await admin.from("scorecaster_team_state_snapshots_v1").upsert(stateRows.slice(i, i + 300), { onConflict: "team_key,as_of_bucket,state_version" }); if (error) throw error; }

    const predictions: any[] = [];
    const skipped: any[] = [];
    for (const fixture of fixtures) {
      const home = states.get(teamKey(fixture.home_team)); const away = states.get(teamKey(fixture.away_team));
      const minHistory = Math.min(home?.matches || 0, away?.matches || 0);
      if (!home || !away || minHistory < 5) { skipped.push({ eventId: fixture.event_id, reason: "insufficient-history", minHistory }); continue; }
      const result = prediction(home, away);
      const inputHash = await sha256({ home: serializableState(home), away: serializableState(away), fixture: { eventId: fixture.event_id, commenceTime: fixture.commence_time }, modelVersion: MODEL_VERSION });
      predictions.push({ event_id: fixture.event_id, feature_snapshot_id: null, as_of: asOf, as_of_bucket: bucket, model_id: MODEL_ID, model_version: MODEL_VERSION, model_family: MODEL_FAMILY, probabilities: result.probabilities, expected_scores: result.expectedScores, calibration: { status: "uncalibrated-shadow", productionEligible: false }, independent_from_market: true, feature_input_hash: inputHash, training_data_hash: trainingDataHash, prediction_hash: await sha256({ eventId: fixture.event_id, bucket, modelId: MODEL_ID, modelVersion: MODEL_VERSION, inputHash }), shadow_only: true, production_probability_changed: false, paper_only: true });
    }
    for (let i = 0; i < predictions.length; i += 300) { const { error } = await admin.from("scorecaster_model_predictions_v1").upsert(predictions.slice(i, i + 300), { onConflict: "prediction_hash", ignoreDuplicates: true }); if (error) throw error; }

    const { error: registryError } = await admin.from("scorecaster_model_registry_v1").upsert({ model_id: MODEL_ID, model_version: MODEL_VERSION, sport_key: "soccer", model_family: MODEL_FAMILY, status: "shadow", feature_schema_version: STATE_VERSION, training_data_hash: trainingDataHash, code_commit_sha: null, training_config: { marketFeaturesUsed: false, minTeamHistory: 5, source: "openfootball_cc0", sourceLicense: "CC0-1.0", materializer: "supabase-edge" }, validation_metrics: {}, holdout_metrics: {}, promotion_gate: { status: "not-evaluated", automaticPromotion: false, requiresImmutableHoldout: true, requiresCalibration: true, requiresMarketBenchmark: true }, independent_from_market: true, automatic_promotion_allowed: false, approved_by: null, approved_at: null, paper_only: true, updated_at: asOf }, { onConflict: "model_id,model_version" });
    if (registryError) throw registryError;

    await admin.from("scorecaster_source_health_snapshots_v1").insert({ captured_at: asOf, source_id: "scorecaster_own_football_model", status: predictions.length ? "healthy" : "degraded", last_observed_at: asOf, age_minutes: 0, records_24h: predictions.length, rights_ok: true, training_rights_ok: true, dependency_class: "primary", diagnostics: { modelId: MODEL_ID, modelVersion: MODEL_VERSION, finalOutcomes: finals.length, teamStates: states.size, fixtures: fixtures.length, predictions: predictions.length, independentFromMarket: true, derivedModel: true }, paper_only: true });

    return Response.json({ ok: true, version: "scorecaster-own-football-materializer-v1", asOf, finalOutcomes: finals.length, teamStates: states.size, fixtures: fixtures.length, predictions: predictions.length, skipped: skipped.slice(0, 25), model: { id: MODEL_ID, version: MODEL_VERSION, family: MODEL_FAMILY, status: "shadow", independentFromMarket: true, productionEligible: false }, automaticPromotionAllowed: false, productionProbabilityChanged: false, realMoneyActionAvailable: false, paperOnly: true }, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, version: "scorecaster-own-football-materializer-v1", error: error instanceof Error ? error.message : String(error), paperOnly: true }, { status: 500 });
  }
});
