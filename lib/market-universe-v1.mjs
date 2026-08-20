import { analyzeConsensusSelection, BOOKMAKER_ALL } from "./betting-excellence-engine.mjs";
import { calculateDataConfidence, confidenceLabel, freshnessFromTimestamp, median, standardDeviation } from "./market-consensus-engine.mjs";

const MARKET_GROUPS = Object.freeze({
  featured: {
    title: "Featured",
    markets: ["h2h", "spreads", "totals"]
  },
  goals: {
    title: "Goals & team totals",
    markets: ["btts", "team_totals", "alternate_team_totals", "alternate_totals"]
  },
  result: {
    title: "Match result & score",
    markets: ["h2h_3_way", "draw_no_bet", "double_chance", "correct_score", "halftime_fulltime", "to_qualify"]
  },
  periods: {
    title: "Periods / halves",
    markets: [
      "btts_h1", "double_chance_h1", "correct_score_h1", "alternate_totals_h1",
      "team_totals_h1", "alternate_team_totals_h1", "alternate_totals_p1",
      "alternate_totals_p2", "alternate_totals_p3", "team_totals_p1", "team_totals_p2", "team_totals_p3"
    ]
  },
  corners_cards: {
    title: "Corners & cards",
    markets: [
      "alternate_spreads_corners", "alternate_totals_corners", "alternate_team_totals_corners",
      "corners_1x2", "alternate_spreads_cards", "alternate_totals_cards"
    ]
  },
  players: {
    title: "Player props",
    markets: [
      "player_goal_scorer_anytime", "player_first_goal_scorer", "player_last_goal_scorer",
      "player_shots_on_target", "player_shots", "player_assists", "player_to_receive_card",
      "player_to_receive_red_card", "player_goals", "player_shots_on_goal", "player_power_play_points",
      "player_points", "player_rebounds", "player_points_rebounds_assists"
    ]
  }
});

const MARKET_META = Object.freeze({
  h2h: ["Moneyline / 1X2", "exclusive"],
  h2h_3_way: ["3-way result", "exclusive"],
  btts: ["Both teams to score", "binary"],
  btts_h1: ["Both teams to score · 1st half", "binary"],
  to_qualify: ["To qualify", "exclusive"],
  totals: ["Match total", "line"],
  alternate_totals: ["Alternate totals", "line"],
  team_totals: ["Team totals", "subject-line"],
  alternate_team_totals: ["Alternate team totals", "subject-line"],
  alternate_totals_h1: ["1st half totals", "line"],
  team_totals_h1: ["1st half team totals", "subject-line"],
  alternate_team_totals_h1: ["1st half alternate team totals", "subject-line"],
  alternate_totals_p1: ["1st period totals", "line"],
  alternate_totals_p2: ["2nd period totals", "line"],
  alternate_totals_p3: ["3rd period totals", "line"],
  team_totals_p1: ["1st period team totals", "subject-line"],
  team_totals_p2: ["2nd period team totals", "subject-line"],
  team_totals_p3: ["3rd period team totals", "subject-line"],
  spreads: ["Handicap / spread", "spread-line"],
  alternate_spreads: ["Alternate handicap", "spread-line"],
  alternate_totals_corners: ["Corners total", "line"],
  alternate_team_totals_corners: ["Team corners", "subject-line"],
  alternate_spreads_corners: ["Corners handicap", "spread-line"],
  alternate_totals_cards: ["Cards total", "line"],
  alternate_spreads_cards: ["Cards handicap", "spread-line"],
  player_shots_on_target: ["Player shots on target", "subject-line"],
  player_shots: ["Player shots", "subject-line"],
  player_assists: ["Player assists", "subject-line"],
  player_goals: ["Player goals", "subject-line"],
  player_shots_on_goal: ["Player shots on goal", "subject-line"],
  player_power_play_points: ["Player power-play points", "subject-line"],
  player_points: ["Player points", "subject-line"],
  player_rebounds: ["Player rebounds", "subject-line"],
  player_points_rebounds_assists: ["Player PRA", "subject-line"],
  draw_no_bet: ["Draw no bet", "price-only"],
  double_chance: ["Double chance", "price-only"],
  double_chance_h1: ["Double chance · 1st half", "price-only"],
  correct_score: ["Correct score", "price-only"],
  correct_score_h1: ["Correct score · 1st half", "price-only"],
  halftime_fulltime: ["Half-time / full-time", "price-only"],
  corners_1x2: ["Corners 1X2", "price-only"],
  player_goal_scorer_anytime: ["Anytime goalscorer", "price-only"],
  player_first_goal_scorer: ["First goalscorer", "price-only"],
  player_last_goal_scorer: ["Last goalscorer", "price-only"],
  player_to_receive_card: ["Player to receive card", "price-only"],
  player_to_receive_red_card: ["Player to receive red card", "price-only"]
});

