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

export type PaperBet = {
  id: string;
  label: string;
  match: string;
  odds: number;
  stake: number;
  status: string;
  profit: number | null;
  closing_odds: number | null;
  clv: number | null;
  league?: string | null;
  sport?: string | null;
  bookmaker?: string | null;
  edge?: number | null;
  ev?: number | null;
  confidence?: number | null;
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
