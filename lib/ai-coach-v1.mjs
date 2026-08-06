export const AI_COACH_VERSION = "scorecaster-ai-coach-v1";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, digits = 4) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const text = (value, maximum = 180) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);
const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const mean = (values) => {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
};
const sum = (values) => values.filter(Number.isFinite).reduce((total, value) => total + value, 0);

function sampleState(count, minimum = 20) {
  if (count < Math.max(5, Math.floor(minimum * 0.4))) return "insufficient";
  if (count < minimum) return "provisional";
  return "usable";
}

function oddsBand(odds) {
  if (!Number.isFinite(odds)) return "unknown";
  if (odds < 1.5) return "1.01-1.49";
  if (odds < 2) return "1.50-1.99";
  if (odds < 3) return "2.00-2.99";
  if (odds < 5) return "3.00-4.99";
  return "5.00+";
}

function normalizeObservation(row = {}) {
  const createdAt = iso(row.bet_created_at ?? row.betCreatedAt ?? row.created_at ?? row.createdAt);
  const kickoffAt = iso(row.commence_time ?? row.commenceTime ?? row.kickoffAt);
  const settledAt = iso(row.settled_at ?? row.settledAt ?? row.updated_at ?? row.updatedAt);
  const outcome = finite(row.outcome_value ?? row.outcomeValue);
  const stake = Math.max(0, finite(row.stake) ?? 0);
  const profit = finite(row.profit);
  const entryOdds = finite(row.entry_odds ?? row.entryOdds);
  const priceClv = finite(row.price_clv ?? row.priceClv);
  const probabilityClv = finite(row.probability_clv ?? row.probabilityClv);
  const exclusionReason = text(row.exclusion_reason ?? row.exclusionReason, 160) || null;
  const minutesBeforeStart = createdAt && kickoffAt
    ? (Date.parse(kickoffAt) - Date.parse(createdAt)) / 60000
    : null;

  return {
    id: text(row.id, 100),
    betId: text(row.bet_id ?? row.betId, 100),
    eventId: text(row.event_id ?? row.eventId, 180),
    sport: text(row.sport, 100) || "unknown",
    league: text(row.league, 140) || "unknown",
    market: text(row.market, 80) || "unknown",
    selection: text(row.selection, 160) || "unknown",
    bookmaker: text(row.bookmaker, 120) || "unknown",
    decision: text(row.decision, 30).toUpperCase() || "UNKNOWN",
    modelVersion: text(row.model_version ?? row.modelVersion, 120) || "unknown",
    entryOdds,
    oddsBand: oddsBand(entryOdds),
    modelProbability: finite(row.model_probability ?? row.modelProbability),
    closingProbability: finite(row.closing_consensus_probability ?? row.closingConsensusProbability),
    closingProviderCount: finite(row.closing_provider_count ?? row.closingProviderCount) ?? 0,
    priceClv,
    probabilityClv,
    brier: finite(row.brier_score ?? row.brierScore ?? row.brier),
    logLoss: finite(row.log_loss ?? row.logLoss),
    outcome,
    stake,
    profit,
    status: text(row.status, 30).toLowerCase() || "unknown",
    exclusionReason,
    createdAt,
    kickoffAt,
    settledAt,
    minutesBeforeStart: Number.isFinite(minutesBeforeStart) ? minutesBeforeStart : null,
    eligible: !exclusionReason && (outcome === 0 || outcome === 1) && priceClv !== null
  };
}

function maximumDrawdown(records) {
  let equity = 0;
  let peak = 0;
  let drawdown = 0;
  for (const record of records) {
    equity += Number.isFinite(record.profit) ? record.profit : 0;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, peak - equity);
  }
  return drawdown;
}

