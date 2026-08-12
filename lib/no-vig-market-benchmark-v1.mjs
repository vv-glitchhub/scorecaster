export const NO_VIG_EVENT_MARKET_BENCHMARK_VERSION = "no-vig-event-market-benchmark-v1";

function clean(value, limit = 180) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalized(value, limit = 180) {
  return clean(value, limit).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSoccer(pick = {}) {
  return normalized(pick.sportKey || pick.sportTitle || pick.league, 120).includes("soccer");
}

export function buildNoVigEventMarketBenchmarkV1(pick = {}, { capturedAt = new Date().toISOString() } = {}) {
  const rows = Array.isArray(pick.eventConsensusDistribution) ? pick.eventConsensusDistribution : [];
  const homeKey = normalized(pick.homeTeam, 140);
  const awayKey = normalized(pick.awayTeam, 140);
  const probabilities = {};
  const outcomes = [];

  for (const row of rows.slice(0, 5)) {
    const selection = normalized(row?.selection, 140);
    const probability = finite(row?.probability);
    if (!selection || probability === null || probability <= 0 || probability >= 1) continue;
    let side = null;
    if (selection === homeKey) side = "home";
    else if (selection === awayKey) side = "away";
    else if (["draw", "tie", "tasapeli", "x"].includes(selection)) side = "draw";
    if (!side || probabilities[side] !== undefined) continue;
    probabilities[side] = probability;
    outcomes.push({
      side,
      selection: clean(row.selection, 140),
      probability,
      bookmakerCount: Number(row.bookmakerCount || 0),
      latestUpdate: row.latestUpdate || null
    });
  }

  const required = isSoccer(pick) ? ["home", "draw", "away"] : ["home", "away"];
  if (!required.every((side) => finite(probabilities[side]) !== null)) return null;
  const rawTotal = required.reduce((sum, side) => sum + Number(probabilities[side]), 0);
  if (!Number.isFinite(rawTotal) || rawTotal < 0.9 || rawTotal > 1.1) return null;
  const normalizedProbabilities = Object.fromEntries(required.map((side) => [side, Number((probabilities[side] / rawTotal).toFixed(8))]));

  return {
    version: NO_VIG_EVENT_MARKET_BENCHMARK_VERSION,
    source: "bookmaker-no-vig-consensus",
    independentPredictiveModel: false,
    marketKey: clean(pick.marketKey || "h2h", 60),
    capturedAt,
    rawProbabilityTotal: Number(rawTotal.toFixed(8)),
    renormalized: Math.abs(rawTotal - 1) > 0.000001,
    probabilities: normalizedProbabilities,
    outcomes,
    productionProbabilityChanged: false,
    paperOnly: true
  };
}
