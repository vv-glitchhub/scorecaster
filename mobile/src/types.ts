export type Tab = "home" | "picks" | "paper" | "settings";

export type Pick = {
  id?: string;
  eventId?: string;
  match?: string;
  homeTeam?: string;
  awayTeam?: string;
  selection?: string;
  label?: string;
  odds?: number;
  edge?: number;
  ev?: number;
  confidence?: number;
  decision?: string;
  productDecision?: "PLAY" | "CAUTION" | "SKIP";
  trustScore?: number;
  league?: string;
  leagueTitle?: string;
  sportKey?: string;
  bookmaker?: string;
  qualityGrade?: string;
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
  created_at: string;
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
