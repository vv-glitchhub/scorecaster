import { notificationDeliveryConfiguration } from "../../../lib/notification-delivery-config";
import { autonomousAgentConfiguration } from "../../../lib/autonomous-agent-config.js";
import { settlementMonitorConfiguration } from "../../../lib/settlement-monitor-config.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseKeyConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const newsProviderConfigured = Boolean(process.env.NEWS_API_KEY);
  const injuryProviderConfigured = Boolean(process.env.SPORTSDATA_API_KEY);
  const lineupProviderConfigured = Boolean(process.env.LINEUP_API_URL && process.env.LINEUP_API_KEY);
  const notificationDelivery = notificationDeliveryConfiguration();
  const autonomousAgent = autonomousAgentConfiguration();
  const settlementMonitor = settlementMonitorConfiguration();

  const services = {
    localQuickUse: true,
    riskEngine: true,
    betSlipEngine: true,
    bettingConsensusWorkspace: true,
    bettingFixedProbabilityRemoved: true,
    bettingPersonalStakeCap: true,
    agentV9AdversarialEngine: true,
    agentProbabilityStressTest: true,
    agentCounterArgumentGeneration: true,
    agentPriceGuard: true,
    agentPortfolioExposureCap: true,
    agentLeagueExposureCap: true,
    agentSinglePlayPerEvent: true,
    agentConservativeLowerBoundKelly: true,
    agentInventedContextRemoved: true,
    agentLearningMinimumSample: 30,
    agentLearningUsesClvCalibrationAndBrier: true,
    agentLearningChangesProbability: false,
    agentV9RegressionTests: true,
    agentV10GroundedExplanationApi: true,
    agentV10ServerPortfolioApi: true,
    agentV10SignedDecisionTickets: true,
    agentV10DecisionSigningConfigured: Boolean(
      process.env.AGENT_DECISION_SIGNING_KEY && process.env.AGENT_DECISION_SIGNING_KEY.length >= 32
    ),
    agentV10TicketLifetimeMinutes: 10,
    agentV10ProviderRequiresSignedDecision: true,
    agentV10StructuredOutputValidation: true,
    agentV10NoNewNumbersRule: true,
    agentV10NoExternalTools: true,
    agentV10ProviderStorageDisabled: true,
    agentV10DeterministicFallback: true,
    agentV10AuthenticatedProviderAccess: true,
    agentV10HourlyQuota: true,
    agentV10LocalExplanationCache: true,
    agentV10RegressionTests: true,
    agentV11ModelLab: true,
    agentV11ChronologicalSplit: true,
    agentV11ChampionChallenger: true,
    agentV11UntouchedHoldout: true,
    agentV11MinimumLearningSample: 120,
    agentV11DriftDetection: true,
    agentV11CriticalDriftFreezesPlay: true,
    agentV11ShadowOnly: true,
    agentV11ProductionProbabilityChangedByLearning: false,
    agentV11RegressionTests: true,
    mobileAgentV11Tab: true,
    mobileAgentV11Portfolio: true,
    mobileAgentV11ModelLab: true,
    mobileAgentV11Explanations: true,
    sportsIntelligenceV1: true,
    sportsIntelligenceTeamAttribution: true,
    sportsIntelligenceDowngradeOnly: true,
    sportsIntelligenceCanUpgradeToPlay: false,
    sportsIntelligenceChangesMarketProbability: false,
    sportsIntelligenceConflictGate: true,
    sportsIntelligenceCacheMinutes: 5,
    sportsIntelligenceMaxEnrichmentsPerTopPicksRequest: 12,
    sportsIntelligenceRegressionTests: true,
    newsProviderConfigured,
    injuryProviderConfigured,
    lineupProviderConfigured,
    sportsIntelligenceProvidersConfigured: newsProviderConfigured || injuryProviderConfigured || lineupProviderConfigured,
    formRestShadowV1: true,
    formRestChronologyGuard: true,
    formRestServerAuditedSnapshots: true,
    formRestChangesProductionProbability: false,
    formRestAutomaticPromotion: false,
    formRestRegressionTests: true,
    eventDetailV1: true,
    eventDetailServerResolved: true,
    eventDetailClientFactsTrusted: false,
    eventDetailRealMoneyActions: false,
    eventDetailRegressionTests: true,
    watchlistAlertsV2: true,
    watchlistServerVerifiedSelections: true,
    watchlistDecisionChangeAlerts: true,
    watchlistPriceFloorAlerts: true,
    watchlistKickoffAlerts: true,
    watchlistInventedReplacementData: false,
    watchlistAuthenticatedApi: true,
    watchlistRlsIsolation: true,
    watchlistRegressionTests: true,
    nativeWatchlistScreen: true,
    marketTimelineV1: true,
    marketTimelineServerVerifiedCaptures: true,
    marketTimelineRequiresOwnedWatchlist: true,
    marketTimelineDuplicateSuppression: true,
    marketTimelineRlsIsolation: true,
    marketTimelineSharpMoneyInference: false,
    marketTimelineOutcomeInference: false,
    marketTimelineBackgroundCapture: false,
    marketTimelineRegressionTests: true,
    nativeMarketTimelineInEventDetail: true,
    alertInboxV1: true,
    alertInboxV2: true,
    alertInboxDeduplication: true,
    alertInboxReadState: true,
    alertInboxResolvedHistory: true,
    alertInboxReversibleDismissal: true,
    alertInboxAuthenticatedApi: true,
    alertInboxRlsIsolation: true,
    alertInboxAccountExportAndDeletion: true,
    alertInboxRegressionTests: true,
    notificationRegistryV1: true,
    notificationDeliveryV1: notificationDelivery.codeAvailable,
    notificationDeliveryEnabledFlag: notificationDelivery.enabledFlag,
    notificationDeliveryAdminConfigured: notificationDelivery.adminConfigured,
    notificationDeliveryCronSecretConfigured: notificationDelivery.cronSecretConfigured,
    notificationDeliveryExpoAccessTokenConfigured: notificationDelivery.expoAccessTokenConfigured,
    notificationDeliverySchedulingManagedExternally: notificationDelivery.schedulingManagedExternally,
    notificationDeliveryBatchLimit: 100,
    notificationReceiptBatchLimit: 1000,
    notificationDeliveryMaximumAttempts: 5,
    notificationReceiptDelayMinutes: 15,
    notificationDeliveryTicketAndReceiptTracking: true,
    notificationDeliveryInvalidTokenCleanup: true,
    alertInboxBackgroundPushDelivery: notificationDelivery.deliveryActive,
    nativeAlertInboxControls: true,
    seededPoissonSimulator: true,
    reproducibleSimulation: true,
    simulatorInputValidation: true,
    simulatorUncertaintyIntervals: true,
    excellenceAppsRegressionTests: true,
    authLayer: true,
    mobileBearerAuth: true,
    cloudSyncApi: true,
    paperBetSettlementApi: true,
    automaticH2hScoreSettlement: Boolean(process.env.ODDS_API_KEY),
    automaticSettlementHourlyQuota: true,
    settlementMonitorV1: true,
    settlementMonitorWorkerEnabled: settlementMonitor.enabledFlag,
    settlementMonitorWorkerActive: settlementMonitor.monitorActive,
    autonomousAgentV13: true,
    autonomousAgentWorkerEnabled: autonomousAgent.enabledFlag,
    autonomousAgentWorkerActive: autonomousAgent.agentActive,
    autonomousAgentUserOptInRequired: true,
    autonomousAgentPaperOnly: true,
    autonomousAgentDefaultVirtualBankroll: 1000,
    backgroundWorkerOrder: "settlement-before-autonomous",
    autonomousWorkerSchedule: "github-actions-15m",
    paperBankrollApi: true,
    paperStakeApiValidation: true,
    paperStakeDatabaseEnforcement: true,
    openPaperExposureDatabaseEnforcement: true,
    singleLeagueExposureDatabaseEnforcement: true,
    personalMinimumEdgeEnforcement: true,
    personalMinimumConfidenceEnforcement: true,
    accountExportApi: true,
    accountDeletionConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    authenticatedRateLimits: true,
    publicOddsInputAllowlist: true,
    publicOddsCache: true,
    liveFixtureOnlyTopPicks: true,
    nearTermTopPicksWindowHours: 168,
    featuredTopPicksWindowHours: 72,
    noVigMarketConsensus: true,
    fixedProbabilityBoostRemoved: true,
    numericDataConfidence: true,
    bookmakerCoverageGate: true,
    marketFreshnessGate: true,
    marketConsensusRegressionTests: true,
    paperSettlementRegressionTests: true,
    fixtureIntegrityRegressionTests: true,
    dailyTopThree: true,
    leagueFilters: ["NHL", "NBA", "EPL", "La Liga", "Liiga", "SHL"],
    mobileRoiAndClv: true,
    mobilePerformanceAnalytics: true,
    mobileLeagueAnalytics: true,
    mobileProbabilityCalibration: true,
    mobileBrierScore: true,
    mobileDataExport: true,
    apiSecurityRegressionTests: true,
    expoDependencyCheck: true,
    securityHeaders: true,
    secretScanCi: true,
    codeQl: true,
    expoMobileMvp: true,
    realMoneyBetting: false,
    paymentDataStored: false,
    rowLevelSecurityMigration: "supabase/scorecaster_auth_cloud.sql",
    paperRiskMigration: "supabase/scorecaster_paper_risk_limits.sql",
    rateLimitMigration: "supabase/scorecaster_api_rate_limits.sql",
    watchlistMigration: "supabase/scorecaster_watchlist_alerts.sql",
    alertInboxMigration: "supabase/scorecaster_alert_inbox.sql",
    notificationRegistryMigration: "supabase/scorecaster_notification_registry.sql",
    notificationDeliveryMigration: "supabase/scorecaster_notification_delivery.sql",
    marketTimelineMigration: "supabase/scorecaster_market_timeline.sql",
    oddsApiConfigured: Boolean(process.env.ODDS_API_KEY),
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
    openAiAgentModel: String(process.env.OPENAI_AGENT_MODEL || "gpt-5-mini").slice(0, 100),
    supabaseConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && supabaseKeyConfigured
    )
  };

  const requiredLocalServicesReady =
    services.localQuickUse &&
    services.riskEngine &&
    services.betSlipEngine &&
    services.bettingConsensusWorkspace &&
    services.agentV9AdversarialEngine &&
    services.agentProbabilityStressTest &&
    services.agentPortfolioExposureCap &&
    services.agentV9RegressionTests &&
    services.agentV10GroundedExplanationApi &&
    services.agentV10ServerPortfolioApi &&
    services.agentV10SignedDecisionTickets &&
    services.agentV10ProviderRequiresSignedDecision &&
    services.agentV10StructuredOutputValidation &&
    services.agentV10DeterministicFallback &&
    services.agentV10RegressionTests &&
    services.agentV11ModelLab &&
    services.agentV11ChronologicalSplit &&
    services.agentV11UntouchedHoldout &&
    services.agentV11DriftDetection &&
    services.agentV11RegressionTests &&
    services.mobileAgentV11Tab &&
    services.sportsIntelligenceV1 &&
    services.sportsIntelligenceTeamAttribution &&
    services.sportsIntelligenceDowngradeOnly &&
    services.sportsIntelligenceConflictGate &&
    services.sportsIntelligenceRegressionTests &&
    services.formRestShadowV1 &&
    services.formRestChronologyGuard &&
    services.formRestRegressionTests &&
    services.eventDetailV1 &&
    services.eventDetailServerResolved &&
    services.eventDetailRegressionTests &&
    services.watchlistAlertsV2 &&
    services.watchlistServerVerifiedSelections &&
    services.watchlistAuthenticatedApi &&
    services.watchlistRegressionTests &&
    services.nativeWatchlistScreen &&
    services.marketTimelineV1 &&
    services.marketTimelineServerVerifiedCaptures &&
    services.marketTimelineRequiresOwnedWatchlist &&
    services.marketTimelineRlsIsolation &&
    services.marketTimelineRegressionTests &&
    services.nativeMarketTimelineInEventDetail &&
    services.alertInboxV1 &&
    services.alertInboxV2 &&
    services.alertInboxDeduplication &&
    services.alertInboxReadState &&
    services.alertInboxResolvedHistory &&
    services.alertInboxAuthenticatedApi &&
    services.alertInboxRlsIsolation &&
    services.alertInboxRegressionTests &&
    services.notificationRegistryV1 &&
    services.notificationDeliveryV1 &&
    services.nativeAlertInboxControls &&
    services.seededPoissonSimulator &&
    services.noVigMarketConsensus &&
    services.marketConsensusRegressionTests &&
    services.paperSettlementRegressionTests &&
    services.fixtureIntegrityRegressionTests &&
    services.excellenceAppsRegressionTests;

  const nextStep = !services.supabaseConfigured
    ? "Configure Supabase public environment variables"
    : !services.accountDeletionConfigured
      ? "Apply all Supabase migrations through Notification Delivery V1, test two-user isolation and configure server-only account deletion"
      : !services.automaticH2hScoreSettlement
        ? "Configure the server-only Odds API key for live consensus and automatic paper score settlement"
        : !services.agentV10DecisionSigningConfigured
          ? "Configure a dedicated server-only Agent decision signing key"
          : !services.sportsIntelligenceProvidersConfigured
            ? "Configure optional news, injury and lineup providers for verified independent evidence"
            : !services.openAiConfigured
              ? "Optional: configure the server-only OpenAI key for grounded explanations"
              : !notificationDelivery.deliveryActive
                ? "Apply Notification Delivery V1, configure the fail-closed worker and enable exactly one protected scheduler after real-device testing"
                : "Verify Expo tickets and receipts on a physical device, including invalid-token cleanup";

  return Response.json(
    {
      app: "Scorecaster",
      status: requiredLocalServicesReady ? "ok" : "degraded",
      mode: services.supabaseConfigured ? "consensus-mobile-cloud-ready" : "local-first",
      modelMode: "market-consensus-with-shadow-calibration-labs",
      edgeType: "best-price-vs-no-vig-consensus",
      agentMode: "V11-model-lab-with-team-attributed-sports-intelligence-audit",
      intelligenceMode: "verified-team-attribution-downgrade-only",
      watchlistMode: "V2-server-verified-user-isolated-with-alert-inbox-and-manual-market-timeline",
      marketTimelineMode: "user-triggered-server-verified-descriptive-history-no-sharp-inference",
      alertDeliveryMode: notificationDelivery.deliveryActive
        ? "opt-in-expo-push-with-ticket-and-receipt-audit"
        : "in-app-inbox-plus-disabled-fail-closed-push-worker",
      simulatorMode: "seeded-poisson-rating-simulation",
      productBoundary: "sports analysis, risk control and paper tracking only",
      deployment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      services,
      nextStep,
      timestamp: new Date().toISOString()
    },
    {
      status: requiredLocalServicesReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
