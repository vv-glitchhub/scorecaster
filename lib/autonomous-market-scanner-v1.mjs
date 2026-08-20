import { getMarketUniverseGroups } from "./market-universe-v1.mjs";

export const AUTONOMOUS_MARKET_SCANNER_V1 = Object.freeze({
  version: "autonomous-market-scanner-v1",
  intervalMinutes: 60,
  maxEventsPerScan: 3,
  maxGroupsPerEvent: 1,
  quotaReserve: 100,
  paperOnly: true,
  probabilityChangedByScanner: false
});

const GROUP_CYCLES = Object.freeze({
  soccer: ["goals", "featured", "goals", "periods", "goals", "result", "corners_cards", "players"],
  icehockey: ["goals", "featured", "goals", "periods", "goals", "players"],
  basketball: ["featured", "players", "featured", "players"],
  default: ["featured"]
});

function clean(value, limit = 180) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sportFamily(sportKey = "") {
  const key = clean(sportKey, 120).toLowerCase();
  if (key.startsWith("soccer_")) return "soccer";
  if (key.startsWith("icehockey_")) return "icehockey";
  if (key.startsWith("basketball_")) return "basketball";
  return "default";
}

function eventId(pick = {}) {
  return clean(pick.gameId || pick.eventId || pick.event_id || pick.game_id || "", 180);
}

function eventKey(pick = {}) {
  return eventId(pick) || clean(`${pick.homeTeam || pick.home_team || ""}|${pick.awayTeam || pick.away_team || ""}|${pick.commenceTime || pick.commence_time || ""}`, 420).toLowerCase();
}

function candidateKey(pick = {}) {
  return [
    eventKey(pick),
    clean(pick.marketKey || pick.market, 120).toLowerCase(),
    clean(pick.marketUnitKey, 240).toLowerCase(),
    clean(pick.selection, 240).toLowerCase(),
    finite(pick.point, null)
  ].join("|");
}

function scanBucket(now, intervalMinutes = AUTONOMOUS_MARKET_SCANNER_V1.intervalMinutes) {
  const timestamp = now instanceof Date ? now.getTime() : Number(now);
  const safe = Number.isFinite(timestamp) ? timestamp : Date.now();
  return Math.floor(safe / (Math.max(15, intervalMinutes) * 60_000));
}

export function shouldRunAutonomousMarketScan(now = new Date(), intervalMinutes = AUTONOMOUS_MARKET_SCANNER_V1.intervalMinutes) {
  const timestamp = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(timestamp)) return false;
  const quarterHour = Math.floor(timestamp / (15 * 60_000));
  const bucketsPerScan = Math.max(1, Math.round(Math.max(15, intervalMinutes) / 15));
  return quarterHour % bucketsPerScan === 0;
}

export function autonomousMarketGroupForEvent(sportKey, now = new Date(), eventIndex = 0) {
  const available = new Set(getMarketUniverseGroups(sportKey).map((item) => item.key));
  const cycle = GROUP_CYCLES[sportFamily(sportKey)] || GROUP_CYCLES.default;
  const bucket = scanBucket(now);
  for (let offset = 0; offset < cycle.length; offset += 1) {
    const group = cycle[(bucket + eventIndex + offset) % cycle.length];
    if (available.has(group)) return group;
  }
  return null;
}

export function autonomousMarketScanPlan(picks = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const maxEvents = Math.max(0, Math.min(12, Number(options.maxEventsPerScan ?? AUTONOMOUS_MARKET_SCANNER_V1.maxEventsPerScan)));
  const seen = new Set();
  const events = [];

  for (const pick of Array.isArray(picks) ? picks : []) {
    const id = eventId(pick);
    const key = eventKey(pick);
    const sportKey = clean(pick.sportKey || pick.sport || pick.league, 120);
    if (!id || !key || !sportKey || seen.has(key)) continue;
    const group = autonomousMarketGroupForEvent(sportKey, now, events.length);
    if (!group) continue;
    seen.add(key);
    events.push({ eventId: id, eventKey: key, sportKey, group, seed: pick });
    if (events.length >= maxEvents) break;
  }

  return {
    version: AUTONOMOUS_MARKET_SCANNER_V1.version,
    generatedAt: now.toISOString(),
    intervalMinutes: Number(options.intervalMinutes ?? AUTONOMOUS_MARKET_SCANNER_V1.intervalMinutes),
    maxEventsPerScan: maxEvents,
    maxGroupsPerEvent: 1,
    events,
    paperOnly: true,
    probabilityChangedByScanner: false
  };
}

function marketProbability(odds) {
  const price = finite(odds, 0);
  return price > 1 ? 1 / price : 0;
}

function conservativeTrust(selection = {}) {
  const confidence = clamp(finite(selection.confidence, 0), 0, 1);
  const coverage = clamp(finite(selection.bookmakerCount, 0) / 8, 0, 1);
  const freshness = selection.freshnessLabel === "fresh" ? 1 : selection.freshnessLabel === "recent" ? 0.85 : selection.freshnessLabel === "aging" ? 0.55 : 0.35;
  return Number((clamp(confidence * 0.7 + coverage * 0.2 + freshness * 0.1, 0, 0.95) * 100).toFixed(1));
}

