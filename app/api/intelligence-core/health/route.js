import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { collectorRegistrySummary } from "../../../../lib/collector-source-registry.mjs";
import {
  INTELLIGENCE_CORE_VERSION,
  OWN_FOOTBALL_MODEL_ID,
  OWN_FOOTBALL_MODEL_VERSION,
  buildDependencyReport,
} from "../../../../lib/scorecaster-intelligence-core-v1.mjs";

export const dynamic = "force-dynamic";
const HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};

async function exactCount(query) {
  const { count, error } = await query;
  return { count: error ? null : Number(count || 0), error: error?.message || null };
}

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return Response.json({ ok: false, error: "Supabase admin client is not configured" }, { status: 503, headers: HEADERS });

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const [
      factsTotal, facts24h, openFootballFacts, outcomesTotal, finalOutcomes,
      teamStates, predictions, learningTotal, learningEligible, identities,
      registryResult, healthResult,
    ] = await Promise.all([
      exactCount(admin.from("scorecaster_canonical_facts_v1").select("id", { count: "exact", head: true })),
      exactCount(admin.from("scorecaster_canonical_facts_v1").select("id", { count: "exact", head: true }).gte("captured_at", dayAgo)),
      exactCount(admin.from("scorecaster_canonical_facts_v1").select("id", { count: "exact", head: true }).eq("source_id", "openfootball_cc0")),
      exactCount(admin.from("scorecaster_event_outcomes_v1").select("id", { count: "exact", head: true })),
      exactCount(admin.from("scorecaster_event_outcomes_v1").select("id", { count: "exact", head: true }).eq("status", "final").eq("finality_verified", true)),
      exactCount(admin.from("scorecaster_team_state_snapshots_v1").select("id", { count: "exact", head: true })),
      exactCount(admin.from("scorecaster_model_predictions_v1").select("id", { count: "exact", head: true })),
      exactCount(admin.from("scorecaster_learning_examples_v1").select("id", { count: "exact", head: true })),
      exactCount(admin.from("scorecaster_learning_examples_v1").select("id", { count: "exact", head: true }).eq("eligible_for_training", true)),
      exactCount(admin.from("scorecaster_event_identity_map_v1").select("id", { count: "exact", head: true })),
      admin.from("scorecaster_model_registry_v1").select("model_id,model_version,model_family,status,feature_schema_version,training_data_hash,code_commit_sha,training_config,validation_metrics,holdout_metrics,promotion_gate,independent_from_market,automatic_promotion_allowed,approved_at,updated_at").eq("model_id", OWN_FOOTBALL_MODEL_ID).eq("model_version", OWN_FOOTBALL_MODEL_VERSION).maybeSingle(),
      admin.from("scorecaster_source_health_snapshots_v1").select("source_id,status,last_observed_at,age_minutes,records_24h,rights_ok,training_rights_ok,dependency_class,diagnostics,captured_at").order("captured_at", { ascending: false }).limit(100),
    ]);

    const latestBySource = new Map();
    for (const row of healthResult.data || []) if (!latestBySource.has(row.source_id)) latestBySource.set(row.source_id, row);
    const sourceHealth = [...latestBySource.values()];
    const dependency = buildDependencyReport(sourceHealth);
    const sourceRegistry = collectorRegistrySummary();
    const safeRegistry = sourceRegistry.sources.map((source) => ({
      id: source.id,
      name: source.name,
      type: source.type,
      accessMode: source.accessMode,
      enabled: source.enabled,
      commercialUseAllowed: source.commercialUseAllowed,
      modelTrainingAllowed: source.modelTrainingAllowed,
      redistributionAllowed: source.redistributionAllowed,
      license: source.license,
      sports: source.sports,
      updateCadence: source.updateCadence,
    }));

    const errors = [factsTotal, facts24h, openFootballFacts, outcomesTotal, finalOutcomes, teamStates, predictions, learningTotal, learningEligible, identities]
      .map((item) => item.error).filter(Boolean);
    if (registryResult.error) errors.push(registryResult.error.message);
    if (healthResult.error) errors.push(healthResult.error.message);

    const model = registryResult.data || {
      model_id: OWN_FOOTBALL_MODEL_ID,
      model_version: OWN_FOOTBALL_MODEL_VERSION,
      status: "not-materialized-yet",
      independent_from_market: true,
      automatic_promotion_allowed: false,
    };

    return Response.json({
      ok: errors.length === 0,
      version: INTELLIGENCE_CORE_VERSION,
      mode: "scorecaster-owned-derived-intelligence",
      storage: {
        canonicalFacts: factsTotal.count,
        canonicalFacts24h: facts24h.count,
        openFootballCc0Facts: openFootballFacts.count,
        eventOutcomes: outcomesTotal.count,
        verifiedFinalOutcomes: finalOutcomes.count,
        teamStateSnapshots: teamStates.count,
        shadowPredictions: predictions.count,
        learningExamples: learningTotal.count,
        trainingEligibleExamples: learningEligible.count,
        providerEventIdentities: identities.count,
      },
      model,
      sourceHealth,
      dependency,
      sourceRegistry: {
        version: sourceRegistry.version,
        enabled: sourceRegistry.enabled,
        productionApproved: sourceRegistry.productionApproved,
        sources: safeRegistry,
      },
      contracts: {
        rawFactsStillRequireObservationSources: true,
        mirroredOpenHistoryOwnedInScorecasterDatabase: true,
        allDerivedFeaturesOwnedByScorecaster: true,
        modelProbabilityFromOwnBaselineUsesMarketInputs: false,
        missingDataBehavior: "fail-closed",
        automaticModelPromotionAllowed: false,
        productionProbabilityChangedByCore: false,
        productionDecisionUpgradeAllowedByCore: false,
        realMoneyActionAvailable: false,
        paperOnly: true,
      },
      errors,
    }, { status: errors.length ? 503 : 200, headers: HEADERS });
  } catch (error) {
    return Response.json({ ok: false, version: INTELLIGENCE_CORE_VERSION, error: "Intelligence core health unavailable", paperOnly: true }, { status: 500, headers: HEADERS });
  }
}
