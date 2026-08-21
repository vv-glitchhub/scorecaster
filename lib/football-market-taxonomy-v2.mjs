export const FOOTBALL_MARKET_TAXONOMY_VERSION = "scorecaster-football-market-taxonomy-v2";

const TARGETS = Object.freeze([
  { key: "match_result", group: "featured", fi: "Voittaja (1X2)", en: "Match winner (1X2)", providerKeys: ["h2h", "h2h_3_way"], coverage: "exact" },
  { key: "first_goal_team", group: "featured", fi: "1. maali", en: "First team to score", providerKeys: [], coverage: "provider-gap" },
  { key: "result_handicap", group: "featured", fi: "1X2-tasoitus", en: "Result handicap", providerKeys: ["spreads", "alternate_spreads"], coverage: "partial", note: "Configured provider exposes handicap/spread markets, but not the exact three-way settlement shown in every bookmaker UI." },
  { key: "match_totals", group: "goals", fi: "Maalit Yli/Alle", en: "Match goals over/under", providerKeys: ["totals", "alternate_totals"], coverage: "exact" },
  { key: "team_totals", group: "goals", fi: "Joukkueen maalit Yli/Alle", en: "Team goals over/under", providerKeys: ["team_totals", "alternate_team_totals"], coverage: "exact" },
  { key: "both_teams_score", group: "goals", fi: "Molemmat joukkueet tekevät maalin", en: "Both teams to score", providerKeys: ["btts"], coverage: "exact" },
  { key: "double_chance", group: "result", fi: "Tuplamerkki", en: "Double chance", providerKeys: ["double_chance"], coverage: "exact" },
  { key: "draw_no_bet", group: "result", fi: "Tasapeli ei vetoa", en: "Draw no bet", providerKeys: ["draw_no_bet"], coverage: "exact" },
  { key: "correct_score", group: "result", fi: "Lopputulos", en: "Correct score", providerKeys: ["correct_score"], coverage: "exact" },
  { key: "halftime_fulltime", group: "result", fi: "Puoliaika/lopputulos", en: "Half-time / full-time", providerKeys: ["halftime_fulltime"], coverage: "exact" },
  { key: "first_half_result", group: "periods", fi: "1. puoliaika - 1X2", en: "1st half - 1X2", providerKeys: ["h2h_3_way_h1", "h2h_h1"], coverage: "exact" },
  { key: "first_half_totals", group: "periods", fi: "1. puoliajan maalit Yli/Alle", en: "1st half goals over/under", providerKeys: ["totals_h1", "alternate_totals_h1"], coverage: "exact" },
  { key: "first_half_btts", group: "periods", fi: "Molemmat tekevät maalin 1. puoliajalla", en: "Both teams to score in 1st half", providerKeys: ["btts_h1"], coverage: "exact" },
  { key: "first_half_first_goal", group: "timing", fi: "1. puoliaika - 1. maali", en: "1st half - first goal", providerKeys: [], coverage: "provider-gap" },
  { key: "corners_totals", group: "corners_cards", fi: "Kulmapotkut Yli/Alle", en: "Corners over/under", providerKeys: ["alternate_totals_corners"], coverage: "exact" },
  { key: "team_corners", group: "corners_cards", fi: "Joukkueen kulmapotkut Yli/Alle", en: "Team corners over/under", providerKeys: ["alternate_team_totals_corners"], coverage: "exact" },
  { key: "most_corners", group: "corners_cards", fi: "Eniten kulmapotkuja", en: "Most corners", providerKeys: ["corners_1x2"], coverage: "exact" },
  { key: "corners_handicap", group: "corners_cards", fi: "Kulmapotkujen tasoitus", en: "Corners handicap", providerKeys: ["alternate_spreads_corners"], coverage: "exact" },
  { key: "cards_totals", group: "corners_cards", fi: "Kortit yhteensä - Yli/Alle", en: "Cards total over/under", providerKeys: ["alternate_totals_cards"], coverage: "exact" },
  { key: "cards_handicap", group: "corners_cards", fi: "Korttien tasoitus", en: "Cards handicap", providerKeys: ["alternate_spreads_cards"], coverage: "exact" },
  { key: "most_cards", group: "corners_cards", fi: "Eniten kortteja", en: "Most cards", providerKeys: [], coverage: "provider-gap" },
  { key: "goalscorers", group: "players", fi: "Maalintekijät", en: "Goalscorers", providerKeys: ["player_goal_scorer_anytime", "player_first_goal_scorer", "player_last_goal_scorer"], coverage: "exact" },
  { key: "player_shots", group: "players", fi: "Pelaajan laukaukset", en: "Player shots", providerKeys: ["player_shots", "player_shots_on_target"], coverage: "exact" },
  { key: "player_assists", group: "players", fi: "Pelaajan syötöt", en: "Player assists", providerKeys: ["player_assists"], coverage: "exact" },
  { key: "player_cards", group: "players", fi: "Pelaajan kortit", en: "Player cards", providerKeys: ["player_to_receive_card", "player_to_receive_red_card"], coverage: "exact" },
  { key: "winner_total_25", group: "combinations", fi: "Voittaja (1X2) ja maalimäärä Yli/Alle 2,5", en: "Winner + total 2.5", providerKeys: [], coverage: "provider-gap" },
  { key: "winner_total_35", group: "combinations", fi: "Voittaja (1X2) ja maalimäärä Yli/Alle 3,5", en: "Winner + total 3.5", providerKeys: [], coverage: "provider-gap" },
  { key: "winner_total_45", group: "combinations", fi: "Voittaja (1X2) ja maalimäärä Yli/Alle 4,5", en: "Winner + total 4.5", providerKeys: [], coverage: "provider-gap" },
  { key: "result_btts", group: "combinations", fi: "1X2 ja molemmat joukkueet tekevät maalin", en: "1X2 + both teams to score", providerKeys: [], coverage: "provider-gap" },
  { key: "btts_total_25", group: "combinations", fi: "Molemmat tekevät maalin ja maalimäärä Yli/Alle 2,5", en: "BTTS + total 2.5", providerKeys: [], coverage: "provider-gap" },
  { key: "btts_total_35", group: "combinations", fi: "Molemmat tekevät maalin ja maalimäärä Yli/Alle 3,5", en: "BTTS + total 3.5", providerKeys: [], coverage: "provider-gap" },
  { key: "btts_total_45", group: "combinations", fi: "Molemmat tekevät maalin ja maalimäärä Yli/Alle 4,5", en: "BTTS + total 4.5", providerKeys: [], coverage: "provider-gap" },
  { key: "winning_margin", group: "combinations", fi: "Voittomarginaali", en: "Winning margin", providerKeys: [], coverage: "provider-gap" },
  { key: "special_combinations", group: "combinations", fi: "Valmisyhdistelmät", en: "Special combinations", providerKeys: [], coverage: "provider-gap" },
  { key: "first_goal_10min", group: "timing", fi: "Ensimmäisen maalin syntyaika (10 minuutin välein)", en: "First goal time (10-minute bands)", providerKeys: [], coverage: "provider-gap" },
  { key: "first_goal_15min", group: "timing", fi: "Ensimmäisen maalin syntyaika (15 minuutin välein)", en: "First goal time (15-minute bands)", providerKeys: [], coverage: "provider-gap" }
]);