export function marketUniverseSelectionToAgentCandidate({ event = {}, market = {}, unit = {}, selection = {}, seed = {} } = {}) {
  if (selection.analysisEligible !== true || selection.decision === "PRICE_ONLY") return null;
  const probability = finite(selection.consensusProbability, null);
  const odds = finite(selection.odds, null);
  if (!(probability > 0 && probability < 1) || !(odds > 1)) return null;

  const eventIdentifier = clean(event.id || eventId(seed), 180);
  const sportKey = clean(event.sportKey || seed.sportKey || seed.sport || seed.league, 120);
  const homeTeam = clean(event.homeTeam || seed.homeTeam || seed.home_team, 160);
  const awayTeam = clean(event.awayTeam || seed.awayTeam || seed.away_team, 160);
  const commenceTime = event.commenceTime || seed.commenceTime || seed.commence_time || null;
  const point = selection.point ?? unit.point ?? null;
  const selectionLabel = clean(selection.selection, 240);
  const computedMarketProbability = finite(selection.marketProbability, marketProbability(odds));
  const edge = finite(selection.edge, probability - computedMarketProbability);
  const ev = finite(selection.ev, odds * probability - 1);
  const confidence = clamp(finite(selection.confidence, 0), 0, 1);

  return {
    ...seed,
    id: `${eventIdentifier}-${market.key}-${clean(unit.key, 180)}-${selectionLabel}`,
    gameId: eventIdentifier,
    eventId: eventIdentifier,
    sportKey,
    sportTitle: event.sportTitle || seed.sportTitle || sportKey,
    league: seed.league || sportKey,
    leagueTitle: seed.leagueTitle || seed.sportTitle || event.sportTitle || sportKey,
    commenceTime,
    match: clean(seed.match || `${homeTeam} vs ${awayTeam}`, 260),
    homeTeam,
    awayTeam,
    marketKey: clean(market.key, 120),
    marketTitle: clean(market.title || market.key, 160),
    marketUnitKey: clean(unit.key, 240),
    marketUnitLabel: clean(unit.label || market.title || market.key, 240),
    selection: selectionLabel,
    point,
    odds,
    bestOdds: finite(selection.bestOdds, odds),
    fairOdds: finite(selection.fairOdds, probability > 0 ? 1 / probability : null),
    bookmaker: selection.bookmaker || null,
    bookmakerKey: selection.bookmakerKey || null,
    modelProbability: probability,
    baselineProbability: probability,
    consensusProbability: probability,
    marketProbability: computedMarketProbability,
    edge,
    ev,
    confidence,
    baseConfidence: confidence,
    trustScore: conservativeTrust(selection),
    bookmakerCount: Math.max(0, finite(selection.bookmakerCount, 0)),
    probabilityDispersion: finite(selection.probabilityDispersion, 0),
    freshnessLabel: selection.freshnessLabel || "unknown",
    lastUpdate: selection.latestUpdate || null,
    dataAgeHours: selection.ageHours ?? null,
    productDecision: selection.decision === "PLAY" ? "PLAY" : selection.decision === "SKIP" ? "SKIP" : "CAUTION",
    decision: selection.decision,
    decisionReason: selection.decisionReason || null,
    decisionDiagnostics: {
      ...(seed.decisionDiagnostics || {}),
      marketUniverseV1: true,
      analysisEligible: true,
      sourceDecision: selection.decision,
      marketUnit: unit.key || null,
      marketGroup: null,
      probabilityChangedByScanner: false
    },
    dataQuality: {
      ...(seed.dataQuality || {}),
      bookmakerCount: Math.max(0, finite(selection.bookmakerCount, 0)),
      probabilityDispersion: finite(selection.probabilityDispersion, 0),
      freshness: selection.freshnessLabel || "unknown",
      ageHours: selection.ageHours ?? null,
      confidence
    },
    source: "market-universe-v1",
    sourceIds: [...new Set([...(Array.isArray(seed.sourceIds) ? seed.sourceIds : []), "the-odds-api", "market-universe-v1"])],
    modelMode: "market-consensus",
    edgeType: "best-price-vs-no-vig-consensus",
    marketUniverse: true,
    marketUniversePriceOnly: false,
    probabilityAdjustedByScanner: false,
    paperOnly: true,
    realMoneyBetting: false
  };
}

