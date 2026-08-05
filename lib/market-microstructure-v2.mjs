import { createHash } from "node:crypto";

export const MARKET_MICROSTRUCTURE_VERSION = "scorecaster-market-microstructure-v2";

export const MARKET_MICROSTRUCTURE_THRESHOLDS = Object.freeze({
  providerFreshnessMinutes: 20,
  synchronizedWindowMinutes: 30,
  minimumBroadProviders: 3,
  broadDirectionShare: 0.67,
  broadProbabilityMove: 0.015,
  meaningfulProbabilityMove: 0.01,
  meaningfulPriceMove: 0.05,
  outlierFloor: 0.03,
  coverageDropShare: 0.3
});

const SUPPORTED_MARKETS = new Set(["h2h", "spreads", "totals"]);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = (value, digits = 6) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const clean = (value, maximum = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);
const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const median = (values = []) => {
  const numbers = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
};
const average = (values = []) => {
  const numbers = values.filter((value) => Number.isFinite(value));
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
};

function deterministicUuid(value) {
  const hex = createHash("sha256").update(String(value)).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

function selectionName(outcome = {}, marketKey) {
  const name = clean(outcome.name, 160);
  const point = finite(outcome.point);
  if (!name) return null;
  if ((marketKey === "spreads" || marketKey === "totals") && point !== null) {
    return `${name} ${point > 0 ? "+" : ""}${point}`;
  }
  return name;
}

function normalizeBookmakerMarket({ game, bookmaker, market, capturedAt, sourceId, captureId }) {
  const eventId = clean(game.id ?? game.event_id ?? game.eventId, 180);
  const commenceTime = iso(game.commence_time ?? game.commenceTime);
  const sport = clean(game.sport_key ?? game.sportKey, 100);
  const league = clean(game.sport_title ?? game.sportTitle ?? sport, 140);
  const bookmakerKey = clean(bookmaker.key, 100).toLowerCase();
  const bookmakerTitle = clean(bookmaker.title ?? bookmakerKey, 140);
  const marketKey = clean(market.key, 40).toLowerCase();
  const providerLastUpdate = iso(market.last_update ?? bookmaker.last_update) || capturedAt;
  const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];
  const priced = outcomes.map((outcome) => ({
    outcome,
    price: finite(outcome.price),
    implied: finite(outcome.price) && Number(outcome.price) > 1 ? 1 / Number(outcome.price) : null
  })).filter((item) => item.price > 1 && item.implied > 0);
  const overround = priced.reduce((sum, item) => sum + item.implied, 0);
  const errors = [];
  if (!eventId) errors.push("missing-event-id");
  if (!commenceTime) errors.push("missing-commence-time");
  if (!sport) errors.push("missing-sport");
  if (!bookmakerKey) errors.push("missing-bookmaker");
  if (!SUPPORTED_MARKETS.has(marketKey)) errors.push("unsupported-market");
  if (priced.length < 2 || overround <= 0) errors.push("insufficient-priced-outcomes");
  if (commenceTime && Date.parse(capturedAt) >= Date.parse(commenceTime)) errors.push("post-start-capture");
  if (providerLastUpdate && Date.parse(providerLastUpdate) > Date.parse(capturedAt) + 5 * 60 * 1000) errors.push("future-provider-update");
  if (errors.length) return { rows: [], errors };

  const rows = priced.map(({ outcome, price, implied }) => {
    const selection = selectionName(outcome, marketKey);
    if (!selection) return null;
    const point = finite(outcome.point);
    const normalizedProbability = implied / overround;
    const reference = [
      sourceId, eventId, marketKey, selection, bookmakerKey,
      providerLastUpdate, price, point ?? "none"
    ].join("|");
    return {
      id: deterministicUuid(reference),
      capture_id: captureId,
      event_id: eventId,
      sport,
      league: league || null,
      commence_time: commenceTime,
      market: marketKey,
      selection,
      point,
      bookmaker_key: bookmakerKey,
      bookmaker_title: bookmakerTitle || bookmakerKey,
      price: round(price, 4),
      implied_probability: round(implied),
      normalized_probability: round(normalizedProbability),
      market_overround: round(overround - 1),
      provider_last_update: providerLastUpdate,
      captured_at: capturedAt,
      source_id: sourceId,
      source_reference: createHash("sha256").update(reference).digest("hex"),
      paper_only: true
    };
  }).filter(Boolean);
  return { rows, errors: [] };
}

