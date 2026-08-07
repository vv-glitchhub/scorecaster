const assertPositiveNumber = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be a positive number`);
  return number;
};

const unique = (values) => [...new Set(values)];

export const VEIKKAUS_GAME_FAMILIES = Object.freeze({
  PITKAVETO: "fixed_odds",
  TULOSVETO: "pari_mutuel_exact_score",
  VAKIO: "pari_mutuel_1x2_pool",
  VOITTAJAVETO: "pari_mutuel_ranking_pool",
  TOTO: "pari_mutuel_racing_pool",
});

export const TULOSVETO_DEFAULT_RETURN_RATE = 0.77;

export const TOTO_WIN_CLASS_SHARES = Object.freeze({
  TOTO86: Object.freeze({ 8: 0.40, 7: 0.20, 6: 0.40 }),
  TOTO75: Object.freeze({ 7: 0.40, 6: 0.20, 5: 0.40 }),
  TOTO76: Object.freeze({ 7: 0.50, 6: 0.50 }),
  TOTO64: Object.freeze({ 6: 0.40, 5: 0.20, 4: 0.40 }),
  TOTO65: Object.freeze({ 6: 0.50, 5: 0.50 }),
});

export function classifyVeikkausGame(name) {
  const normalized = String(name ?? "").trim().toLowerCase();
  if (normalized.includes("pitkäveto") || normalized.includes("pitkaveto")) return VEIKKAUS_GAME_FAMILIES.PITKAVETO;
  if (normalized.includes("tulosveto")) return VEIKKAUS_GAME_FAMILIES.TULOSVETO;
  if (normalized.includes("vakio")) return VEIKKAUS_GAME_FAMILIES.VAKIO;
  if (normalized.includes("voittajaveto") || normalized.includes("supertripla")) return VEIKKAUS_GAME_FAMILIES.VOITTAJAVETO;
  if (normalized.includes("toto") || ["voittaja", "sija", "kaksari", "troikka", "neliveto", "päivän duo", "paivan duo", "eksakta"].some((term) => normalized.includes(term))) {
    return VEIKKAUS_GAME_FAMILIES.TOTO;
  }
  return null;
}

export function calculateParimutuelOdds({ turnover, amountOnOutcome, returnRate = TULOSVETO_DEFAULT_RETURN_RATE }) {
  const total = assertPositiveNumber(turnover, "turnover");
  const outcomeAmount = assertPositiveNumber(amountOnOutcome, "amountOnOutcome");
  const rate = Number(returnRate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1) throw new Error("returnRate must be in (0, 1]");
  if (outcomeAmount > total) throw new Error("amountOnOutcome cannot exceed turnover");
  return (rate * total) / outcomeAmount;
}

export function estimatePoolShareFromOdds({ odds, returnRate = TULOSVETO_DEFAULT_RETURN_RATE }) {
  const price = assertPositiveNumber(odds, "odds");
  const rate = Number(returnRate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1) throw new Error("returnRate must be in (0, 1]");
  return rate / price;
}

export function calculateFullSystemRows(selectionCounts) {
  if (!Array.isArray(selectionCounts) || selectionCounts.length === 0) throw new Error("selectionCounts must be a non-empty array");
  return selectionCounts.reduce((rows, count) => {
    const selections = Number(count);
    if (!Number.isInteger(selections) || selections < 1) throw new Error("each selection count must be a positive integer");
    return rows * selections;
  }, 1);
}

export function calculateVakioSystemRows(markSets) {
  if (!Array.isArray(markSets) || markSets.length === 0) throw new Error("markSets must be a non-empty array");
  const counts = markSets.map((marks) => {
    const values = unique(Array.isArray(marks) ? marks : String(marks).split(""));
    if (values.some((mark) => !["1", "X", "2"].includes(String(mark).toUpperCase()))) throw new Error("Vakio marks must be 1, X or 2");
    return values.length;
  });
  return calculateFullSystemRows(counts);
}

export function enumerateTulosvetoRows({ homeGoals, awayGoals, exclude = null }) {
  const homes = unique(homeGoals).map(Number);
  const aways = unique(awayGoals).map(Number);
  if (!homes.length || !aways.length || [...homes, ...aways].some((goal) => !Number.isInteger(goal) || goal < 0)) {
    throw new Error("goal selections must contain non-negative integers");
  }

  return homes.flatMap((home) => aways.map((away) => ({ home, away }))).filter(({ home, away }) => {
    if (!exclude) return true;
    if (exclude === "home") return home <= away;
    if (exclude === "draw") return home !== away;
    if (exclude === "away") return home >= away;
    throw new Error("exclude must be home, draw, away or null");
  });
}

export function calculateTulosvetoSystemRows(input) {
  return enumerateTulosvetoRows(input).length;
}

export function calculateOrderedRankingRows(positionSelections) {
  if (!Array.isArray(positionSelections) || positionSelections.length < 2) throw new Error("positionSelections must contain at least two positions");
  const positions = positionSelections.map((values) => unique(values.map(String)));
  if (positions.some((values) => values.length === 0)) throw new Error("each ranking position must have at least one selection");

  let rows = 0;
  const walk = (index, used) => {
    if (index === positions.length) {
      rows += 1;
      return;
    }
    for (const competitor of positions[index]) {
      if (used.has(competitor)) continue;
      used.add(competitor);
      walk(index + 1, used);
      used.delete(competitor);
    }
  };
  walk(0, new Set());
  return rows;
}

export function getTotoWinClassShares(game) {
  const normalized = String(game ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return TOTO_WIN_CLASS_SHARES[normalized] ?? null;
}

export function createPaperOnlyRuleBoundary(gameName) {
  return Object.freeze({
    gameFamily: classifyVeikkausGame(gameName),
    paperOnly: true,
    allowsBetPlacement: false,
    allowsBookmakerLogin: false,
    allowsMoneyMovement: false,
    purpose: "analysis_and_system_construction_only",
  });
}
