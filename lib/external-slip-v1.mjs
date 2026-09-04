export const EXTERNAL_SLIP_DECISION = "EXTERNAL_REFERENCE_V1";
const LEG_PREFIX = "EXTERNAL_";
const LEG_STATUS = new Set(["open", "won", "lost", "void", "push"]);

function cleanText(value, max = 240, fallback = "") {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return (text || fallback).slice(0, max);
}

function numberOrNull(value, { min = -Infinity, max = Infinity } = {}) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function isoOrNull(value) {
  const text = cleanText(value, 80);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeExternalSlipLeg(value = {}, index = 0) {
  const match = cleanText(value.match, 240);
  const selection = cleanText(value.selection || value.label, 180);
  const odds = numberOrNull(value.odds, { min: 1.001, max: 10000 });
  if (!match || !selection || odds === null) return null;
  const requestedStatus = cleanText(value.status, 20).toLowerCase();
  return {
    id: cleanText(value.id, 80, `leg-${index + 1}`),
    match,
    market: cleanText(value.market, 120, "Voittaja (1X2)"),
    selection,
    odds: Number(odds.toFixed(4)),
    status: LEG_STATUS.has(requestedStatus) ? requestedStatus : "open",
    sport: cleanText(value.sport, 80),
    league: cleanText(value.league, 120),
    settlesAt: isoOrNull(value.settlesAt || value.settles_at)
  };
}

export function deriveExternalSlipStatus(legs = []) {
  const normalized = Array.isArray(legs) ? legs : [];
  if (!normalized.length || normalized.some((leg) => leg?.status === "open")) {
    return normalized.some((leg) => leg?.status === "lost") ? "lost" : "open";
  }
  if (normalized.some((leg) => leg?.status === "lost")) return "lost";
  if (normalized.every((leg) => ["void", "push"].includes(leg?.status))) return "void";
  return "won";
}

export function externalSlipProgress(legs = []) {
  const counts = { total: 0, open: 0, won: 0, lost: 0, void: 0, push: 0 };
  for (const leg of Array.isArray(legs) ? legs : []) {
    const status = LEG_STATUS.has(leg?.status) ? leg.status : "open";
    counts.total += 1;
    counts[status] += 1;
  }
  return counts;
}

function productOdds(legs) {
  const value = legs.reduce((product, leg) => product * Number(leg.odds || 0), 1);
  return legs.length && Number.isFinite(value) && value > 1 ? Number(value.toFixed(4)) : null;
}

export function normalizeExternalSlipDraft(value = {}) {
  const legs = (Array.isArray(value.legs) ? value.legs : []).slice(0, 50)
    .map((leg, index) => normalizeExternalSlipLeg(leg, index)).filter(Boolean);
  if (!legs.length) return null;

  const combinedOdds = numberOrNull(value.combinedOdds ?? value.combined_odds, { min: 1.001, max: 100000000 }) ?? productOdds(legs);
  if (combinedOdds === null) return null;
  const stake = numberOrNull(value.stake, { min: 0, max: 10000000 });
  const potentialReturn = numberOrNull(value.potentialReturn ?? value.potential_return, { min: 0, max: 1000000000 })
    ?? (stake === null ? null : Number((stake * combinedOdds).toFixed(2)));

  return {
    provider: cleanText(value.provider, 120, "manual"),
    externalReference: cleanText(value.externalReference ?? value.external_reference, 180),
    title: cleanText(value.title, 180, "External slip"),
    currency: cleanText(value.currency, 3, "EUR").toUpperCase(),
    stake,
    combinedOdds: Number(combinedOdds.toFixed(4)),
    potentialReturn,
    purchasedAt: isoOrNull(value.purchasedAt ?? value.purchased_at),
    resolvesAt: isoOrNull(value.resolvesAt ?? value.resolves_at),
    status: deriveExternalSlipStatus(legs),
    legs,
    source: cleanText(value.source, 60, "external-slip-reference-v1")
  };
}

export function externalSlipParentRow(value = {}, userId) {
  const slip = normalizeExternalSlipDraft(value);
  if (!slip || !userId) return null;
  const stake = slip.stake ?? 0;
  const potentialReturn = slip.potentialReturn ?? 0;
  return {
    user_id: userId,
    status: `external_${slip.status}`,
    total_stake: stake,
    potential_return: potentialReturn,
    potential_profit: Math.max(0, potentialReturn - stake),
    decision: EXTERNAL_SLIP_DECISION,
    warnings: {
      schemaVersion: 1,
      source: slip.source,
      provider: slip.provider,
      externalReference: slip.externalReference,
      title: slip.title,
      currency: slip.currency,
      combinedOdds: slip.combinedOdds,
      purchasedAt: slip.purchasedAt,
      resolvesAt: slip.resolvesAt,
      excludedFromPaperPerformance: true,
      excludedFromAutonomousAgent: true
    },
    blockers: []
  };
}

export function externalSlipItemRows(value = {}, slipId, userId) {
  const slip = normalizeExternalSlipDraft(value);
  if (!slip || !slipId || !userId) return [];
  return slip.legs.map((leg, index) => ({
    bet_slip_id: slipId,
    user_id: userId,
    sport: leg.sport || null,
    league: leg.league || null,
    match: leg.match,
    market: leg.market,
    selection: leg.selection,
    bookmaker: slip.provider,
    odds: leg.odds,
    stake: 0,
    edge: null,
    ev: null,
    confidence: null,
    model_probability: null,
    implied_probability: null,
    decision: `${LEG_PREFIX}${leg.status.toUpperCase()}`,
    risk_warnings: {
      schemaVersion: 1,
      source: slip.source,
      externalLegId: leg.id || `leg-${index + 1}`,
      settlesAt: leg.settlesAt,
      excludedFromPaperPerformance: true
    },
    risk_blockers: []
  }));
}

export function externalLegStatusFromDecision(value) {
  const normalized = cleanText(value, 40).toUpperCase();
  if (!normalized.startsWith(LEG_PREFIX)) return "open";
  const status = normalized.slice(LEG_PREFIX.length).toLowerCase();
  return LEG_STATUS.has(status) ? status : "open";
}

export function isExternalSlipRow(row = {}) {
  const metadata = objectValue(row.warnings);
  return row.decision === EXTERNAL_SLIP_DECISION && metadata.source === "external-slip-reference-v1";
}

export function externalSlipFromRows(row = {}, items = []) {
  if (!isExternalSlipRow(row)) return null;
  const metadata = objectValue(row.warnings);
  const legs = (Array.isArray(items) ? items : []).map((item, index) => {
    const legMeta = objectValue(item.risk_warnings);
    return normalizeExternalSlipLeg({
      id: legMeta.externalLegId || item.id || `leg-${index + 1}`,
      match: item.match,
      market: item.market,
      selection: item.selection,
      odds: item.odds,
      status: externalLegStatusFromDecision(item.decision),
      sport: item.sport,
      league: item.league,
      settlesAt: legMeta.settlesAt
    }, index);
  }).filter(Boolean);

  return {
    id: row.id,
    provider: cleanText(metadata.provider, 120, items[0]?.bookmaker || "manual"),
    externalReference: cleanText(metadata.externalReference, 180),
    title: cleanText(metadata.title, 180, "External slip"),
    currency: cleanText(metadata.currency, 3, "EUR").toUpperCase(),
    stake: numberOrNull(row.total_stake, { min: 0 }),
    combinedOdds: numberOrNull(metadata.combinedOdds, { min: 1.001 }) ?? productOdds(legs),
    potentialReturn: numberOrNull(row.potential_return, { min: 0 }),
    purchasedAt: isoOrNull(metadata.purchasedAt),
    resolvesAt: isoOrNull(metadata.resolvesAt),
    status: deriveExternalSlipStatus(legs),
    legs,
    source: "external-slip-reference-v1",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
