export function buildCLVTrackingV2({ closingLines = [], picks = [] } = {}) {
  const records = Array.isArray(closingLines) ? closingLines : [];
  const safePicks = Array.isArray(picks) ? picks : [];
  const enriched = records.map((record) => enrichCLVRecord(record));

  return {
    ok: true,
    source: "clv-tracking-v2",
    generatedAt: new Date().toISOString(),
    summary: summarizeCLV(enriched),
    bookmakerRanking: rankBySegment(enriched, "bookmaker"),
    leagueRanking: rankBySegment(enriched, "league"),
    marketRanking: rankBySegment(enriched, "market_key"),
    biggestPositiveCLV: [...enriched].sort((a, b) => b.clvPercent - a.clvPercent).slice(0, 10),
    biggestNegativeCLV: [...enriched].sort((a, b) => a.clvPercent - b.clvPercent).slice(0, 10),
    openPickCoverage: calculatePickCoverage({ records: enriched, picks: safePicks }),
    records: enriched
  };
}

function enrichCLVRecord(record = {}) {
  const openingOdds = Number(record.opening_odds || record.openingOdds || 0);
  const currentOdds = Number(record.current_odds || record.currentOdds || record.odds || 0);
  const closingOdds = Number(record.closing_odds || record.closingOdds || 0);
  const referenceOdds = currentOdds || openingOdds;
  const clv = calculateCLV({ referenceOdds, closingOdds });

  return {
    ...record,
    openingOdds,
    currentOdds,
    closingOdds,
    referenceOdds,
    clv,
    clvPercent: clv.percent,
    clvGrade: gradeCLV(clv.percent),
    clvDirection: clv.percent > 0.25 ? "positive" : clv.percent < -0.25 ? "negative" : "neutral"
  };
}

function calculateCLV({ referenceOdds, closingOdds }) {
  const ref = Number(referenceOdds || 0);
  const close = Number(closingOdds || 0);

  if (!ref || !close || ref <= 1 || close <= 1) {
    return { value: 0, percent: 0, available: false };
  }

  const value = ref - close;
  const percent = (value / close) * 100;
  return { value, percent, available: true };
}

function summarizeCLV(records) {
  const available = records.filter((record) => record.clv?.available);
  const positive = available.filter((record) => record.clvPercent > 0).length;
  const negative = available.filter((record) => record.clvPercent < 0).length;
  const neutral = available.length - positive - negative;
  const averageCLV = average(available.map((record) => record.clvPercent));

  return {
    count: records.length,
    available: available.length,
    coverage: records.length ? available.length / records.length : 0,
    positive,
    negative,
    neutral,
    positiveRate: available.length ? positive / available.length : 0,
    averageCLV,
    grade: gradeCLV(averageCLV)
  };
}

function rankBySegment(records, key) {
  const grouped = new Map();

  for (const record of records.filter((item) => item.clv?.available)) {
    const name = record[key] || "Unknown";
    const group = grouped.get(name) || [];
    group.push(record);
    grouped.set(name, group);
  }

  return Array.from(grouped.entries())
    .map(([name, group]) => {
      const avg = average(group.map((item) => item.clvPercent));
      const positive = group.filter((item) => item.clvPercent > 0).length;
      return {
        name,
        count: group.length,
        averageCLV: avg,
        positiveRate: group.length ? positive / group.length : 0,
        grade: gradeCLV(avg)
      };
    })
    .sort((a, b) => b.averageCLV - a.averageCLV);
}

function calculatePickCoverage({ records, picks }) {
  const keys = new Set(records.map((record) => buildKey(record)));
  const covered = picks.filter((pick) => keys.has(buildKey({
    game_id: pick.gameId || pick.id,
    selection: pick.selection,
    market_key: pick.marketKey || pick.market,
    bookmaker: pick.bookmaker
  })));

  return {
    picks: picks.length,
    covered: covered.length,
    coverage: picks.length ? covered.length / picks.length : 0
  };
}

function buildKey(item = {}) {
  return [
    item.game_id || item.gameId || "",
    item.market_key || item.marketKey || item.market || "",
    item.selection || "",
    item.bookmaker || ""
  ].join("::").toLowerCase();
}

function gradeCLV(value) {
  if (value >= 5) return "A+";
  if (value >= 3) return "A";
  if (value >= 1) return "B";
  if (value >= -1) return "C";
  if (value >= -3) return "D";
  return "F";
}

function average(values = []) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}
