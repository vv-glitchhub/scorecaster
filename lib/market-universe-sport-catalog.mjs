import { MARKET_GROUPS, MARKET_META, normalizeMarketUniverseGroup } from "./market-universe-v1.mjs";
import { getFootballReferenceGroupSummary } from "./football-market-taxonomy-v2.mjs";

// Additional event-level market keys are documented by The Odds API but are not
// yet probability-enabled inside Market Universe V1. They are still safe to
// request because buildMarketUniverse falls back to PRICE_ONLY for unknown
// settlement modes instead of forcing an invalid EV calculation.
const DOCUMENTED_EVENT_MARKETS = new Set([
  ...Object.keys(MARKET_META),
  "h2h_3_way_h1",
  "totals_h1"
]);

const SOCCER = Object.freeze({
  featured: ["h2h", "spreads", "alternate_spreads", "totals"],
  goals: ["btts", "team_totals", "alternate_team_totals", "alternate_totals"],
  result: ["h2h_3_way", "draw_no_bet", "double_chance", "correct_score", "halftime_fulltime", "to_qualify"],
  periods: ["h2h_3_way_h1", "totals_h1", "btts_h1", "double_chance_h1", "correct_score_h1", "alternate_totals_h1", "team_totals_h1", "alternate_team_totals_h1"],
  corners_cards: ["alternate_spreads_corners", "alternate_totals_corners", "alternate_team_totals_corners", "corners_1x2", "alternate_spreads_cards", "alternate_totals_cards"],
  players: ["player_goal_scorer_anytime", "player_first_goal_scorer", "player_last_goal_scorer", "player_shots_on_target", "player_shots", "player_assists", "player_to_receive_card", "player_to_receive_red_card"]
});

const HOCKEY = Object.freeze({
  featured: ["h2h", "spreads", "totals"],
  goals: ["team_totals", "alternate_team_totals", "alternate_totals"],
  periods: ["alternate_totals_p1", "alternate_totals_p2", "alternate_totals_p3", "team_totals_p1", "team_totals_p2", "team_totals_p3"],
  players: ["player_goals", "player_shots_on_goal", "player_power_play_points"]
});

const BASKETBALL = Object.freeze({
  featured: ["h2h", "spreads", "totals"],
  players: ["player_points", "player_rebounds", "player_assists", "player_points_rebounds_assists"]
});

const FEATURED_ONLY = Object.freeze({ featured: ["h2h", "spreads", "totals"] });

function catalogForSport(sportKey = "") {
  const key = String(sportKey || "");
  if (key.startsWith("soccer_")) return SOCCER;
  if (key.startsWith("icehockey_")) return HOCKEY;
  if (key.startsWith("basketball_")) return BASKETBALL;
  return FEATURED_ONLY;
}

function safeProviderMarket(market) {
  return DOCUMENTED_EVENT_MARKETS.has(market);
}

export function getSafeMarketUniverseGroups(sportKey = "") {
  const catalog = catalogForSport(sportKey);
  const soccer = String(sportKey || "").startsWith("soccer_");
  return Object.entries(catalog).map(([key, markets]) => ({
    key,
    title: MARKET_GROUPS[key]?.title || key,
    markets: markets.filter(safeProviderMarket),
    ...(soccer ? getFootballReferenceGroupSummary(key) : {})
  }));
}

export function getSafeMarketUniverseRequestMarkets(sportKey, group) {
  const normalized = normalizeMarketUniverseGroup(group);
  if (!normalized) return [];
  const catalog = catalogForSport(sportKey);
  return (catalog[normalized] || []).filter(safeProviderMarket);
}