function clean(value, limit = 160) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validOdds(value) {
  const odds = finite(value);
  return odds !== null && odds > 1.001 && odds < 1000 ? odds : null;
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function subject(outcome = {}) {
  return clean(outcome.description || outcome.participant || outcome.player || outcome.team || "");
}

function noPushLine(point) {
  const value = finite(point);
  if (value === null) return false;
  const fraction = Math.abs(value - Math.trunc(value));
  return Math.abs(fraction - 0.5) < 0.0001;
}

function unitKey(mode, outcome = {}) {
  const point = finite(outcome.point);
  const who = subject(outcome).toLowerCase() || "event";
  if (mode === "line") return `line:${point}`;
  if (mode === "subject-line") return `subject:${who}:${point}`;
  if (mode === "spread-line") return `spread:${point === null ? "none" : Math.abs(point)}`;
  return "main";
}

function selectionKey(outcome = {}) {
  const who = subject(outcome);
  const name = clean(outcome.name);
  const point = finite(outcome.point);
  return [who, name, point === null ? "" : String(point)].filter(Boolean).join(" · ");
}

function marketMeta(key) {
  const [title, mode] = MARKET_META[key] || [key, "price-only"];
  return { key, title, mode };
}

function baseEligibility(meta, point) {
  if (meta.mode === "exclusive" || meta.mode === "binary") return { eligible: true, reason: null };
  if (["line", "subject-line", "spread-line"].includes(meta.mode)) {
    return noPushLine(point)
      ? { eligible: true, reason: null }
      : { eligible: false, reason: "Push/split settlement requires a dedicated probability model; shown as price comparison only." };
  }
  return { eligible: false, reason: "This market is visible for price comparison, but Scorecaster will not force it through an invalid no-vig/EV formula." };
}

export function normalizeMarketUniverseGroup(value) {
  const key = clean(value || "goals", 40).toLowerCase();
  return MARKET_GROUPS[key] ? key : null;
}

export function getMarketUniverseGroups(sportKey = "") {
  const soccer = String(sportKey).startsWith("soccer_");
  const hockey = String(sportKey).startsWith("icehockey_");
  const basketball = String(sportKey).startsWith("basketball_");
  return Object.entries(MARKET_GROUPS)
    .filter(([key]) => {
      if (["goals", "result", "corners_cards"].includes(key)) return soccer || (key === "goals" && hockey);
      if (key === "players") return soccer || hockey || basketball;
      return true;
    })
    .map(([key, value]) => ({ key, title: value.title, markets: value.markets }));
}

export function getMarketUniverseRequestMarkets(sportKey, group) {
  const normalized = normalizeMarketUniverseGroup(group);
  if (!normalized) return [];
  const allowedGroups = new Set(getMarketUniverseGroups(sportKey).map((item) => item.key));
  if (!allowedGroups.has(normalized)) return [];
  return MARKET_GROUPS[normalized].markets.filter((key) => MARKET_META[key]);
}

export function buildMarketUniverse(event = {}, options = {}) {
  const now = options.now ?? Date.now();
  const requested = Array.isArray(options.requestedMarkets) ? options.requestedMarkets : [];
  const bookmakerKey = options.bookmakerKey || BOOKMAKER_ALL;
  const markets = [];
  const books = Array.isArray(event.bookmakers) ? event.bookmakers : [];

  for (const marketKey of requested) {
    const meta = marketMeta(marketKey);
    const units = new Map();

    for (const bookmaker of books) {
      const market = bookmaker?.markets?.find((item) => item.key === marketKey);
      const outcomes = Array.isArray(market?.outcomes) ? market.outcomes : [];
      if (!outcomes.length) continue;
      const bookKey = clean(bookmaker.key || bookmaker.title);
      const bookTitle = clean(bookmaker.title || bookmaker.key);
      const updated = timestamp(market?.last_update || bookmaker?.last_update);
      const byUnit = new Map();

      for (const raw of outcomes) {
        const odds = validOdds(raw.price);
        if (!odds) continue;
        const key = unitKey(meta.mode, raw);
        const row = {
          key: selectionKey(raw),
          name: clean(raw.name),
          subject: subject(raw) || null,
          point: finite(raw.point),
          odds,
          bookmaker: bookTitle,
          bookmakerKey: bookKey,
          timestamp: updated
        };
        if (!row.key) continue;
        if (!byUnit.has(key)) byUnit.set(key, []);
        byUnit.get(key).push(row);
      }

      for (const [key, rows] of byUnit) {
        if (!units.has(key)) units.set(key, { key, rows: [], point: rows[0]?.point ?? null, subjects: new Set() });
        const unit = units.get(key);
        unit.rows.push(...rows);
        rows.forEach((row) => { if (row.subject) unit.subjects.add(row.subject); });
      }
    }

    const normalizedUnits = [];
    for (const unit of units.values()) {
      const eligibility = baseEligibility(meta, unit.point);
      const rowsByBook = new Map();
      unit.rows.forEach((row) => {
        if (!rowsByBook.has(row.bookmakerKey)) rowsByBook.set(row.bookmakerKey, []);
        rowsByBook.get(row.bookmakerKey).push(row);
      });

      const samples = new Map();
      for (const rows of rowsByBook.values()) {
        const impliedTotal = eligibility.eligible && rows.length >= 2
          ? rows.reduce((sum, row) => sum + 1 / row.odds, 0)
          : null;
        for (const row of rows) {
          if (!samples.has(row.key)) samples.set(row.key, []);
          samples.get(row.key).push({
            ...row,
            fairProbability: impliedTotal && impliedTotal > 0 ? (1 / row.odds) / impliedTotal : null,
            overround: impliedTotal && impliedTotal > 0 ? impliedTotal - 1 : null
          });
        }
      }

      const selections = [...samples.entries()].map(([key, offers]) => {
        const sortedOffers = [...offers].sort((a, b) => b.odds - a.odds);
        const best = sortedOffers[0];
        const probabilities = sortedOffers.map((item) => item.fairProbability).filter(Number.isFinite);
        const latestTimestamp = Math.max(0, ...sortedOffers.map((item) => item.timestamp || 0));
        const freshness = freshnessFromTimestamp(latestTimestamp || null, now);
        const bookmakerCount = new Set(sortedOffers.map((item) => item.bookmakerKey)).size;
        const dispersion = probabilities.length ? standardDeviation(probabilities) : null;
        const confidence = probabilities.length
          ? calculateDataConfidence({ bookmakerCount, dispersion, freshnessScore: freshness.score })
          : null;
        const consensusProbability = probabilities.length ? median(probabilities) : null;
        const selection = {
          selection: key,
          point: best?.point ?? null,
          subject: best?.subject ?? null,
          odds: best?.odds ?? null,
          bestOdds: best?.odds ?? null,
          bookmaker: best?.bookmaker ?? null,
          bookmakerKey: best?.bookmakerKey ?? null,
          bookmakerCount,
          consensusProbability,
          fairOdds: consensusProbability ? 1 / consensusProbability : null,
          probabilityDispersion: dispersion,
          confidence,
          confidenceLabel: confidence === null ? "Price only" : confidenceLabel(confidence),
          freshnessLabel: freshness.label,
          latestUpdate: latestTimestamp ? new Date(latestTimestamp).toISOString() : null,
          offers: sortedOffers.map((item) => ({
            bookmaker: item.bookmaker,
            bookmakerKey: item.bookmakerKey,
            odds: item.odds,
            timestamp: item.timestamp ? new Date(item.timestamp).toISOString() : null
          }))
        };
        if (!eligibility.eligible || consensusProbability === null) {
          return {
            ...selection,
            decision: "PRICE_ONLY",
            decisionReason: eligibility.reason || "Insufficient complete bookmaker outcomes for no-vig analysis.",
            analysisEligible: false,
            paperOnly: true
          };
        }
        const analyzed = analyzeConsensusSelection(selection, { ...options, bookmakerKey });
        return {
          ...(analyzed || selection),
          decision: analyzed?.decision || "SKIP",
          decisionReason: analyzed?.decisionReason || "No eligible offered price was available.",
          analysisEligible: Boolean(analyzed),
          paperOnly: true
        };
      });

      normalizedUnits.push({
        key: unit.key,
        label: [...unit.subjects].join(" / ") || (unit.point === null ? meta.title : `${meta.title} ${unit.point}`),
        point: unit.point,
        analysisEligible: eligibility.eligible,
        analysisReason: eligibility.reason,
        selections
      });
    }

    if (normalizedUnits.length) {
      markets.push({
        key: marketKey,
        title: meta.title,
        mode: meta.mode,
        units: normalizedUnits,
        unitCount: normalizedUnits.length,
        offerCount: normalizedUnits.reduce((sum, unit) => sum + unit.selections.reduce((inner, selection) => inner + selection.offers.length, 0), 0)
      });
    }
  }

  return {
    event: {
      id: event.id || null,
      sportKey: event.sport_key || null,
      sportTitle: event.sport_title || event.sport_key || null,
      homeTeam: event.home_team || null,
      awayTeam: event.away_team || null,
      commenceTime: event.commence_time || null
    },
    markets,
    marketCount: markets.length,
    unitCount: markets.reduce((sum, market) => sum + market.unitCount, 0),
    offerCount: markets.reduce((sum, market) => sum + market.offerCount, 0),
    paperOnly: true,
    probabilityChangedByMarketType: false
  };
}

export { MARKET_GROUPS, MARKET_META };