export function normalizeMarketProviderGames(games = [], options = {}) {
  const capturedAt = iso(options.capturedAt) || new Date().toISOString();
  const sourceId = clean(options.sourceId || "the_odds_api", 80).toLowerCase();
  const captureId = clean(options.captureId, 80) || deterministicUuid(`${sourceId}|${capturedAt}`);
  const rows = [];
  const rejected = [];

  for (const game of Array.isArray(games) ? games.slice(0, 500) : []) {
    for (const bookmaker of Array.isArray(game?.bookmakers) ? game.bookmakers.slice(0, 100) : []) {
      for (const market of Array.isArray(bookmaker?.markets) ? bookmaker.markets.slice(0, 10) : []) {
        const normalized = normalizeBookmakerMarket({ game, bookmaker, market, capturedAt, sourceId, captureId });
        rows.push(...normalized.rows);
        if (normalized.errors.length) {
          rejected.push({
            eventId: clean(game?.id, 180) || null,
            bookmaker: clean(bookmaker?.key, 100) || null,
            market: clean(market?.key, 40) || null,
            errors: normalized.errors
          });
        }
      }
    }
  }

  return {
    version: MARKET_MICROSTRUCTURE_VERSION,
    captureId,
    capturedAt,
    receivedGames: Array.isArray(games) ? games.length : 0,
    records: rows,
    rejected,
    rawPayloadStored: false,
    sourceId,
    paperOnly: true
  };
}

function normalizeStoredRow(row = {}) {
  const price = finite(row.price);
  const normalizedProbability = finite(row.normalized_probability ?? row.normalizedProbability);
  const capturedAt = iso(row.captured_at ?? row.capturedAt);
  const commenceTime = iso(row.commence_time ?? row.commenceTime);
  if (!clean(row.event_id ?? row.eventId, 180) || price === null || price <= 1 || normalizedProbability === null || !capturedAt || !commenceTime) return null;
  return {
    id: clean(row.id, 80),
    captureId: clean(row.capture_id ?? row.captureId, 80),
    eventId: clean(row.event_id ?? row.eventId, 180),
    sport: clean(row.sport, 100),
    league: clean(row.league, 140),
    commenceTime,
    market: clean(row.market, 40).toLowerCase(),
    selection: clean(row.selection, 160),
    point: finite(row.point),
    bookmakerKey: clean(row.bookmaker_key ?? row.bookmakerKey, 100).toLowerCase(),
    bookmakerTitle: clean(row.bookmaker_title ?? row.bookmakerTitle, 140),
    price,
    impliedProbability: finite(row.implied_probability ?? row.impliedProbability) ?? 1 / price,
    normalizedProbability: clamp(normalizedProbability, 0.000001, 0.999999),
    marketOverround: finite(row.market_overround ?? row.marketOverround),
    providerLastUpdate: iso(row.provider_last_update ?? row.providerLastUpdate) || capturedAt,
    capturedAt,
    sourceId: clean(row.source_id ?? row.sourceId, 80),
    sourceReference: clean(row.source_reference ?? row.sourceReference, 160)
  };
}

function latestByProvider(rows, cutoffMs) {
  const map = new Map();
  for (const row of rows) {
    const time = Date.parse(row.capturedAt);
    if (time > cutoffMs) continue;
    const current = map.get(row.bookmakerKey);
    if (!current || Date.parse(current.capturedAt) < time) map.set(row.bookmakerKey, row);
  }
  return [...map.values()];
}

function earliestByProvider(rows) {
  const map = new Map();
  for (const row of rows) {
    const current = map.get(row.bookmakerKey);
    if (!current || Date.parse(current.capturedAt) > Date.parse(row.capturedAt)) map.set(row.bookmakerKey, row);
  }
  return [...map.values()];
}

function markFreshness(rows, referenceMs, thresholds) {
  return rows.map((row) => {
    const ageMinutes = Math.max(0, (referenceMs - Date.parse(row.providerLastUpdate)) / 60000);
    return { ...row, ageMinutes: round(ageMinutes, 1), stale: ageMinutes > thresholds.providerFreshnessMinutes };
  });
}

function markOutliers(rows, thresholds) {
  const candidates = rows.filter((row) => !row.stale);
  const center = median(candidates.map((row) => row.normalizedProbability));
  const mad = center === null ? null : median(candidates.map((row) => Math.abs(row.normalizedProbability - center)));
  const threshold = Math.max(thresholds.outlierFloor, Number.isFinite(mad) ? mad * 3 : thresholds.outlierFloor);
  return rows.map((row) => ({
    ...row,
    outlier: !row.stale && center !== null && Math.abs(row.normalizedProbability - center) > threshold,
    consensusDistance: center === null ? null : round(row.normalizedProbability - center)
  }));
}

function consensus(rows) {
  const eligible = rows.filter((row) => !row.stale && !row.outlier);
  return {
    probability: round(average(eligible.map((row) => row.normalizedProbability))),
    averagePrice: round(average(eligible.map((row) => row.price)), 4),
    providerCount: eligible.length,
    staleCount: rows.filter((row) => row.stale).length,
    outlierCount: rows.filter((row) => row.outlier).length
  };
}

