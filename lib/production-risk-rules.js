export const DEFAULT_BANKROLL_SETTINGS = {
  bankroll: 1000,
  maxStakePercent: 2,
  maxDailyExposurePercent: 8,
  maxSingleLeagueExposurePercent: 4,
  minEdge: 0.025,
  minConfidence: 0.58,
  paperTradingMode: true
};

export function normalizeBankrollSettings(settings = {}) {
  return {
    ...DEFAULT_BANKROLL_SETTINGS,
    ...settings,
    bankroll: Number(settings.bankroll ?? DEFAULT_BANKROLL_SETTINGS.bankroll),
    maxStakePercent: Number(settings.maxStakePercent ?? DEFAULT_BANKROLL_SETTINGS.maxStakePercent),
    maxDailyExposurePercent: Number(settings.maxDailyExposurePercent ?? DEFAULT_BANKROLL_SETTINGS.maxDailyExposurePercent),
    maxSingleLeagueExposurePercent: Number(settings.maxSingleLeagueExposurePercent ?? DEFAULT_BANKROLL_SETTINGS.maxSingleLeagueExposurePercent),
    minEdge: Number(settings.minEdge ?? DEFAULT_BANKROLL_SETTINGS.minEdge),
    minConfidence: Number(settings.minConfidence ?? DEFAULT_BANKROLL_SETTINGS.minConfidence)
  };
}

export function calculateStakeLimit(settings = {}) {
  const config = normalizeBankrollSettings(settings);
  return config.bankroll * (config.maxStakePercent / 100);
}

export function calculateDailyExposureLimit(settings = {}) {
  const config = normalizeBankrollSettings(settings);
  return config.bankroll * (config.maxDailyExposurePercent / 100);
}

export function calculateLeagueExposureLimit(settings = {}) {
  const config = normalizeBankrollSettings(settings);
  return config.bankroll * (config.maxSingleLeagueExposurePercent / 100);
}

export function evaluatePickRisk(pick = {}, settings = {}, context = {}) {
  const config = normalizeBankrollSettings(settings);
  const stake = Number(pick.stake ?? pick.suggestedStake ?? 0);
  const edge = Number(pick.edge ?? 0);
  const confidence = Number(pick.confidence ?? pick.modelConfidence ?? 0);
  const dailyExposure = Number(context.dailyExposure ?? 0);
  const leagueExposure = Number(context.leagueExposure ?? 0);

  const maxStake = calculateStakeLimit(config);
  const maxDailyExposure = calculateDailyExposureLimit(config);
  const maxLeagueExposure = calculateLeagueExposureLimit(config);

  const warnings = [];
  const blockers = [];

  if (edge < config.minEdge) {
    blockers.push('Edge is below the minimum threshold. Skip unless there is strong additional reasoning.');
  }

  if (confidence < config.minConfidence) {
    warnings.push('Confidence is below the target level. Treat as weak or no-bet.');
  }

  if (stake > maxStake) {
    blockers.push(`Stake is above the single bet limit of ${maxStake.toFixed(2)}.`);
  }

  if (dailyExposure + stake > maxDailyExposure) {
    blockers.push(`Daily exposure would exceed ${maxDailyExposure.toFixed(2)}.`);
  }

  if (leagueExposure + stake > maxLeagueExposure) {
    warnings.push(`League exposure would exceed ${maxLeagueExposure.toFixed(2)}.`);
  }

  const decision = blockers.length > 0 ? 'SKIP' : warnings.length > 0 ? 'CAUTION' : 'OK';

  return {
    decision,
    warnings,
    blockers,
    limits: {
      maxStake,
      maxDailyExposure,
      maxLeagueExposure
    },
    normalized: {
      stake,
      edge,
      confidence,
      dailyExposure,
      leagueExposure
    }
  };
}

export function explainRiskDecision(result) {
  if (!result) return 'Risk result unavailable.';

  if (result.decision === 'SKIP') {
    return `Skip: ${result.blockers.join(' ')}`;
  }

  if (result.decision === 'CAUTION') {
    return `Caution: ${result.warnings.join(' ')}`;
  }

  return 'OK: pick is inside bankroll and risk limits.';
}