function cleanGroup(value) {
  return String(value || "").trim().toLowerCase();
}

export function getFootballMarketReferenceTargets(group = null) {
  const normalized = group ? cleanGroup(group) : null;
  return TARGETS
    .filter((target) => !normalized || target.group === normalized)
    .map((target) => ({ ...target, providerKeys: [...target.providerKeys] }));
}

export function getFootballReferenceGroupSummary(group) {
  const targets = getFootballMarketReferenceTargets(group);
  return {
    targetCount: targets.length,
    providerBackedTargetCount: targets.filter((target) => target.providerKeys.length > 0).length,
    providerGapTargetCount: targets.filter((target) => target.providerKeys.length === 0).length
  };
}

export function buildFootballMarketCoverage(group, offeredMarketKeys = null) {
  const offered = offeredMarketKeys === null ? null : new Set((offeredMarketKeys || []).map((key) => String(key)));
  const targets = getFootballMarketReferenceTargets(group).map((target) => {
    const matchedProviderKeys = offered === null
      ? []
      : target.providerKeys.filter((key) => offered.has(key));
    let status = "provider-gap";
    if (target.providerKeys.length) status = offered === null ? "provider-capable" : matchedProviderKeys.length ? "available" : "not-offered";
    return {
      ...target,
      status,
      matchedProviderKeys
    };
  });
  return {
    version: FOOTBALL_MARKET_TAXONOMY_VERSION,
    group: cleanGroup(group),
    targetCount: targets.length,
    availableCount: targets.filter((target) => target.status === "available").length,
    providerCapableCount: targets.filter((target) => target.providerKeys.length > 0).length,
    providerGapCount: targets.filter((target) => target.status === "provider-gap").length,
    notOfferedCount: targets.filter((target) => target.status === "not-offered").length,
    targets
  };
}