function summarize(records, minimumSample) {
  const eligible = records.filter((record) => record.eligible);
  const totalStake = sum(eligible.map((record) => record.stake));
  const totalProfit = sum(eligible.map((record) => record.profit));
  const sorted = [...eligible].sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0));
  return {
    observations: records.length,
    eligible: eligible.length,
    excluded: records.length - eligible.length,
    sampleState: sampleState(eligible.length, minimumSample),
    meanPriceClv: round(mean(eligible.map((record) => record.priceClv))),
    meanProbabilityClv: round(mean(eligible.map((record) => record.probabilityClv))),
    meanBrier: round(mean(eligible.map((record) => record.brier))),
    meanLogLoss: round(mean(eligible.map((record) => record.logLoss))),
    hitRate: round(mean(eligible.map((record) => record.outcome))),
    totalStake: round(totalStake, 2),
    totalProfit: round(totalProfit, 2),
    paperYield: totalStake > 0 ? round(totalProfit / totalStake) : null,
    maximumDrawdown: round(maximumDrawdown(sorted), 2)
  };
}

function buildSlices(records, key, minimumSample) {
  const groups = new Map();
  for (const record of records.filter((item) => item.eligible)) {
    const value = text(record[key], 140) || "unknown";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(record);
  }
  return [...groups.entries()]
    .map(([value, rows]) => ({ dimension: key, value, ...summarize(rows, minimumSample) }))
    .sort((left, right) => right.eligible - left.eligible || String(left.value).localeCompare(String(right.value)))
    .slice(0, 30);
}

function insight(input) {
  return {
    id: input.id,
    tone: input.tone || "observation",
    confidence: input.confidence || "insufficient",
    title: input.title,
    message: input.message,
    action: input.action,
    numerator: input.numerator ?? null,
    denominator: input.denominator ?? null,
    supportingIds: [...new Set((input.supportingIds || []).filter(Boolean))].slice(0, 50),
    evidence: input.evidence || {},
    canChangeModel: false,
    canChangeStakeAutomatically: false
  };
}

function clvInsight(eligible, minimumSample) {
  const value = mean(eligible.map((record) => record.priceClv));
  if (value === null) return null;
  const state = sampleState(eligible.length, minimumSample);
  if (value >= 0.01) {
    return insight({
      id: "positive-clv-process",
      tone: "strength",
      confidence: state,
      title: "Entries have beaten the closing market",
      message: `Average verified price CLV is ${(value * 100).toFixed(2)}% across ${eligible.length} eligible paper decisions.`,
      action: "Keep recording provider, entry time and closing evidence consistently.",
      numerator: eligible.filter((record) => record.priceClv > 0).length,
      denominator: eligible.length,
      supportingIds: eligible.filter((record) => record.priceClv > 0).map((record) => record.id),
      evidence: { meanPriceClv: round(value), minimumSample }
    });
  }
  if (value <= -0.01) {
    return insight({
      id: "negative-clv-process",
      tone: "caution",
      confidence: state,
      title: "Entry prices have trailed the closing market",
      message: `Average verified price CLV is ${(value * 100).toFixed(2)}% across ${eligible.length} eligible paper decisions.`,
      action: "Compare available providers and re-check the price before saving a paper decision.",
      numerator: eligible.filter((record) => record.priceClv < 0).length,
      denominator: eligible.length,
      supportingIds: eligible.filter((record) => record.priceClv < 0).map((record) => record.id),
      evidence: { meanPriceClv: round(value), minimumSample }
    });
  }
  return insight({
    id: "neutral-clv-process",
    tone: "observation",
    confidence: state,
    title: "Closing-line evidence is broadly neutral",
    message: `Average verified price CLV is ${(value * 100).toFixed(2)}% across ${eligible.length} eligible paper decisions.`,
    action: "Continue collecting a larger chronological sample before drawing a strong conclusion.",
    numerator: eligible.length,
    denominator: minimumSample,
    supportingIds: eligible.map((record) => record.id),
    evidence: { meanPriceClv: round(value), minimumSample }
  });
}

