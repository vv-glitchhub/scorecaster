export type Tab = "home" | "picks" | "watchlist" | "agent" | "paper" | "analytics" | "settings";

export type Pick = {
  id?: string;
  eventId?: string;
  gameId?: string;
  match?: string;
  homeTeam?: string;
  awayTeam?: string;
  selection?: string;
  label?: string;
  odds?: number;
  bestOdds?: number;
  averageOdds?: number;
  fairOdds?: number;
  edge?: number;
  ev?: number;
  confidence?: number;
  confidenceLabel?: string;
  modelProbability?: number;
  consensusProbability?: number;
  marketProbability?: number;
  decision?: string;
  productDecision?: "PLAY" | "CAUTION" | "SKIP";
  trustScore?: number;
  league?: string;
  leagueTitle?: string;
  sportKey?: string;
  bookmaker?: string;
  bookmakerCount?: number;
  qualityGrade?: string;
  qualityNotes?: string[];
  commenceTime?: string;
  lastUpdate?: string;
  freshnessLabel?: string;
  dataAgeHours?: number | null;
  modelMode?: string;
  edgeType?: string;
  explanation?: string;
  dataQuality?: {
    bookmakerCount?: number;
    sampleCount?: number;
    probabilityDispersion?: number;
    averageOverround?: number;
    freshness?: string;
    ageHours?: number | null;
    confidence?: number;
  };
};

export type AgentDecision = Pick & {
  decision: "PLAY" | "WATCH" | "SKIP";
  baseDecision?: string;
  agentVersion?: string;
  priorityScore?: number;
  robustnessScore?: number;
  suggestedStake?: number;
  bankroll?: number;
  maxStakePercent?: number;
  decisionReason?: string;
  portfolioReason?: string | null;
  evidence?: string[];
  counterArguments?: string[];
  missingEvidence?: string[];
  explanationTicket?: string | null;
  selfLearning?: {
    version?: string;
    status?: string;
    mode?: string;
    sampleSize?: number;
    promotionEligible?: boolean;
    driftStatus?: string;
    probabilityApplied?: boolean;
  };
  stressTest?: {
    probability?: number;
    lower?: number;
    upper?: number;
    baseEv?: number;
    downsideEv?: number;
    upsideEv?: number;
    robustPositive?: boolean;
  };
  priceGuard?: {
    currentOdds?: number;
    breakEvenOdds?: number;
    minimumPlayOdds?: number;
    conservativeBreakEvenOdds?: number;
    buffer?: number;
  };
  learningSignal?: {
    status?: string;
    note?: string;
    sampleSize?: number;
    segment?: string | null;
  };
};

export type ModelLabMetricSet = {
  count?: number;
  brierScore?: number | null;
  logLoss?: number | null;
  expectedWinRate?: number | null;
  actualWinRate?: number | null;
  calibrationGap?: number | null;
};

export type AgentModelLab = {
  version?: string;
  mode?: string;
  status?: string;
  sampleSize?: number;
  minimumSamples?: number;
  trainSize?: number;
  holdoutSize?: number;
  champion?: { id?: string; holdout?: ModelLabMetricSet } | null;
  challenger?: {
    id?: string;
    holdout?: ModelLabMetricSet;
    holdoutImprovement?: { brier?: number; logLoss?: number; calibration?: number };
  } | null;
  drift?: {
    status?: string;
    brierChange?: number | null;
    calibrationGapChange?: number | null;
    meanProbabilityChange?: number | null;
    note?: string;
  };
  promotion?: {
    eligible?: boolean;
    reasons?: string[];
  };
  safety?: {
    chronologicalSplit?: boolean;
    candidateSelectedOnTrainingOnly?: boolean;
    evaluatedOnUntouchedHoldout?: boolean;
    probabilityAppliedToProduction?: boolean;
  };
};

export type AgentPortfolio = {
  ok: boolean;
  agentVersion?: string;
  source: string;
  fixtureSource?: string;
  generatedAt: string;
  paperOnly: true;
  signingConfigured: boolean;
  explanationMode: string;
  learningMode?: string;
  modelLab?: AgentModelLab;
  warnings?: string[];
  counts: { PLAY: number; WATCH: number; SKIP: number };
  totalAllocated: number;
  totalCap: number;
  leagueCap: number;
  exposurePercent: number;
  decisions: AgentDecision[];
};

export type AgentExplanationPayload = {
  ok: boolean;
  enhanced: boolean;
  authoritative?: boolean;
  decisionHash?: string;
  model?: string;
  reason?: string;
  explanation: {
    summary: string;
    strongestReason: string;
    counterpoint: string;
    nextChecks: string[];
    limitation: string;
    mode?: string;
  };
};

export type PaperBetRawPick = {
  source?: string | null;
  eventId?: string | null;
  modelProbability?: number | null;
  impliedProbability?: number | null;
  decision?: string | null;
  qualityGrade?: string | null;
  qualityScore?: number | null;
  settlementSource?: string | null;
  settledAt?: string | null;
  completedAt?: string | null;
  finalScore?: {
    homeTeam?: string;
    awayTeam?: string;
    homeScore?: number;
    awayScore?: number;
  } | null;
};

export type PaperBet = {
  id: string;
  client_ref?: string | null;
  label: string;
  match: string;
  odds: number;
  stake: number;
  status: string;
  result?: string | null;
  profit: number | null;
  closing_odds: number | null;
  clv: number | null;
  league?: string | null;
  sport?: string | null;
  bookmaker?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  edge?: number | null;
  ev?: number | null;
  confidence?: number | null;
  raw_pick?: PaperBetRawPick | null;
  created_at: string;
  updated_at?: string;
};

export type Bankroll = {
  bankroll: number;
  max_stake_percent: number;
  max_daily_exposure_percent: number;
  max_single_league_exposure_percent?: number;
  min_edge?: number;
  min_confidence?: number;
  paper_trading_mode: boolean;
};
