function clean(value, limit = 200) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 4) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(digits));
}

function groupSnapshots(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.event_id}:${row.selection}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const group of groups.values()) group.sort((left, right) => timestamp(left.captured_at) - timestamp(right.captured_at));
  return groups;
}

export function buildUnifiedCalibrationRows({ closingRecords = [], snapshots = [], now = Date.now() } = {}) {
  const groups = groupSnapshots(snapshots);
  const rows = [];
  for (const close of closingRecords) {
    const commence = timestamp(close.commence_time);
    const closedAt = timestamp(close.closing_captured_at);
    if (commence === null || closedAt === null || commence > now || closedAt > commence) continue;
    const key = `${close.event_id}:${close.selection}`;
    const prestart = (groups.get(key) || []).filter((snapshot) => {
      const captured = timestamp(snapshot.captured_at);
      return captured !== null && captured <= commence;
    });
    if (!prestart.length) continue;
    const opening = prestart[0];
    const final = prestart.at(-1);
    if (final.id && close.closing_snapshot_id && final.id !== close.closing_snapshot_id) continue;

    rows.push({
      version: "unified-data-calibration-row-v1",
      eventId: clean(close.event_id, 180),
      selection: clean(close.selection, 160),
      sportKey: clean(close.sport_key || final.sport_key, 120) || null,
      league: clean(close.league || final.league, 140) || null,
      commenceTime: close.commence_time,
      asOf: close.closing_captured_at,
      market: {
        openingOdds: finite(close.opening_odds ?? opening.odds),
        closingOdds: finite(close.closing_odds),
        priceClv: round(close.price_clv),
        openingCapturedAt: close.opening_captured_at || opening.captured_at,
        closingCapturedAt: close.closing_captured_at
      },
      pregameFeatures: {
        decision: clean(final.decision, 30),
        marketProbability: finite(final.market_probability),
        providerCount: Number(final.provider_count || 0),
        providerDisagreement: round(final.provider_disagreement),
        coverageScore: round(final.coverage_score, 3),
        usedFactorCount: Number(final.used_factor_count || 0),
        totalContextImpact: round(final.total_context_impact),
        safetyAction: clean(final.safety_action, 30),
        missingFamilies: Array.isArray(final.missing_families) ? final.missing_families : [],
        factorStatuses: final.factor_statuses || {}
      },
      chronology: {
        finalSnapshotId: final.id || null,
        finalSnapshotCapturedAt: final.captured_at,
        finalSnapshotAtOrBeforeStart: timestamp(final.captured_at) <= commence,
        closingFinalizedAfterStart: now >= commence,
        postStartSnapshotUsed: false,
        outcomeUsed: false
      },
      allowedUses: ["provider-quality-calibration", "clv-calibration", "shadow-model-research"],
      forbiddenUses: ["pregame-probability", "pregame-edge", "pregame-ev", "automatic-play-upgrade", "real-money-action"]
    });
  }
  return rows.sort((left, right) => timestamp(right.commenceTime) - timestamp(left.commenceTime));
}

export function summarizeUnifiedCalibration(rows = []) {
  const clv = rows.map((row) => finite(row.market?.priceClv)).filter((value) => value !== null);
  const positive = clv.filter((value) => value > 0).length;
  const byProviderCount = {};
  for (const row of rows) {
    const key = String(row.pregameFeatures?.providerCount || 0);
    if (!byProviderCount[key]) byProviderCount[key] = { samples: 0, clvTotal: 0, clvSamples: 0 };
    byProviderCount[key].samples += 1;
    const value = finite(row.market?.priceClv);
    if (value !== null) {
      byProviderCount[key].clvTotal += value;
      byProviderCount[key].clvSamples += 1;
    }
  }
  return {
    sampleSize: rows.length,
    clvSampleSize: clv.length,
    averagePriceClv: clv.length ? round(clv.reduce((sum, value) => sum + value, 0) / clv.length) : null,
    positiveClvRate: clv.length ? round(positive / clv.length, 3) : null,
    byProviderCount: Object.fromEntries(Object.entries(byProviderCount).map(([key, value]) => [key, {
      samples: value.samples,
      averagePriceClv: value.clvSamples ? round(value.clvTotal / value.clvSamples) : null
    }]))
  };
}