function lateEntryInsight(eligible, minimumSample) {
  const late = eligible.filter((record) => record.minutesBeforeStart !== null && record.minutesBeforeStart <= 30 && record.minutesBeforeStart >= 0);
  const earlier = eligible.filter((record) => record.minutesBeforeStart !== null && record.minutesBeforeStart > 30);
  if (late.length < 5 || earlier.length < 5) return null;
  const lateClv = mean(late.map((record) => record.priceClv));
  const earlyClv = mean(earlier.map((record) => record.priceClv));
  if (lateClv === null || earlyClv === null || lateClv >= earlyClv - 0.01) return null;
  return insight({
    id: "late-entry-cost",
    tone: "caution",
    confidence: sampleState(late.length + earlier.length, minimumSample),
    title: "Late entries have received weaker prices",
    message: `Entries inside 30 minutes of start averaged ${(lateClv * 100).toFixed(2)}% CLV versus ${(earlyClv * 100).toFixed(2)}% for earlier entries.`,
    action: "Set an earlier review checkpoint and avoid saving when the verified market feed is stale or incomplete.",
    numerator: late.length,
    denominator: late.length + earlier.length,
    supportingIds: late.map((record) => record.id),
    evidence: { lateMeanPriceClv: round(lateClv), earlierMeanPriceClv: round(earlyClv), thresholdMinutes: 30 }
  });
}

function priceChoiceInsight(priceChoices, minimumSample) {
  const usable = (Array.isArray(priceChoices) ? priceChoices : []).filter((item) =>
    Number.isFinite(finite(item.entryOdds)) && Number.isFinite(finite(item.bestAvailableOdds)) && finite(item.bestAvailableOdds) > 1
  ).map((item) => {
    const entry = finite(item.entryOdds);
    const best = finite(item.bestAvailableOdds);
    return { ...item, entry, best, missed: Math.max(0, best / entry - 1) };
  });
  const missed = usable.filter((item) => item.missed >= 0.01);
  if (usable.length < 5 || missed.length < 3) return null;
  const averageMissed = mean(missed.map((item) => item.missed));
  return insight({
    id: "provider-price-choice",
    tone: "caution",
    confidence: sampleState(usable.length, minimumSample),
    title: "A better provider price was available at entry",
    message: `${missed.length} of ${usable.length} audited entries missed at least 1% of available decimal-price value.`,
    action: "Use Bookmaker Hub and save the paper entry only after confirming the selected provider price.",
    numerator: missed.length,
    denominator: usable.length,
    supportingIds: missed.map((item) => text(item.observationId, 100)),
    evidence: { averageMissedPriceValue: round(averageMissed), threshold: 0.01 }
  });
}

function correlationInsight(eligible, minimumSample) {
  const groups = new Map();
  for (const record of eligible) {
    if (!record.eventId) continue;
    if (!groups.has(record.eventId)) groups.set(record.eventId, []);
    groups.get(record.eventId).push(record);
  }
  const correlated = [...groups.values()].filter((rows) => rows.length >= 2);
  if (!correlated.length) return null;
  const correlatedRows = correlated.flat();
  const correlatedStake = sum(correlatedRows.map((row) => row.stake));
  const totalStake = sum(eligible.map((row) => row.stake));
  const share = totalStake > 0 ? correlatedStake / totalStake : 0;
  if (share < 0.2 && correlated.length < 3) return null;
  return insight({
    id: "correlated-event-exposure",
    tone: "caution",
    confidence: sampleState(eligible.length, minimumSample),
    title: "Multiple selections share the same event risk",
    message: `${correlated.length} events contain multiple paper selections and represent ${(share * 100).toFixed(1)}% of audited paper exposure.`,
    action: "Review same-event selections as one exposure group and keep the portfolio cap in force.",
    numerator: correlatedRows.length,
    denominator: eligible.length,
    supportingIds: correlatedRows.map((record) => record.id),
    evidence: { eventGroups: correlated.length, correlatedStakeShare: round(share) }
  });
}

function goodLossInsight(eligible, minimumSample) {
  const goodLosses = eligible.filter((record) => record.outcome === 0 && record.priceClv > 0.01);
  if (!goodLosses.length) return null;
  return insight({
    id: "good-process-losses",
    tone: "strength",
    confidence: sampleState(goodLosses.length, minimumSample),
    title: "Some losing outcomes still showed good price discipline",
    message: `${goodLosses.length} losing paper decisions beat the verified closing line by more than 1%.`,
    action: "Evaluate process with closing-line evidence as well as short-term results.",
    numerator: goodLosses.length,
    denominator: eligible.filter((record) => record.outcome === 0).length,
    supportingIds: goodLosses.map((record) => record.id),
    evidence: { positiveClvThreshold: 0.01 }
  });
}

