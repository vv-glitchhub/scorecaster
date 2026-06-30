import { evaluatePickRisk, normalizeBankrollSettings } from './production-risk-rules';

export function createBetSlipItem(pick = {}, stake = 0) {
  const odds = Number(pick.odds ?? pick.price ?? 0);
  const numericStake = Number(stake || pick.stake || pick.suggestedStake || 0);

  return {
    id: pick.id || `${pick.match || pick.game || 'match'}-${pick.selection || pick.team || 'selection'}-${Date.now()}`,
    sport: pick.sport || pick.sportKey || 'unknown',
    league: pick.leagueTitle || pick.league || 'unknown',
    match: pick.match || pick.game || `${pick.homeTeam || 'Home'} vs ${pick.awayTeam || 'Away'}`,
    selection: pick.selection || pick.team || pick.outcome || 'Unknown selection',
    market: pick.market || 'h2h',
    bookmaker: pick.bookmaker || pick.bookmakerTitle || 'Best available',
    odds,
    stake: numericStake,
    edge: Number(pick.edge || 0),
    ev: Number(pick.ev || pick.expectedValue || 0),
    confidence: Number(pick.confidence || pick.modelConfidence || 0),
    modelProbability: Number(pick.modelProbability || pick.modelProb || 0),
    impliedProbability: odds > 0 ? 1 / odds : Number(pick.impliedProbability || 0),
    createdAt: new Date().toISOString(),
    status: 'draft'
  };
}

export function calculateBetSlipTotals(items = []) {
  const stake = items.reduce((sum, item) => sum + Number(item.stake || 0), 0);
  const potentialReturn = items.reduce((sum, item) => sum + Number(item.stake || 0) * Number(item.odds || 0), 0);
  const potentialProfit = potentialReturn - stake;
  const averageOdds = items.length ? items.reduce((sum, item) => sum + Number(item.odds || 0), 0) / items.length : 0;
  const averageEdge = items.length ? items.reduce((sum, item) => sum + Number(item.edge || 0), 0) / items.length : 0;

  return {
    count: items.length,
    stake,
    potentialReturn,
    potentialProfit,
    averageOdds,
    averageEdge
  };
}

export function evaluateBetSlip(items = [], settings = {}) {
  const config = normalizeBankrollSettings(settings);
  const totals = calculateBetSlipTotals(items);
  const byLeague = items.reduce((acc, item) => {
    const league = item.league || 'unknown';
    acc[league] = (acc[league] || 0) + Number(item.stake || 0);
    return acc;
  }, {});

  const itemRisks = items.map((item) => evaluatePickRisk(item, config, {
    dailyExposure: totals.stake - Number(item.stake || 0),
    leagueExposure: (byLeague[item.league || 'unknown'] || 0) - Number(item.stake || 0)
  }));

  const blockers = itemRisks.flatMap((risk) => risk.blockers);
  const warnings = itemRisks.flatMap((risk) => risk.warnings);

  if (totals.stake > config.bankroll * (config.maxDailyExposurePercent / 100)) {
    blockers.push('Bet slip total exceeds daily bankroll exposure limit.');
  }

  return {
    decision: blockers.length ? 'SKIP' : warnings.length ? 'CAUTION' : 'OK',
    totals,
    itemRisks,
    warnings,
    blockers,
    byLeague
  };
}

export function createTrackableBetFromSlipItem(item = {}, result = {}) {
  return {
    ...item,
    trackedAt: new Date().toISOString(),
    status: result.status || 'open',
    closingOdds: result.closingOdds || null,
    result: result.result || null,
    profit: result.profit ?? null,
    clv: result.closingOdds ? Number(result.closingOdds) - Number(item.odds || 0) : null
  };
}
