import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { sportsAnalyticsProviderConfiguration } from "../../../../lib/sports-analytics-provider.js";
import { sportmonksFootballEvidenceConfiguration } from "../../../../lib/sportmonks-football-evidence-provider.js";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };

export async function GET() {
  const provider = sportsAnalyticsProviderConfiguration();
  const sportmonks = sportmonksFootballEvidenceConfiguration();
  const admin = getSupabaseAdmin();
  let recent = { rows24h: 0, providerRows24h: 0, latestObservedAt: null, latestCapturedAt: null, queryOk: false };

  if (admin) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    try {
      const [all, entitledRows] = await Promise.all([
        admin.from("sports_analytics_observations").select("observed_at,captured_at", { count: "exact", head: false }).in("metric", ["xg-for-per-90", "xg-against-per-90", "post-shot-xg-for-per-90", "shots-for-per-90", "shots-on-target-for-per-90"]).gte("captured_at", since).order("captured_at", { ascending: false }).limit(1),
        admin.from("sports_analytics_observations").select("observed_at,captured_at", { count: "exact", head: true }).eq("provider", provider.source || "sportmonks-football").in("metric", ["xg-for-per-90", "xg-against-per-90"]).gte("captured_at", since)
      ]);
      if (!all.error && !entitledRows.error) {
        recent = {
          rows24h: Number(all.count || 0),
          providerRows24h: Number(entitledRows.count || 0),
          latestObservedAt: all.data?.[0]?.observed_at || null,
          latestCapturedAt: all.data?.[0]?.captured_at || null,
          queryOk: true
        };
      }
    } catch {
      recent.queryOk = false;
    }
  }

  const providerEntitled = provider.configured === true && provider.commercialUseAllowed === true && provider.modelUseAllowed === true && provider.contract === "scorecaster-sports-analytics-v5";
  const storedIndependentXg = recent.providerRows24h > 0;
  const status = !admin
    ? "database-unavailable"
    : !providerEntitled
      ? "provider-not-entitled-or-configured"
      : !storedIndependentXg
        ? "configured-awaiting-pregame-capture"
        : "independent-xg-capture-active";

  return Response.json({
    ok: true,
    version: "football-independent-evidence-health-v1",
    status,
    checkedAt: new Date().toISOString(),
    provider: {
      configured: provider.configured === true,
      source: provider.source || null,
      contract: provider.contract || null,
      commercialUseAllowed: provider.commercialUseAllowed === true,
      modelUseAllowed: provider.modelUseAllowed === true,
      rawRedistributionAllowed: provider.rawRedistributionAllowed === true,
      derivedAnalysisOnly: provider.derivedAnalysisOnly !== false
    },
    sportmonksCandidate: {
      tokenPresent: sportmonks.tokenPresent,
      enabled: sportmonks.enabled,
      commercialUseAllowed: sportmonks.commercialUseAllowed,
      modelUseAllowed: sportmonks.modelUseAllowed,
      configured: sportmonks.configured,
      reason: sportmonks.reason
    },
    storage: {
      configured: Boolean(admin),
      ...recent
    },
    evidencePolicy: {
      predictiveXgRequired: true,
      liveInjuryStatusRequired: true,
      supportingAvailabilityOrFormRestRequired: true,
      bothStartingLineupsRequiredWithinFinalHours: 6,
      maximumPredictiveAgeHours: 72,
      sourceRightsRequired: true,
      marketProviderCannotQualify: true,
      finalSafetyCheckStillRequired: true
    },
    activation: {
      requiredEnvironmentFlags: ["SPORTMONKS_API_TOKEN", "SPORTMONKS_FOOTBALL_EVIDENCE_ENABLED=true", "SPORTMONKS_COMMERCIAL_USE_ALLOWED=true", "SPORTMONKS_MODEL_USE_ALLOWED=true"],
      activationRequiresLicensedSubscription: true,
      rawProviderFeedMustRemainPrivate: true,
      firstWorkerCapturePrecedesVerifiedEvidence: true
    },
    safety: {
      probabilityChanged: false,
      edgeChanged: false,
      evChanged: false,
      automaticModelPromotionAllowed: false,
      realMoneyActionAvailable: false,
      paperOnly: true
    }
  }, { headers: HEADERS });
}
