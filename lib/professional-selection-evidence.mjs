export const PROFESSIONAL_SELECTION_EVIDENCE_VERSION = "scorecaster-professional-selection-evidence-v1";

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

export function normalizedProfessionalDecision(value) {
  const decision = clean(value || "WATCH", 20).toUpperCase();
  if (["BET", "PLAY"].includes(decision)) return "PLAY";
  if (["PASS", "SKIP"].includes(decision)) return "SKIP";
  if (decision === "CAUTION") return "CAUTION";
  return "WATCH";
}

function candidateOffers(selection = {}) {
  const sources = [
    selection.offers,
    selection.bookmakerOffers,
    selection.providerOffers,
    selection.prices,
    selection.bookmakers,
    selection.priceComparison,
    selection.bookmakerComparison
  ];
  const rows = sources.find(Array.isArray) || [];
  const offers = rows.map((row) => ({
    bookmakerKey: clean(row?.bookmakerKey ?? row?.bookmaker_key ?? row?.key ?? row?.providerId ?? row?.provider_id, 100).toLowerCase(),
    bookmaker: clean(row?.bookmaker ?? row?.bookmakerTitle ?? row?.bookmaker_title ?? row?.title ?? row?.providerName ?? row?.provider_name, 140),
    odds: finite(row?.odds ?? row?.price ?? row?.decimalOdds ?? row?.decimal_odds),
    observedAt: row?.observedAt ?? row?.observed_at ?? row?.updatedAt ?? row?.updated_at ?? null,
    available: row?.available !== false && row?.suspended !== true
  })).filter((row) => row.odds !== null && row.odds > 1 && row.available);

  const directOdds = finite(selection.odds ?? selection.price ?? selection.decimalOdds);
  if (directOdds !== null && directOdds > 1) {
    offers.push({
      bookmakerKey: clean(selection.bookmakerKey ?? selection.bookmaker_key, 100).toLowerCase(),
      bookmaker: clean(selection.bookmaker || "Best available price", 140),
      odds: directOdds,
      observedAt: selection.observedAt ?? selection.capturedAt ?? selection.generatedAt ?? null,
      available: true
    });
  }
  return offers;
}

export function professionalOffers(selection = {}) {
  const deduplicated = new Map();
  for (const offer of candidateOffers(selection)) {
    const identity = offer.bookmakerKey || offer.bookmaker.toLowerCase() || "unknown";
    const previous = deduplicated.get(identity);
    if (!previous || offer.odds > previous.odds || (offer.odds === previous.odds && Date.parse(offer.observedAt || 0) > Date.parse(previous.observedAt || 0))) {
      deduplicated.set(identity, offer);
    }
  }
  return [...deduplicated.values()].sort((left, right) => right.odds - left.odds || left.bookmaker.localeCompare(right.bookmaker));
}

export function evaluateProfessionalSelection(selection = {}, preferences = {}) {
  const bookmakerKey = clean(preferences.bookmakerKey || "all", 100).toLowerCase();
  const bookmakerLabel = clean(preferences.bookmakerLabel || "Best available price", 140);
  const offers = professionalOffers(selection);
  let offer = null;
  let preferredProviderUnavailable = false;

  if (bookmakerKey === "all") {
    offer = offers[0] || null;
  } else {
    offer = offers.find((row) => row.bookmakerKey === bookmakerKey || row.bookmaker.toLowerCase() === bookmakerKey) || null;
    preferredProviderUnavailable = !offer;
  }

  if (!offer) {
    const directOdds = finite(selection.odds ?? selection.price ?? selection.decimalOdds);
    offer = {
      bookmakerKey: clean(selection.bookmakerKey ?? selection.bookmaker_key, 100).toLowerCase(),
      bookmaker: clean(selection.bookmaker || bookmakerLabel, 140),
      odds: directOdds,
      observedAt: selection.observedAt ?? selection.capturedAt ?? selection.generatedAt ?? null,
      available: directOdds !== null && directOdds > 1
    };
  }

  const modelProbability = finite(selection.modelProbability ?? selection.consensusProbability ?? selection.probability);
  const marketProbability = finite(selection.marketProbability ?? selection.noVigProbability ?? selection.marketConsensusProbability);
  const fairOdds = finite(selection.fairOdds) ?? (modelProbability !== null && modelProbability > 0 ? 1 / modelProbability : null);
  const edge = finite(selection.edge) ?? (modelProbability !== null && marketProbability !== null ? modelProbability - marketProbability : null);
  const ev = modelProbability !== null && offer.odds !== null && offer.odds > 1
    ? modelProbability * offer.odds - 1
    : finite(selection.ev);

  return {
    version: PROFESSIONAL_SELECTION_EVIDENCE_VERSION,
    decision: normalizedProfessionalDecision(selection.productDecision ?? selection.decision),
    bookmakerPreference: { bookmakerKey, bookmakerLabel },
    selectedOffer: {
      ...offer,
      preferredProviderUnavailable
    },
    availableOffers: offers,
    modelProbability,
    marketProbability,
    fairOdds,
    edge,
    ev,
    invariants: {
      providerChangesOnlyOfferedPrice: true,
      modelProbabilityIndependentOfProvider: true,
      marketBenchmarkIndependentOfProvider: true,
      realMoneyExecution: false,
      paperOnly: true
    }
  };
}
