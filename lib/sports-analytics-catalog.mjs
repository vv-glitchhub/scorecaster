const freeze = (value) => Object.freeze(value);

const FAMILY_DEFINITIONS = freeze({
  identity: freeze({ label: "Identity and schedule", freshness: "daily", decisionRole: "eligibility" }),
  market: freeze({ label: "Odds and market structure", freshness: "live", decisionRole: "authoritative-price" }),
  result: freeze({ label: "Results and settlement", freshness: "post-event", decisionRole: "evaluation-only" }),
  event: freeze({ label: "Play-by-play and event data", freshness: "live", decisionRole: "context" }),
  tracking: freeze({ label: "Player, ball or puck tracking", freshness: "live", decisionRole: "context" }),
  player: freeze({ label: "Player performance and role", freshness: "daily", decisionRole: "context" }),
  team: freeze({ label: "Team strength and tactics", freshness: "daily", decisionRole: "context" }),
  availability: freeze({ label: "Lineups, injuries and suspensions", freshness: "minutes", decisionRole: "downgrade-only" }),
  workload: freeze({ label: "Fatigue, travel and workload", freshness: "daily", decisionRole: "downgrade-only" }),
  environment: freeze({ label: "Venue, weather and surface", freshness: "hourly", decisionRole: "context" }),
  officiating: freeze({ label: "Officials and rule environment", freshness: "daily", decisionRole: "context" }),
  tactical: freeze({ label: "Tactical state and matchup", freshness: "event", decisionRole: "context" }),
  expected: freeze({ label: "Expected-performance metrics", freshness: "event", decisionRole: "shadow-model" }),
  counterfactual: freeze({ label: "Decision and alternative-action value", freshness: "event", decisionRole: "research-only" }),
  quality: freeze({ label: "Data quality and provenance", freshness: "capture", decisionRole: "safety-gate" })
});

