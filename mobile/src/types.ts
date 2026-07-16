export type Tab = "home" | "picks" | "paper" | "analytics" | "settings";

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
