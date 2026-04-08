function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function applyValueBetFilters(valueBets = [], filters = {}) {
  if (!Array.isArray(valueBets)) return [];

  const minEdgePercent = toNumber(filters.minEdge);
  const minOdds = toNumber(filters.minOdds);
  const maxOdds = toNumber(filters.maxOdds);
  const onlyPositiveEV = Boolean(filters.onlyPositiveEV);

  return valueBets.filter((bet) => {
    const edge = Number(bet?.edge ?? 0);
    const ev = Number(bet?.ev ?? 0);
    const odds = Number(bet?.odds ?? 0);

    if (minEdgePercent !== null && edge * 100 < minEdgePercent) {
      return false;
    }

    if (minOdds !== null && odds < minOdds) {
      return false;
    }

    if (maxOdds !== null && odds > maxOdds) {
      return false;
    }

    if (onlyPositiveEV && ev <= 0) {
      return false;
    }

    return true;
  });
}

export function getDefaultValueBetFilters() {
  return {
    minEdge: "",
    minOdds: "",
    maxOdds: "",
    onlyPositiveEV: true,
  };
}