const sports = {
  soccer: {
    label: "Football / Soccer",
    scoreUnit: "goals",
    supportedMarkets: ["h2h", "draw-no-bet", "totals", "handicap", "team-totals", "player-props"],
    families: {
      event: ["shots", "passes", "carries", "pressures", "recoveries", "duels", "set-pieces", "possessions"],
      tracking: ["player-locations", "ball-location", "team-shape", "nearest-defender", "speed", "acceleration", "space-control"],
      player: ["minutes", "role", "finishing", "creation", "progression", "defending", "goalkeeping"],
      team: ["elo", "attack-strength", "defence-strength", "possession-style", "pressing-style", "set-piece-strength"],
      expected: ["xg", "post-shot-xg", "xa", "xthreat", "expected-possession-value", "expected-goals-chain", "expected-goals-build-up", "xpress", "xrun", "xspace", "prevented-threat"],
      counterfactual: ["expected-decision-value", "pass-versus-shot-value", "alternative-receiver-value", "off-ball-value"]
    }
  },
  ice_hockey: {
    label: "Ice Hockey",
    scoreUnit: "goals",
    supportedMarkets: ["h2h", "moneyline", "puck-line", "totals", "team-totals", "player-props"],
    families: {
      event: ["shots", "attempts", "entries", "exits", "passes", "faceoffs", "penalties", "possessions", "rebounds"],
      tracking: ["puck-location", "skater-location", "speed", "acceleration", "distance", "shot-speed", "zone-time", "goalie-lateral-movement"],
      player: ["time-on-ice", "line-role", "usage", "shooting", "passing", "forecheck", "defence", "goalie-profile"],
      team: ["elo", "five-on-five-strength", "special-teams", "pace", "forecheck-style", "rush-profile"],
      expected: ["xg", "post-shot-xg", "goals-saved-above-expected", "expected-zone-entry-value", "expected-pass-value", "expected-rebound-value", "expected-possession-value", "chance-creation-value"],
      counterfactual: ["expected-decision-value", "shot-versus-pass-value", "line-change-value", "off-puck-value", "prevented-chance-value"]
    }
  },
  basketball: {
    label: "Basketball",
    scoreUnit: "points",
    supportedMarkets: ["h2h", "spread", "totals", "team-totals", "quarters", "player-props"],
    families: {
      event: ["possessions", "shots", "passes", "turnovers", "screens", "rebounds", "fouls", "lineups"],
      tracking: ["player-location", "ball-location", "speed", "distance", "defender-distance", "touches", "drives", "paint-touches", "spacing"],
      player: ["usage", "shot-profile", "playmaking", "rebounding", "defence", "on-off", "role"],
      team: ["pace", "offensive-rating", "defensive-rating", "lineup-strength", "shot-profile", "transition-rate"],
      expected: ["expected-points-per-shot", "expected-possession-value", "shot-quality", "expected-assist-value", "expected-rebound-value", "expected-turnover-cost", "lineup-adjusted-impact"],
      counterfactual: ["expected-decision-value", "shot-versus-pass-value", "screen-value", "gravity-value", "rotation-created-value", "off-ball-spacing-value"]
    }
  },
  american_football: {
    label: "American Football",
    scoreUnit: "points",
    supportedMarkets: ["h2h", "spread", "totals", "team-totals", "quarters", "player-props"],
    families: {
      event: ["plays", "drives", "downs", "routes", "targets", "blocks", "tackles", "penalties"],
      tracking: ["player-location", "speed", "acceleration", "separation", "time-to-throw", "pocket-shape", "coverage-shell"],
      player: ["usage", "route-role", "target-share", "pressure-rate", "blocking", "coverage", "tackling"],
      team: ["pace", "success-rate", "explosive-rate", "red-zone-strength", "special-teams", "situational-tendency"],
      expected: ["expected-points", "epa", "win-probability", "completion-probability", "cpoe", "expected-rushing-yards", "expected-yards-after-catch", "tackle-value"],
      counterfactual: ["expected-decision-value", "play-call-value", "route-choice-value", "fourth-down-value", "coverage-responsibility-value"]
    }
  },
  baseball: {
    label: "Baseball",
    scoreUnit: "runs",
    supportedMarkets: ["h2h", "run-line", "totals", "team-totals", "innings", "player-props"],
    families: {
      event: ["pitches", "plate-appearances", "batted-balls", "baserunning", "fielding-plays", "lineups"],
      tracking: ["pitch-flight", "bat-path", "ball-flight", "fielder-location", "runner-location", "reaction-time"],
      player: ["pitch-arsenal", "command", "contact-quality", "plate-discipline", "speed", "fielding", "catching"],
      team: ["lineup-strength", "bullpen-depth", "defensive-quality", "platoon-profile", "park-adjusted-strength"],
      expected: ["xba", "xslg", "xwoba", "expected-runs", "run-expectancy", "catch-probability", "outs-above-average", "expected-total-bases"],
      counterfactual: ["expected-pitch-value", "pitch-sequence-value", "defensive-positioning-value", "baserunning-decision-value"]
    }
  },
  tennis: {
    label: "Tennis",
    scoreUnit: "points",
    supportedMarkets: ["h2h", "sets", "games", "totals", "handicap", "player-props"],
    families: {
      event: ["points", "serves", "returns", "rallies", "shots", "break-points", "medical-timeouts"],
      tracking: ["ball-trajectory", "serve-location", "shot-location", "player-location", "court-coverage", "movement-distance"],
      player: ["serve-profile", "return-profile", "surface-profile", "rally-tolerance", "handedness", "pressure-performance"],
      team: ["doubles-pair-strength", "serve-order", "formation"],
      expected: ["expected-point-win", "expected-game-win", "expected-set-win", "expected-match-win", "serve-quality", "return-quality", "fatigue-adjusted-point-value"],
      counterfactual: ["expected-shot-selection-value", "serve-direction-value", "return-position-value", "rally-pattern-value"]
    }
  },
  golf: {
    label: "Golf",
    scoreUnit: "strokes",
    supportedMarkets: ["tournament-winner", "top-finish", "matchup", "round-score", "make-cut", "player-props"],
    families: {
      event: ["shots", "lie", "club", "start-location", "end-location", "penalties", "hole-score"],
      tracking: ["ball-flight", "carry", "total-distance", "apex", "spin", "launch", "dispersion", "landing-angle"],
      player: ["distance-profile", "club-profile", "proximity-profile", "dispersion-profile", "miss-tendency", "putting-profile"],
      team: ["team-format-lineup", "pairing-strength"],
      expected: ["strokes-gained", "expected-strokes-to-hole", "expected-proximity", "proximity-gained", "expected-green-hit", "expected-birdie-created", "target-zone-rate", "bad-shot-avoidance"],
      counterfactual: ["club-selection-value", "target-selection-value", "layup-versus-attack-value", "risk-adjusted-shot-value"]
    }
  },
  handball: {
    label: "Handball",
    scoreUnit: "goals",
    supportedMarkets: ["h2h", "spread", "totals", "team-totals", "player-props"],
    families: {
      event: ["shots", "passes", "turnovers", "fast-breaks", "suspensions", "possessions"],
      tracking: ["player-location", "ball-location", "defender-distance", "goalkeeper-position", "speed"],
      player: ["shot-profile", "creation", "defence", "goalkeeper-profile", "role"],
      team: ["pace", "attack-strength", "defence-strength", "transition-profile", "seven-on-six-profile"],
      expected: ["xg", "post-shot-xg", "expected-possession-value", "goalkeeper-goals-prevented"],
      counterfactual: ["expected-decision-value", "shot-versus-pass-value", "defensive-positioning-value"]
    }
  },
  volleyball: {
    label: "Volleyball",
    scoreUnit: "points",
    supportedMarkets: ["h2h", "sets", "points", "handicap", "totals", "player-props"],
    families: {
      event: ["serves", "receptions", "sets", "attacks", "blocks", "digs", "rotations", "rallies"],
      tracking: ["player-location", "ball-trajectory", "jump-height", "approach-speed", "block-position"],
      player: ["serve-profile", "reception-quality", "setter-distribution", "attack-profile", "block-profile"],
      team: ["sideout-rate", "break-point-rate", "rotation-strength", "serve-pressure", "block-defence-system"],
      expected: ["expected-rally-win", "expected-touch-value", "expected-sideout-value", "expected-serve-value"],
      counterfactual: ["serve-target-value", "setter-decision-value", "attack-lane-value", "block-assignment-value"]
    }
  },
  floorball: {
    label: "Floorball",
    scoreUnit: "goals",
    supportedMarkets: ["h2h", "spread", "totals", "team-totals"],
    families: {
      event: ["shots", "passes", "possessions", "entries", "turnovers", "penalties"],
      tracking: ["player-location", "ball-location", "speed", "shot-location", "goalkeeper-position"],
      player: ["shot-profile", "creation", "transition", "defence", "goalkeeper-profile"],
      team: ["pace", "attack-strength", "defence-strength", "special-teams", "transition-profile"],
      expected: ["xg", "post-shot-xg", "expected-possession-value", "chance-creation-value"],
      counterfactual: ["expected-decision-value", "shot-versus-pass-value", "off-ball-value"]
    }
  },
  rugby: {
    label: "Rugby",
    scoreUnit: "points",
    supportedMarkets: ["h2h", "spread", "totals", "team-totals", "player-props"],
    families: {
      event: ["carries", "passes", "kicks", "rucks", "scrums", "lineouts", "tackles", "penalties"],
      tracking: ["player-location", "ball-location", "speed", "defensive-line", "space-control"],
      player: ["carry-profile", "kick-profile", "breakdown-impact", "tackling", "set-piece-role"],
      team: ["territory", "possession", "phase-efficiency", "set-piece-strength", "discipline"],
      expected: ["expected-points", "expected-possession-value", "expected-territory-value", "try-probability", "tackle-prevention-value"],
      counterfactual: ["kick-versus-carry-value", "phase-decision-value", "line-break-created-value"]
    }
  },
  cricket: {
    label: "Cricket",
    scoreUnit: "runs",
    supportedMarkets: ["h2h", "innings", "totals", "wickets", "player-props"],
    families: {
      event: ["deliveries", "shots", "wickets", "partnerships", "field-settings", "overs"],
      tracking: ["ball-trajectory", "bat-contact", "fielder-location", "release", "swing", "seam"],
      player: ["batter-profile", "bowler-profile", "matchup", "fielding", "role"],
      team: ["batting-depth", "bowling-depth", "powerplay-profile", "death-overs-profile", "venue-profile"],
      expected: ["expected-runs", "win-probability", "wicket-probability", "expected-boundary-value", "expected-dot-ball-value"],
      counterfactual: ["shot-selection-value", "delivery-selection-value", "field-placement-value"]
    }
  },
  combat_sports: {
    label: "MMA and Boxing",
    scoreUnit: "rounds",
    supportedMarkets: ["h2h", "method", "round", "totals", "goes-distance"],
    families: {
      event: ["strikes", "takedowns", "control", "submissions", "knockdowns", "round-scores"],
      tracking: ["fighter-location", "distance", "movement", "strike-speed", "impact", "cage-control"],
      player: ["stance", "reach", "pace", "accuracy", "defence", "durability", "grappling-profile"],
      team: ["camp", "corner", "style-matchup"],
      expected: ["expected-damage", "finish-probability", "round-win-probability", "expected-control-value"],
      counterfactual: ["strike-selection-value", "takedown-attempt-value", "position-transition-value", "risk-adjusted-finish-value"]
    }
  },
  motorsport: {
    label: "Motorsport",
    scoreUnit: "time",
    supportedMarkets: ["race-winner", "podium", "head-to-head", "qualifying", "fastest-lap", "points-finish"],
    families: {
      event: ["laps", "sectors", "pit-stops", "overtakes", "flags", "tyre-stints"],
      tracking: ["gps-position", "speed", "acceleration", "braking", "throttle", "energy", "tyre-state"],
      player: ["driver-pace", "qualifying-pace", "racecraft", "tyre-management", "wet-weather-profile"],
      team: ["car-performance", "strategy", "pit-crew", "reliability", "upgrade-package"],
      expected: ["expected-lap-time", "expected-race-position", "pit-loss-expectancy", "overtake-probability", "retirement-probability"],
      counterfactual: ["pit-strategy-value", "tyre-choice-value", "attack-versus-save-value", "undercut-value"]
    }
  },
  esports: {
    label: "Esports",
    scoreUnit: "maps",
    supportedMarkets: ["h2h", "maps", "rounds", "handicap", "totals", "player-props"],
    families: {
      event: ["rounds", "kills", "deaths", "assists", "objectives", "economy", "drafts"],
      tracking: ["player-position", "aim", "movement", "vision", "resource-state"],
      player: ["role", "map-profile", "weapon-profile", "agent-or-hero-pool", "clutch"],
      team: ["map-pool", "draft-profile", "economy-management", "objective-control", "side-bias"],
      expected: ["expected-round-win", "expected-map-win", "expected-damage", "expected-objective-value", "economy-adjusted-strength"],
      counterfactual: ["buy-decision-value", "draft-choice-value", "rotation-value", "engagement-selection-value"]
    }
  }
};