function candidatesFromUniverse(universe = {}, seed = {}, group = null) {
  const candidates = [];
  let priceOnlySkipped = 0;
  let ineligibleSkipped = 0;
  for (const market of Array.isArray(universe?.markets) ? universe.markets : []) {
    for (const unit of Array.isArray(market?.units) ? market.units : []) {
      for (const selection of Array.isArray(unit?.selections) ? unit.selections : []) {
        if (selection?.decision === "PRICE_ONLY") {
          priceOnlySkipped += 1;
          continue;
        }
        const candidate = marketUniverseSelectionToAgentCandidate({ event: universe.event || {}, market, unit, selection, seed });
        if (!candidate) {
          ineligibleSkipped += 1;
          continue;
        }
        candidate.decisionDiagnostics.marketGroup = group;
        candidates.push(candidate);
      }
    }
  }
  return { candidates, priceOnlySkipped, ineligibleSkipped };
}

async function defaultMarketLoader({ origin, sportKey, eventId: id, group, fetchImpl = fetch }) {
  const url = new URL("/api/market-universe", origin);
  url.searchParams.set("sport", sportKey);
  url.searchParams.set("eventId", id);
  url.searchParams.set("group", group);
  const response = await fetchImpl(url.toString(), { method: "GET", cache: "no-store", signal: AbortSignal.timeout(12000) });
  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok && payload?.ok !== false,
    status: response.status,
    payload,
    requestsRemaining: finite(payload?.providerHeaders?.requestsRemaining, null),
    requestsUsed: finite(payload?.providerHeaders?.requestsUsed, null)
  };
}

export async function scanAutonomousMarketUniverse({
  picks = [],
  origin,
  now = new Date(),
  marketLoader = defaultMarketLoader,
  fetchImpl = fetch,
  force = false,
  maxEventsPerScan = AUTONOMOUS_MARKET_SCANNER_V1.maxEventsPerScan,
  quotaReserve = AUTONOMOUS_MARKET_SCANNER_V1.quotaReserve
} = {}) {
  const startedAt = now instanceof Date ? now : new Date(now);
  const due = force || shouldRunAutonomousMarketScan(startedAt);
  const diagnostics = {
    version: AUTONOMOUS_MARKET_SCANNER_V1.version,
    enabled: true,
    due,
    scanned: false,
    intervalMinutes: AUTONOMOUS_MARKET_SCANNER_V1.intervalMinutes,
    maxEventsPerScan,
    maxGroupsPerEvent: 1,
    quotaReserve,
    plannedEvents: 0,
    scannedEvents: 0,
    scannedGroups: 0,
    groups: [],
    candidates: 0,
    priceOnlySkipped: 0,
    ineligibleSkipped: 0,
    providerFailures: 0,
    stoppedForQuotaReserve: false,
    requestsRemaining: null,
    requestsUsed: null,
    paperOnly: true,
    probabilityChangedByScanner: false
  };

  if (!due || !origin || !Array.isArray(picks) || !picks.length) return { candidates: [], diagnostics };

  const plan = autonomousMarketScanPlan(picks, { now: startedAt, maxEventsPerScan });
  diagnostics.plannedEvents = plan.events.length;
  const candidates = [];

  for (const item of plan.events) {
    if (diagnostics.requestsRemaining !== null && diagnostics.requestsRemaining <= quotaReserve) {
      diagnostics.stoppedForQuotaReserve = true;
      break;
    }
    let loaded;
    try {
      loaded = await marketLoader({ ...item, origin, now: startedAt, fetchImpl });
    } catch {
      diagnostics.providerFailures += 1;
      continue;
    }
    diagnostics.scanned = true;
    diagnostics.scannedEvents += 1;
    diagnostics.scannedGroups += 1;
    diagnostics.groups.push(`${item.sportKey}:${item.group}`);
    if (loaded?.requestsRemaining !== null && loaded?.requestsRemaining !== undefined) diagnostics.requestsRemaining = finite(loaded.requestsRemaining, diagnostics.requestsRemaining);
    if (loaded?.requestsUsed !== null && loaded?.requestsUsed !== undefined) diagnostics.requestsUsed = finite(loaded.requestsUsed, diagnostics.requestsUsed);
    if (!loaded?.ok || !loaded?.payload) {
      diagnostics.providerFailures += 1;
      continue;
    }
    const shaped = candidatesFromUniverse(loaded.payload, item.seed, item.group);
    diagnostics.priceOnlySkipped += shaped.priceOnlySkipped;
    diagnostics.ineligibleSkipped += shaped.ineligibleSkipped;
    candidates.push(...shaped.candidates);
  }

  const unique = [];
  const seen = new Set((Array.isArray(picks) ? picks : []).map(candidateKey));
  for (const candidate of candidates.sort((a, b) => (finite(b.edge, 0) * finite(b.confidence, 0)) - (finite(a.edge, 0) * finite(a.confidence, 0)))) {
    const key = candidateKey(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  diagnostics.candidates = unique.length;
  return { candidates: unique, diagnostics };
}

export function mergeAutonomousMarketCandidates(basePicks = [], advancedPicks = []) {
  const merged = [];
  const seen = new Set();
  for (const pick of [...(Array.isArray(basePicks) ? basePicks : []), ...(Array.isArray(advancedPicks) ? advancedPicks : [])]) {
    const key = candidateKey(pick);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(pick);
  }
  return merged;
}
