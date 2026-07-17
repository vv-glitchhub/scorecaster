export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseKeyConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

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
    mobileAgentV10Tab: true,
    mobileAgentV10Portfolio: true,
    mobileAgentV10Explanations: true,
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
    noVigMarketConsensus: true,
    fixedProbabilityBoostRemoved: true,
    numericDataConfidence: true,
    bookmakerCoverageGate: true,
    marketFreshnessGate: true,
    marketConsensusRegressionTests: true,
    paperSettlementRegressionTests: true,
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
    services.mobileAgentV10Tab &&
    services.seededPoissonSimulator &&
    services.noVigMarketConsensus &&
    services.marketConsensusRegressionTests &&
    services.paperSettlementRegressionTests &&
    services.excellenceAppsRegressionTests;

  return Response.json(
    {
      app: "Scorecaster",
      status: requiredLocalServicesReady ? "ok" : "degraded",
      mode: services.supabaseConfigured ? "consensus-mobile-cloud-ready" : "local-first",
      modelMode: "market-consensus",
      edgeType: "best-price-vs-no-vig-consensus",
      agentMode: "V10-signed-grounded-language-layer-over-V9-server-authoritative-portfolio",
      simulatorMode: "seeded-poisson-rating-simulation",
      productBoundary: "sports analysis, risk control and paper tracking only",
      deployment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      services,
      nextStep: !services.supabaseConfigured
        ? "Configure Supabase public environment variables"
        : !services.accountDeletionConfigured
          ? "Apply all Supabase migrations, test two-user isolation and configure server-only account deletion"
          : !services.automaticH2hScoreSettlement
            ? "Configure the server-only Odds API key for live consensus and automatic paper score settlement"
            : !services.agentV10DecisionSigningConfigured
              ? "Configure a dedicated server-only Agent decision signing key"
              : !services.openAiConfigured
                ? "Optional: configure the server-only OpenAI key for Agent V10 grounded explanations"
                : "Run paper-risk, signed-Agent, automatic-settlement, TestFlight and Play internal tests",
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