function timelinePoints(rows, cutoffMs, thresholds) {
  const groups = new Map();
  for (const row of rows) {
    if (Date.parse(row.capturedAt) > cutoffMs) continue;
    const key = row.captureId || row.capturedAt;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([captureId, group]) => {
    const capturedAt = group.map((row) => row.capturedAt).sort().at(-1);
    const marked = markOutliers(markFreshness(group, Date.parse(capturedAt), thresholds), thresholds);
    return { captureId, capturedAt, ...consensus(marked) };
  }).filter((point) => point.probability !== null).sort((left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt));
}

function providerMovement(openingRows, currentRows) {
  const opening = new Map(openingRows.map((row) => [row.bookmakerKey, row]));
  return currentRows.map((current) => {
    const first = opening.get(current.bookmakerKey);
    const probabilityChange = first ? current.normalizedProbability - first.normalizedProbability : null;
    const priceChange = first ? current.price / first.price - 1 : null;
    return {
      bookmakerKey: current.bookmakerKey,
      bookmakerTitle: current.bookmakerTitle,
      openingPrice: first?.price ?? null,
      currentPrice: current.price,
      openingProbability: first?.normalizedProbability ?? null,
      currentProbability: current.normalizedProbability,
      probabilityChange: round(probabilityChange),
      priceChange: round(priceChange),
      stale: current.stale,
      outlier: current.outlier,
      ageMinutes: current.ageMinutes,
      capturedAt: current.capturedAt,
      providerLastUpdate: current.providerLastUpdate
    };
  }).sort((left, right) => Math.abs(right.probabilityChange || 0) - Math.abs(left.probabilityChange || 0));
}

function broadMovement(movements, thresholds) {
  const eligible = movements.filter((item) => !item.stale && !item.outlier && Number.isFinite(item.probabilityChange));
  if (eligible.length < thresholds.minimumBroadProviders) {
    return { detected: false, reason: "insufficient-synchronized-providers", providerCount: eligible.length };
  }
  const positive = eligible.filter((item) => item.probabilityChange >= thresholds.broadProbabilityMove);
  const negative = eligible.filter((item) => item.probabilityChange <= -thresholds.broadProbabilityMove);
  const dominant = positive.length >= negative.length ? positive : negative;
  const direction = positive.length >= negative.length ? "shortening" : "lengthening";
  const share = dominant.length / eligible.length;
  const timestamps = eligible.map((item) => Date.parse(item.capturedAt));
  const synchronizedMinutes = (Math.max(...timestamps) - Math.min(...timestamps)) / 60000;
  const detected = share >= thresholds.broadDirectionShare && synchronizedMinutes <= thresholds.synchronizedWindowMinutes;
  return {
    detected,
    reason: detected ? "multi-provider-synchronized-evidence" : share < thresholds.broadDirectionShare ? "direction-not-broad-enough" : "provider-updates-not-synchronized",
    direction: detected ? direction : null,
    providerCount: eligible.length,
    supportingProviders: detected ? dominant.map((item) => item.bookmakerKey) : [],
    directionShare: round(share, 3),
    medianProbabilityChange: round(median(dominant.map((item) => item.probabilityChange))),
    synchronizedMinutes: round(synchronizedMinutes, 1)
  };
}

function closingConsensus(rows, commenceMs, thresholds) {
  const providerRows = latestByProvider(rows, commenceMs - 1);
  const marked = markOutliers(markFreshness(providerRows, Math.max(...providerRows.map((row) => Date.parse(row.capturedAt)), commenceMs), thresholds), thresholds);
  return { ...consensus(marked), providers: marked };
}

