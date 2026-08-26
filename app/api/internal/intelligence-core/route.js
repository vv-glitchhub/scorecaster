import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { getCollectorSource, listCollectorSources } from "../../../../lib/collector-source-registry.mjs";
import {
  INTELLIGENCE_CORE_VERSION,
  OWN_FOOTBALL_MODEL_ID,
  OWN_FOOTBALL_MODEL_VERSION,
  TEAM_STATE_VERSION,
  canonicalFactFromCollector,
  canonicalFactFromObservation,
  buildFootballTeamStates,
  predictOwnFootballMatch,
  buildLearningExample,
  stableHash,
  timeBucket,
  buildDependencyReport,
} from "../../../../lib/scorecaster-intelligence-core-v1.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const response = (payload, status = 200) => Response.json(payload, { status, headers: HEADERS });
const authorized = (request) => Boolean(process.env.CRON_SECRET) && request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;

function ascii(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}
function fullSlug(value) {
  return ascii(value).trim().replace(/[^a-z0-9åäöæøüéèáíóúñß]+/gi, "-").replace(/^-|-$/g, "");
}
function identityTokens(value) {
  const drop = new Set(["fc", "afc", "cf", "sc", "ac", "fk", "bk", "if", "aif", "club", "football", "calcio", "de"]);
  return ascii(value).replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token && !drop.has(token));
}
function compactIdentity(value) {
  return identityTokens(value).join("-");
}
function tokenScore(left, right) {
  const a = new Set(identityTokens(left));
  const b = new Set(identityTokens(right));
  if (!a.size || !b.size) return 0;
  const common = [...a].filter((token) => b.has(token)).length;
  return (2 * common) / (a.size + b.size);
}
function dayKey(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}
function sourceRights(sourceId) {
  if (sourceId === "openfootball_cc0") {
    return { commercialUseAllowed: true, modelTrainingAllowed: true, publishable: true };
  }
  const source = getCollectorSource(sourceId);
  return source ? {
    commercialUseAllowed: source.commercialUseAllowed === true,
    modelTrainingAllowed: source.modelTrainingAllowed === true,
    publishable: source.accessMode === "production" && source.commercialUseAllowed === true,
  } : {};
}
function addAlias(teamStates, liveName) {
  if (!liveName || !(teamStates instanceof Map)) return null;
  const direct = teamStates.get(fullSlug(liveName));
  if (direct) return direct;
  const compact = compactIdentity(liveName);
  let best = null;
  let bestScore = 0;
  for (const state of teamStates.values()) {
    if (compact && compact === compactIdentity(state.teamName)) { best = state; bestScore = 1; break; }
    const score = tokenScore(liveName, state.teamName);
    if (score > bestScore) { best = state; bestScore = score; }
  }
  if (best && bestScore >= 0.72) {
    teamStates.set(fullSlug(liveName), best);
    return best;
  }
  return null;
}
function outcomeMatch(feature, outcomes) {
  const home = compactIdentity(feature.home_team);
  const away = compactIdentity(feature.away_team);
  const date = dayKey(feature.commence_time);
  if (!home || !away || !date) return null;
  const kickoff = Date.parse(feature.commence_time);
  let best = null;
  let bestDistance = Infinity;
  for (const outcome of outcomes) {
    if (outcome.status !== "final" || outcome.finality_verified !== true) continue;
    if (compactIdentity(outcome.home_team) !== home || compactIdentity(outcome.away_team) !== away) continue;
    const candidate = Date.parse(outcome.commence_time || outcome.observed_at || "");
    if (!Number.isFinite(candidate)) continue;
    const distance = Math.abs(candidate - kickoff);
    if (distance <= 36 * 60 * 60 * 1000 && distance < bestDistance) { best = outcome; bestDistance = distance; }
  }
  return best;
}
async function upsertChunks(admin, table, rows, onConflict, size = 500) {
  let attempted = 0;
  for (let index = 0; index < rows.length; index += size) {
    const batch = rows.slice(index, index + size);
    const { error } = await admin.from(table).upsert(batch, { onConflict, ignoreDuplicates: true });
    if (error) throw error;
    attempted += batch.length;
  }
  return attempted;
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "CRON_SECRET is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);

  const asOf = new Date().toISOString();
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  try {
    const [collectorResult, observationsResult, outcomesResult, featuresResult, sourceHealthResult] = await Promise.all([
      admin.from("collector_records").select("fingerprint,source_id,source_type,event_id,entity_id,sport,league,metric,value,unit,observed_at,collected_at,payload,confidence,source_trust,commercial_use_allowed,publishable").gte("collected_at", since).order("collected_at", { ascending: false }).limit(10000),
      admin.from("sports_analytics_observations").select("fingerprint,event_id,sport_key,canonical_sport,league,participant_id,family,metric,value,unit,observed_at,captured_at,provider,source_trust,confidence,metadata").gte("captured_at", since).order("captured_at", { ascending: false }).limit(10000),
      admin.from("scorecaster_event_outcomes_v1").select("id,outcome_hash,event_id,sport_key,league,home_team,away_team,commence_time,status,home_score,away_score,outcome,resolved_at,observed_at,captured_at,confidence,source_count,source_ids,provenance,finality_verified").eq("status", "final").eq("finality_verified", true).order("commence_time", { ascending: true }).limit(15000),
      admin.from("scorecaster_pit_feature_snapshots_v1").select("id,event_id,sport_key,league,home_team,away_team,commence_time,as_of,as_of_bucket,feature_schema_version,input_hash,features,source_lineage,data_quality,eligible_for_model,leakage_guard_passed").order("as_of", { ascending: false }).limit(2500),
      admin.from("scorecaster_source_health_snapshots_v1").select("source_id,status,last_observed_at,age_minutes,records_24h,rights_ok,training_rights_ok,dependency_class,diagnostics,captured_at").order("captured_at", { ascending: false }).limit(200),
    ]);
    for (const result of [collectorResult, observationsResult, outcomesResult, featuresResult, sourceHealthResult]) if (result.error) throw result.error;

    const collectorFacts = (collectorResult.data || []).map((row) => canonicalFactFromCollector(row, sourceRights(row.source_id))).filter(Boolean);
    const observationFacts = (observationsResult.data || []).map((row) => canonicalFactFromObservation(row, sourceRights(row.provider))).filter(Boolean);
    const canonicalFacts = [...collectorFacts, ...observationFacts];
    await upsertChunks(admin, "scorecaster_canonical_facts_v1", canonicalFacts, "fact_hash");

    const outcomes = outcomesResult.data || [];
    const teamStates = buildFootballTeamStates(outcomes, asOf);
    const latestFeatureByEvent = new Map();
    for (const feature of featuresResult.data || []) if (!latestFeatureByEvent.has(feature.event_id)) latestFeatureByEvent.set(feature.event_id, feature);
    const features = [...latestFeatureByEvent.values()];

    for (const feature of features) {
      addAlias(teamStates, feature.home_team);
      addAlias(teamStates, feature.away_team);
    }

    const leagueByTeam = new Map();
    for (const outcome of outcomes) {
      if (outcome.home_team) leagueByTeam.set(compactIdentity(outcome.home_team), outcome.league || null);
      if (outcome.away_team) leagueByTeam.set(compactIdentity(outcome.away_team), outcome.league || null);
    }
    const stateRows = [];
    const uniqueStateObjects = new Set();
    for (const state of teamStates.values()) {
      if (!state?.teamKey || uniqueStateObjects.has(state)) continue;
      uniqueStateObjects.add(state);
      const league = leagueByTeam.get(compactIdentity(state.teamName)) || null;
      const rowInput = { teamKey: state.teamKey, state, asOf, stateVersion: TEAM_STATE_VERSION };
      stateRows.push({
        team_key: state.teamKey,
        sport_key: "soccer",
        league,
        as_of: asOf,
        as_of_bucket: timeBucket(asOf, 30),
        state_version: TEAM_STATE_VERSION,
        state,
        history_matches: state.matches || 0,
        input_hash: stableHash(rowInput),
        source_lineage: [{ sourceId: "openfootball_cc0", modelTrainingAllowed: true, license: "CC0-1.0" }],
        leakage_guard_passed: true,
        paper_only: true,
      });
    }
    if (stateRows.length) {
      for (let index = 0; index < stateRows.length; index += 300) {
        const { error } = await admin.from("scorecaster_team_state_snapshots_v1").upsert(stateRows.slice(index, index + 300), { onConflict: "team_key,as_of_bucket,state_version" });
        if (error) throw error;
      }
    }

    const predictionRows = [];
    const predictionSummary = [];
    for (const feature of features.filter((row) => String(row.sport_key || "").includes("soccer") && (!row.commence_time || Date.parse(row.commence_time) > Date.now())).slice(0, 200)) {
      const prediction = predictOwnFootballMatch({
        homeTeam: feature.home_team,
        awayTeam: feature.away_team,
        commenceTime: feature.commence_time,
        league: feature.league,
        teamStates,
        asOf,
        featureSnapshotId: feature.id,
      });
      predictionSummary.push({ eventId: feature.event_id, match: `${feature.home_team || "?"} vs ${feature.away_team || "?"}`, status: prediction.status, minHistory: prediction.minHistory || 0, probabilities: prediction.probabilities || null });
      if (prediction.status !== "ready") continue;
      predictionRows.push({
        event_id: feature.event_id,
        feature_snapshot_id: feature.id,
        as_of: asOf,
        as_of_bucket: timeBucket(asOf, 30),
        model_id: prediction.modelId,
        model_version: prediction.modelVersion,
        model_family: prediction.modelFamily,
        probabilities: prediction.probabilities,
        expected_scores: prediction.expectedScores,
        calibration: prediction.calibration,
        independent_from_market: true,
        feature_input_hash: prediction.featureInputHash,
        training_data_hash: stableHash({ source: "openfootball_cc0", finalOutcomes: outcomes.length, cutoff: asOf.slice(0, 10) }),
        prediction_hash: prediction.predictionHash,
        shadow_only: true,
        production_probability_changed: false,
        paper_only: true,
      });
    }
    await upsertChunks(admin, "scorecaster_model_predictions_v1", predictionRows, "prediction_hash");

    const rights = Object.fromEntries(listCollectorSources().map((source) => [source.id, { modelTrainingAllowed: source.modelTrainingAllowed === true }]));
    rights.openfootball_cc0 = { modelTrainingAllowed: true };
    const learningRows = [];
    for (const feature of features.filter((row) => row.commence_time && Date.parse(row.commence_time) < Date.now()).slice(0, 1500)) {
      const outcome = outcomeMatch(feature, outcomes);
      if (!outcome) continue;
      const example = buildLearningExample({ featureSnapshot: feature, outcome, sourceRights: rights });
      if (!example) continue;
      if (feature.data_quality?.hasIndependentSignal !== true) {
        example.eligible_for_training = false;
        example.exclusion_reasons = [...new Set([...(example.exclusion_reasons || []), "independent-signal-missing"])];
      }
      learningRows.push(example);
    }
    await upsertChunks(admin, "scorecaster_learning_examples_v1", learningRows, "example_hash");

    const modelRegistry = {
      model_id: OWN_FOOTBALL_MODEL_ID,
      model_version: OWN_FOOTBALL_MODEL_VERSION,
      sport_key: "soccer",
      model_family: "elo-goal-strength-poisson-ensemble",
      status: "shadow",
      feature_schema_version: TEAM_STATE_VERSION,
      training_data_hash: stableHash({ source: "openfootball_cc0", finalOutcomes: outcomes.length, cutoff: asOf.slice(0, 10) }),
      code_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      training_config: { marketFeaturesUsed: false, minTeamHistory: 5, source: "openfootball_cc0", sourceLicense: "CC0-1.0" },
      validation_metrics: {},
      holdout_metrics: {},
      promotion_gate: { status: "not-evaluated", automaticPromotion: false, requiresImmutableHoldout: true, requiresCalibration: true, requiresMarketBenchmark: true },
      independent_from_market: true,
      automatic_promotion_allowed: false,
      approved_by: null,
      approved_at: null,
      paper_only: true,
      updated_at: asOf,
    };
    const { error: registryError } = await admin.from("scorecaster_model_registry_v1").upsert(modelRegistry, { onConflict: "model_id,model_version" });
    if (registryError) throw registryError;

    const latestHealthBySource = new Map();
    for (const row of sourceHealthResult.data || []) if (!latestHealthBySource.has(row.source_id)) latestHealthBySource.set(row.source_id, row);
    const dependency = buildDependencyReport([...latestHealthBySource.values()]);

    return response({
      ok: true,
      version: INTELLIGENCE_CORE_VERSION,
      asOf,
      canonicalFactsPrepared: canonicalFacts.length,
      finalOutcomesAvailable: outcomes.length,
      teamStatesMaterialized: stateRows.length,
      predictionsPrepared: predictionRows.length,
      predictionCandidates: predictionSummary.length,
      learningExamplesPrepared: learningRows.length,
      trainingEligiblePrepared: learningRows.filter((row) => row.eligible_for_training).length,
      model: { id: OWN_FOOTBALL_MODEL_ID, version: OWN_FOOTBALL_MODEL_VERSION, status: "shadow", independentFromMarket: true, productionProbabilityChanged: false },
      dependency,
      samplePredictions: predictionSummary.slice(0, 8),
      rawFactsStillRequireObservationSources: true,
      intelligenceOwnedByScorecaster: true,
      automaticPromotionAllowed: false,
      realMoneyActionAvailable: false,
      paperOnly: true,
    });
  } catch (error) {
    return response({ ok: false, version: INTELLIGENCE_CORE_VERSION, error: process.env.NODE_ENV === "production" ? "Intelligence core run failed" : String(error), paperOnly: true }, 500);
  }
}