function skipInsight(audits, minimumSample) {
  const rows = (Array.isArray(audits) ? audits : []).filter((row) => row && row.allowed === false);
  if (!rows.length) return null;
  const safetyRows = rows.filter((row) => {
    const reasons = Array.isArray(row.reasons) ? row.reasons.join(" ") : String(row.reasons || "");
    return /risk|coverage|confidence|stale|conflict|quality|price|edge|exposure/i.test(reasons);
  });
  if (!safetyRows.length) return null;
  return insight({
    id: "disciplined-skips",
    tone: "strength",
    confidence: sampleState(safetyRows.length, minimumSample),
    title: "Safety gates have prevented weak paper entries",
    message: `${safetyRows.length} of ${rows.length} audited skips were supported by explicit quality, price or risk reasons.`,
    action: "Keep SKIP decisions in the audit trail; not acting is part of a measurable process.",
    numerator: safetyRows.length,
    denominator: rows.length,
    supportingIds: safetyRows.map((row) => text(row.id, 100)),
    evidence: { source: "autonomous-agent-decision-audit" }
  });
}

export function buildAiCoachReport(input = {}) {
  const generatedAt = iso(input.generatedAt) || new Date().toISOString();
  const minimumSample = clamp(Math.round(finite(input.minimumSample) ?? 20), 10, 500);
  const records = (Array.isArray(input.observations) ? input.observations : [])
    .map(normalizeObservation)
    .filter((record) => record.createdAt)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const eligible = records.filter((record) => record.eligible);
  const overview = summarize(records, minimumSample);
  const insights = [
    clvInsight(eligible, minimumSample),
    lateEntryInsight(eligible, minimumSample),
    priceChoiceInsight(input.priceChoices, minimumSample),
    correlationInsight(eligible, minimumSample),
    goodLossInsight(eligible, minimumSample),
    skipInsight(input.decisionAudits, minimumSample)
  ].filter(Boolean);

  const exclusions = records.reduce((counts, record) => {
    if (record.exclusionReason) counts[record.exclusionReason] = (counts[record.exclusionReason] || 0) + 1;
    return counts;
  }, {});

  return {
    ok: true,
    version: AI_COACH_VERSION,
    generatedAt,
    window: {
      days: clamp(Math.round(finite(input.windowDays) ?? 365), 7, 1825),
      minimumSample
    },
    overview,
    insights,
    slices: {
      sport: buildSlices(records, "sport", minimumSample),
      league: buildSlices(records, "league", minimumSample),
      market: buildSlices(records, "market", minimumSample),
      bookmaker: buildSlices(records, "bookmaker", minimumSample),
      oddsBand: buildSlices(records, "oddsBand", minimumSample),
      decision: buildSlices(records, "decision", minimumSample),
      modelVersion: buildSlices(records, "modelVersion", minimumSample)
    },
    evidence: {
      observationsReceived: records.length,
      eligibleObservationIds: eligible.map((record) => record.id),
      exclusions,
      decisionAuditRows: Array.isArray(input.decisionAudits) ? input.decisionAudits.length : 0,
      priceChoiceRows: Array.isArray(input.priceChoices) ? input.priceChoices.length : 0
    },
    boundaries: {
      personalDataScope: "authenticated user's own paper records only",
      modelProbabilityChanged: false,
      automaticDecisionChanged: false,
      automaticStakeChanged: false,
      realMoneyExecution: false,
      lossChasingAdvice: false,
      profitGuarantee: false,
      lowSampleFindingsAreFacts: false,
      paperOnly: true
    },
    audit: {
      formulas: {
        paperYield: "sum(profit) / sum(stake)",
        priceClv: "entry_odds * closing_no_vig_probability - 1",
        providerMissedValue: "best_available_odds / entry_odds - 1",
        maximumDrawdown: "maximum running peak minus subsequent paper equity"
      },
      deterministic: true,
      generatedNarrativeUsedAsEvidence: false
    }
  };
}