function analyzeSelection(rows, generatedMs, thresholds) {
  const commenceMs = Date.parse(rows[0].commenceTime);
  const preStart = generatedMs < commenceMs;
  const cutoffMs = Math.min(generatedMs, commenceMs - 1);
  const openingRows = markOutliers(markFreshness(earliestByProvider(rows), Math.min(...rows.map((row) => Date.parse(row.capturedAt))), thresholds), thresholds);
  const currentReference = preStart ? generatedMs : commenceMs - 1;
  const currentRows = markOutliers(markFreshness(latestByProvider(rows, cutoffMs), currentReference, thresholds), thresholds);
  const opening = consensus(openingRows);
  const current = consensus(currentRows);
  const movements = providerMovement(openingRows, currentRows);
  const broad = broadMovement(movements, thresholds);
  const probabilityChange = opening.probability !== null && current.probability !== null ? current.probability - opening.probability : null;
  const priceChange = opening.averagePrice && current.averagePrice ? current.averagePrice / opening.averagePrice - 1 : null;
  const outlierProviders = currentRows.filter((row) => row.outlier).map((row) => row.bookmakerKey);
  const staleProviders = currentRows.filter((row) => row.stale).map((row) => row.bookmakerKey);
  const causeLabel = broad.detected
    ? "inferred-broad-market-movement"
    : outlierProviders.length
      ? "isolated-provider-outlier"
      : Math.abs(probabilityChange || 0) >= thresholds.meaningfulProbabilityMove
        ? "observed-price-movement-unknown-cause"
        : "broadly-stable-market";
  const alerts = [];
  if (Math.abs(probabilityChange || 0) >= thresholds.meaningfulProbabilityMove) alerts.push({ type: "probability-move", severity: Math.abs(probabilityChange) >= 0.025 ? "high" : "medium", value: round(probabilityChange) });
  if (Math.abs(priceChange || 0) >= thresholds.meaningfulPriceMove) alerts.push({ type: "price-move", severity: Math.abs(priceChange) >= 0.1 ? "high" : "medium", value: round(priceChange) });
  if (broad.detected) alerts.push({ type: "synchronized-market-move", severity: "high", direction: broad.direction, providerCount: broad.providerCount });
  if (outlierProviders.length) alerts.push({ type: "isolated-provider-outlier", severity: "info", providers: outlierProviders });
  const openingCoverage = opening.providerCount;
  const currentCoverage = current.providerCount;
  if (openingCoverage >= 3 && currentCoverage <= openingCoverage * (1 - thresholds.coverageDropShare)) alerts.push({ type: "provider-coverage-drop", severity: "medium", openingCoverage, currentCoverage });

  const closing = preStart ? null : closingConsensus(rows, commenceMs, thresholds);
  return {
    selection: rows[0].selection,
    point: rows[0].point,
    commenceTime: rows[0].commenceTime,
    preStart,
    opening,
    current,
    closing: closing ? {
      probability: closing.probability,
      averagePrice: closing.averagePrice,
      providerCount: closing.providerCount,
      capturedBeforeStart: true
    } : null,
    movement: {
      probabilityChange: round(probabilityChange),
      priceChange: round(priceChange),
      direction: probabilityChange === null || Math.abs(probabilityChange) < 0.0025 ? "stable" : probabilityChange > 0 ? "shortening" : "lengthening",
      causeLabel,
      broadEvidence: broad,
      staleProviders,
      outlierProviders,
      providerMovements: movements
    },
    timeline: timelinePoints(rows, cutoffMs, thresholds),
    alerts,
    leakageBoundary: {
      closingVisible: !preStart,
      closingUsedByPrematchModel: false,
      postStartRowsUsed: false
    },
    sharpMoneyClaim: false,
    limitation: "Observed synchronized movement does not identify who placed money or prove inside information."
  };
}

export function buildMarketMicrostructure(rows = [], options = {}) {
  const generatedAt = iso(options.generatedAt) || new Date().toISOString();
  const thresholds = { ...MARKET_MICROSTRUCTURE_THRESHOLDS, ...(options.thresholds || {}) };
  const normalized = (Array.isArray(rows) ? rows : []).map(normalizeStoredRow).filter(Boolean);
  const preStartRows = normalized.filter((row) => Date.parse(row.capturedAt) < Date.parse(row.commenceTime));
  const selectedMarket = clean(options.market || preStartRows[0]?.market || "h2h", 40).toLowerCase();
  const selectedSelection = clean(options.selection, 160).toLowerCase();
  const scoped = preStartRows.filter((row) => row.market === selectedMarket && (!selectedSelection || row.selection.toLowerCase() === selectedSelection));
  const groups = new Map();
  for (const row of scoped) {
    if (!groups.has(row.selection)) groups.set(row.selection, []);
    groups.get(row.selection).push(row);
  }
  const selections = [...groups.values()].map((group) => analyzeSelection(group, Date.parse(generatedAt), thresholds));
  const first = scoped[0] || normalized[0] || null;
  return {
    ok: true,
    version: MARKET_MICROSTRUCTURE_VERSION,
    generatedAt,
    eventId: first?.eventId || clean(options.eventId, 180) || null,
    sport: first?.sport || null,
    league: first?.league || null,
    market: selectedMarket,
    status: selections.length ? "available" : "missing",
    selections,
    thresholds,
    recordsReceived: normalized.length,
    recordsEligible: scoped.length,
    sourceAttribution: "Market odds: The Odds API",
    rawPayloadPublic: false,
    paperOnly: true,
    realMoneyExecution: false,
    sharpMoneyClaim: false,
    safety: {
      futureRowsUsed: false,
      postStartRowsUsed: false,
      closingLeakedBeforeStart: false,
      staleProvidersCanTriggerBroadMove: false,
      isolatedOutlierCanTriggerBroadMove: false
    }
  };
}