const COMMON_FAMILIES = ["identity", "market", "result", "availability", "workload", "environment", "officiating", "quality"];

function normalizeSport(sport) {
  return String(sport || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeMetric(metric) {
  return String(metric || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function withCommonFamilies(definition) {
  const families = {};
  for (const family of COMMON_FAMILIES) families[family] = [];
  for (const [family, metrics] of Object.entries(definition.families || {})) {
    families[family] = [...new Set((metrics || []).map(normalizeMetric).filter(Boolean))];
  }
  return freeze({
    ...definition,
    supportedMarkets: freeze([...(definition.supportedMarkets || [])]),
    families: freeze(Object.fromEntries(Object.entries(families).map(([key, values]) => [key, freeze(values)])))
  });
}

export const SPORTS_ANALYTICS_CATALOG = freeze(Object.fromEntries(
  Object.entries(sports).map(([key, definition]) => [key, withCommonFamilies(definition)])
));

export const SPORTS_ANALYTICS_FAMILIES = FAMILY_DEFINITIONS;

export function listSportsAnalyticsSports() {
  return Object.entries(SPORTS_ANALYTICS_CATALOG).map(([sport, definition]) => ({
    sport,
    label: definition.label,
    scoreUnit: definition.scoreUnit,
    supportedMarkets: [...definition.supportedMarkets],
    metricCount: Object.values(definition.families).reduce((sum, values) => sum + values.length, 0)
  }));
}

export function getSportsAnalyticsDefinition(sport) {
  return SPORTS_ANALYTICS_CATALOG[normalizeSport(sport)] || null;
}

export function listSportsAnalyticsMetrics(sport, family = "") {
  const definition = getSportsAnalyticsDefinition(sport);
  if (!definition) return [];
  const normalizedFamily = String(family || "").trim().toLowerCase();
  if (normalizedFamily) return [...(definition.families[normalizedFamily] || [])];
  return Object.entries(definition.families).flatMap(([familyName, metrics]) => metrics.map((metric) => ({ family: familyName, metric })));
}

export function getSportsAnalyticsCoverage(sport, availableMetrics = []) {
  const definition = getSportsAnalyticsDefinition(sport);
  if (!definition) return null;
  const available = new Set((availableMetrics || []).map(normalizeMetric));
  const rows = Object.entries(definition.families).map(([family, metrics]) => {
    const matched = metrics.filter((metric) => available.has(metric));
    return {
      family,
      requiredMetricCount: metrics.length,
      availableMetricCount: matched.length,
      coverage: metrics.length ? matched.length / metrics.length : null,
      availableMetrics: matched,
      missingMetrics: metrics.filter((metric) => !available.has(metric))
    };
  });
  const required = rows.reduce((sum, row) => sum + row.requiredMetricCount, 0);
  const matched = rows.reduce((sum, row) => sum + row.availableMetricCount, 0);
  return {
    sport: normalizeSport(sport),
    coverage: required ? matched / required : null,
    availableMetricCount: matched,
    requiredMetricCount: required,
    families: rows
  };
}
