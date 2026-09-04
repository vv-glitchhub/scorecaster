const LEG_STATUS = new Set(["open", "won", "lost", "void", "push"]);
const SLIP_STATUS = new Set(["open", "won", "lost", "void"]);

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

export function normalizeExternalSlipLeg(value = {}, index = 0) {
  const match = cleanText(value.match, 240);
  const selection = cleanText(value.selection || value.label, 180);
  const odds = numberOrNull(value.odds, { min: 1.001, max: 10000 });
  if (!match || !selection || odds === null) return null;

  const requestedStatus = cleanText(value.status, 20).toLowerCase();
  const status = LEG_STATUS.has(requestedStatus) ? requestedStatus : "open";

  return {
    id: cleanText(value.id, 80, `leg-${index + 1}`),
    match,
    market: cleanText(value.market, 120, "Voittaja (1X2)"),
    selection,
    odds: Number(odds.toFixed(4)),
    status,
    sport: cleanText(value.sport, 80),
    league: cleanText(value.league, 120),
    settlesAt: isoOrNull(value.settlesAt || value.settles_at)
  };
}

export function deriveExternalSlipStatus(legs = []) {
  const normalized = Array.isArray(legs) ? legs : [];
  if (!normalized.length) return "open";
  if (normalized.some((leg) => leg?.status === "lost")) return "lost";
  if (normalized.some((leg) => leg?.status === "open")) return "open";
  if (normalized.every((leg) => ["void", "push"].includes(leg?.status))) return "void";
  return "won";
}

export function externalSlipProgress(legs = []) {
  const normalized = Array.isArray(legs) ? legs : [];
  const counts = { total: normalized.length, open: 0, won: 0, lost: 0, void: 0, push: 0 };
  for (const leg of normalized) {
    const status = LEG_STATUS.has(leg?.status) ? leg.status : "open";
    counts[status] += 1;
  }
  return counts;
}

function productOdds(legs) {
  if (!legs.length) return null;
  const value = legs.reduce((product, leg) => product * Number(leg.odds || 0), 1);
  return Number.isFinite(value) && value > 1 ? Number(value.toFixed(4)) : null;
}

export function normalizeExternalSlipDraft(value = {}) {
  const legs = (Array.isArray(value.legs) ? value.legs : [])
    .slice(0, 50)
    .map((leg, index) => normalizeExternalSlipLeg(leg, index))
    .filter(Boolean);

  if (!legs.length) return null;

  const requestedCombinedOdds = numberOrNull(value.combinedOdds ?? value.combined_odds, { min: 1.001, max: 100000000 });
  const combinedOdds = requestedCombinedOdds ?? productOdds(legs);
  if (combinedOdds === null) return null;

  const stake = numberOrNull(value.stake, { min: 0, max: 10000000 });
  const requestedPotentialReturn = numberOrNull(value.potentialReturn ?? value.potential_return, { min: 0, max: 1000000000 });
  const potentialReturn = requestedPotentialReturn ?? (stake === null ? null : Number((stake * combinedOdds).toFixed(2)));
  const requestedStatus = cleanText(value.status, 20).toLowerCase();
  const derivedStatus = deriveExternalSlipStatus(legs);

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
    status: SLIP_STATUS.has(requestedStatus) && requestedStatus !== "open" && derivedStatus === "open"
      ? "open"
      : derivedStatus,
    legs,
    source: cleanText(value.source, 60, "manual")
  };
}

export function externalSlipDatabaseRow(value = {}, userId) {
  const normalized = normalizeExternalSlipDraft(value);
  if (!normalized || !userId) return null;
  return {
    user_id: userId,
    provider: normalized.provider,
    external_reference: normalized.externalReference || null,
    title: normalized.title,
    currency: normalized.currency,
    stake: normalized.stake,
    combined_odds: normalized.combinedOdds,
    potential_return: normalized.potentialReturn,
    purchased_at: normalized.purchasedAt,
    resolves_at: normalized.resolvesAt,
    status: normalized.status,
    legs: normalized.legs,
    source: normalized.source
  };
}
