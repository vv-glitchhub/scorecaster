import { getCollectorSource, sourceCanPublish } from "./collector-source-registry.mjs";
import { buildTransparent1X2 } from "./transparent-1x2-engine.mjs";

export const CONTEXT_ENGINE_VERSION = "scorecaster-context-engine-v1";

const CATEGORIES = new Set([
  "lineup", "injury", "suspension", "availability", "rest", "travel",
  "weather", "surface", "official"
]);
const TEAM_ROLES = new Set(["home", "away", "event"]);
const CONFIRMATIONS = new Set(["confirmed", "probable", "unconfirmed", "rumor"]);
const CONFIRMATION_WEIGHT = Object.freeze({ confirmed: 1, probable: 0.72, unconfirmed: 0.42, rumor: 0.18 });
const FRESHNESS_MINUTES = Object.freeze({
  lineup: 360,
  injury: 4320,
  suspension: 10080,
  availability: 1440,
  rest: 10080,
  travel: 10080,
  weather: 180,
  surface: 1440,
  official: 1440
});
const TEAM_ELO_CAP = Object.freeze({
  lineup: 45,
  injury: 35,
  suspension: 35,
  availability: 30,
  rest: 18,
  travel: 15,
  weather: 8,
  surface: 10,
  official: 8
});
const REQUIRED_COVERAGE = Object.freeze([
  "lineup",
  "availability",
  "rest",
  "travel",
  "weather",
  "official"
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, digits = 6) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const clean = (value, max = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);
const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

function freshness(category, observedAt, generatedAt) {
  const thresholdMinutes = FRESHNESS_MINUTES[category] || 1440;
  const ageMinutes = Math.max(0, (Date.parse(generatedAt) - Date.parse(observedAt)) / 60000);
  const ratio = ageMinutes / thresholdMinutes;
  const status = ratio <= 1 ? "fresh" : ratio <= 2 ? "aging" : "stale";
  const weight = status === "fresh" ? 1 : status === "aging" ? clamp(2 - ratio, 0.25, 0.75) : 0;
  return { status, ageMinutes: round(ageMinutes, 1), thresholdMinutes, weight: round(weight, 3) };
}

function normalizeEvidence(record = {}, index, eventId, generatedAt, kickoffAt, env) {
  const category = clean(record.category, 40).toLowerCase();
  const teamRole = clean(record.teamRole ?? record.team_role, 20).toLowerCase();
  const confirmation = clean(record.confirmation, 30).toLowerCase();
  const sourceId = clean(record.sourceId ?? record.source_id, 80).toLowerCase();
  const observedAt = iso(record.observedAt ?? record.observed_at);
  const effectiveAt = iso(record.effectiveAt ?? record.effective_at) || observedAt;
  const expiresAt = iso(record.expiresAt ?? record.expires_at);
  const itemEventId = clean(record.eventId ?? record.event_id, 180);
  const id = clean(record.id, 180) || `${itemEventId || eventId || "event"}:${index}`;
  const errors = [];

  if (!itemEventId || itemEventId !== eventId) errors.push("event-id-mismatch");
  if (!CATEGORIES.has(category)) errors.push("unsupported-category");
  if (!TEAM_ROLES.has(teamRole)) errors.push("unsupported-team-role");
  if (!CONFIRMATIONS.has(confirmation)) errors.push("unsupported-confirmation");
  if (!sourceId) errors.push("missing-source-id");
  if (!observedAt) errors.push("missing-observed-at");
  if (observedAt && Date.parse(observedAt) > Date.parse(generatedAt)) errors.push("future-observation");
  if (observedAt && kickoffAt && Date.parse(observedAt) >= Date.parse(kickoffAt)) errors.push("post-kickoff-observation");
  if (effectiveAt && kickoffAt && Date.parse(effectiveAt) > Date.parse(kickoffAt)) errors.push("effective-after-kickoff");

  const source = sourceId ? getCollectorSource(sourceId, env) : null;
  const publication = sourceCanPublish(source);
  if (!publication.allowed) errors.push(`source-${publication.reason}`);

  const confidence = clamp(finite(record.confidence) ?? 0, 0, 1);
  const sourceTrust = clamp(finite(record.sourceTrust ?? record.source_trust) ?? 0.5, 0, 1);
  const impact = clamp(finite(record.impact) ?? 0, -1, 1);
  const currentFreshness = observedAt && CATEGORIES.has(category)
    ? freshness(category, observedAt, generatedAt)
    : { status: "unknown", ageMinutes: null, thresholdMinutes: null, weight: 0 };
  const expired = Boolean(expiresAt && Date.parse(expiresAt) <= Date.parse(generatedAt));
  if (expired) errors.push("expired-evidence");
  if (currentFreshness.status === "stale") errors.push("stale-evidence");

  const confirmationWeight = CONFIRMATION_WEIGHT[confirmation] || 0;
  const evidenceWeight = clamp(confirmationWeight * confidence * sourceTrust * currentFreshness.weight, 0, 1);

  return {
    id,
    eventId: itemEventId || null,
    teamRole,
    team: clean(record.team, 120) || null,
    category,
    subject: clean(record.subject, 160) || "event",
    status: clean(record.status, 120) || "unknown",
    confirmation,
    impact: round(impact, 4),
    confidence: round(confidence, 4),
    sourceTrust: round(sourceTrust, 4),
    sourceId: source?.id || sourceId || null,
    attribution: source?.attributionRequired ? source.attribution : null,
    observedAt,
    effectiveAt,
    expiresAt,
    supersedesId: clean(record.supersedesId ?? record.supersedes_id, 180) || null,
    note: clean(record.publicNote ?? record.public_note ?? record.note, 500) || null,
    freshness: currentFreshness,
    evidenceWeight: round(evidenceWeight, 4),
    errors
  };
}

function removeSuperseded(items) {
  const superseded = new Set(items.map((item) => item.supersedesId).filter(Boolean));
  return items.filter((item) => !superseded.has(item.id));
}

function resolveGroup(items) {
  const ordered = [...items].sort((left, right) => {
    const weight = right.evidenceWeight - left.evidenceWeight;
    if (weight) return weight;
    return Date.parse(right.observedAt) - Date.parse(left.observedAt);
  });
  const leader = ordered[0];
  const challenger = ordered[1];
  const conflicting = challenger && challenger.status !== leader.status && Math.abs(leader.evidenceWeight - challenger.evidenceWeight) < 0.15;
  if (conflicting) {
    return {
      accepted: null,
      conflict: {
        key: `${leader.teamRole}:${leader.category}:${leader.subject}`,
        reason: "material-source-conflict",
        evidenceIds: ordered.map((item) => item.id),
        statuses: [...new Set(ordered.map((item) => item.status))]
      },
      superseded: ordered
    };
  }
  return { accepted: leader, conflict: null, superseded: ordered.slice(1) };
}

function resolveEvidence(items) {
  const grouped = new Map();
  for (const item of removeSuperseded(items)) {
    const key = `${item.teamRole}:${item.category}:${item.subject.toLowerCase()}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  const accepted = [];
  const conflicts = [];
  const superseded = [];
  for (const group of grouped.values()) {
    const result = resolveGroup(group);
    if (result.accepted) accepted.push(result.accepted);
    if (result.conflict) conflicts.push(result.conflict);
    superseded.push(...result.superseded);
  }
  return { accepted, conflicts, superseded };
}

function categoryCoverage(accepted, conflicts) {
  return REQUIRED_COVERAGE.map((category) => {
    const acceptedItems = accepted.filter((item) => item.category === category);
    const conflictCount = conflicts.filter((item) => item.key.includes(`:${category}:`)).length;
    return {
      category,
      status: conflictCount ? "conflict" : acceptedItems.length ? "available" : "missing",
      acceptedCount: acceptedItems.length,
      conflictCount
    };
  });
}

function applyContext(baselineInput, accepted, configuration = {}) {
  const teamDelta = { home: 0, away: 0 };
  let goalsDelta = 0;
  const contributions = [];

  for (const item of accepted) {
    const weightedImpact = item.impact * item.evidenceWeight;
    if (item.teamRole === "home" || item.teamRole === "away") {
      const cap = TEAM_ELO_CAP[item.category] || 10;
      const eloDelta = clamp(weightedImpact * cap, -cap, cap);
      teamDelta[item.teamRole] += eloDelta;
      contributions.push({
        evidenceId: item.id,
        category: item.category,
        teamRole: item.teamRole,
        eloDelta: round(eloDelta, 2),
        goalEnvironmentDelta: 0,
        boundedBy: `${cap} Elo points`,
        confirmation: item.confirmation,
        sourceId: item.sourceId
      });
    } else {
      const eventGoalDelta = clamp(weightedImpact * 0.18, -0.18, 0.18);
      goalsDelta += eventGoalDelta;
      contributions.push({
        evidenceId: item.id,
        category: item.category,
        teamRole: "event",
        eloDelta: 0,
        goalEnvironmentDelta: round(eventGoalDelta, 3),
        boundedBy: "0.18 goal-environment multiplier per item",
        confirmation: item.confirmation,
        sourceId: item.sourceId
      });
    }
  }

  teamDelta.home = clamp(teamDelta.home, -80, 80);
  teamDelta.away = clamp(teamDelta.away, -80, 80);
  goalsDelta = clamp(goalsDelta, -0.35, 0.35);

  const baseline = buildTransparent1X2(baselineInput, configuration);
  if (!baseline.ok) return { ok: false, baseline };

  const adjustedInput = {
    ...baselineInput,
    homeTeam: { ...baselineInput.homeTeam, rating: Number(baselineInput.homeTeam.rating) + teamDelta.home },
    awayTeam: { ...baselineInput.awayTeam, rating: Number(baselineInput.awayTeam.rating) + teamDelta.away }
  };
  const adjustedConfiguration = {
    ...configuration,
    leagueHomeGoals: (finite(configuration.leagueHomeGoals) ?? 1.45) * (1 + goalsDelta),
    leagueAwayGoals: (finite(configuration.leagueAwayGoals) ?? 1.15) * (1 + goalsDelta)
  };
  const adjusted = buildTransparent1X2(adjustedInput, adjustedConfiguration);
  if (!adjusted.ok) return { ok: false, baseline, adjusted };

  return {
    ok: true,
    baseline,
    adjusted,
    teamRatingDelta: { home: round(teamDelta.home, 2), away: round(teamDelta.away, 2) },
    goalEnvironmentDelta: round(goalsDelta, 3),
    probabilityDelta: Object.fromEntries(["home", "draw", "away"].map((key) => [
      key,
      round(adjusted.probabilities[key] - baseline.probabilities[key])
    ])),
    contributions
  };
}

export function buildContextEngine(input = {}, env = process.env) {
  const generatedAt = iso(input.generatedAt) || new Date().toISOString();
  const kickoffAt = iso(input.kickoffAt);
  const eventId = clean(input.eventId, 180);
  const records = Array.isArray(input.evidence) ? input.evidence.slice(0, 500) : [];
  const baselineInput = input.baselineInput || null;

  if (!eventId) return { ok: false, version: CONTEXT_ENGINE_VERSION, reason: "missing-event-id", paperOnly: true };
  if (!kickoffAt) return { ok: false, version: CONTEXT_ENGINE_VERSION, reason: "missing-kickoff-at", paperOnly: true };
  if (!baselineInput?.homeTeam || !baselineInput?.awayTeam) {
    return { ok: false, version: CONTEXT_ENGINE_VERSION, reason: "missing-baseline-input", paperOnly: true };
  }

  const normalized = records.map((record, index) => normalizeEvidence(record, index, eventId, generatedAt, kickoffAt, env));
  const rejected = normalized.filter((item) => item.errors.length);
  const eligible = normalized.filter((item) => !item.errors.length);
  const resolved = resolveEvidence(eligible);
  const coverage = categoryCoverage(resolved.accepted, resolved.conflicts);
  const context = applyContext(baselineInput, resolved.accepted, input.configuration || {});
  if (!context.ok) {
    return {
      ok: false,
      version: CONTEXT_ENGINE_VERSION,
      reason: "baseline-model-unavailable",
      baselineReason: context.baseline?.reason || context.adjusted?.reason || null,
      paperOnly: true
    };
  }

  const averageWeight = resolved.accepted.length
    ? resolved.accepted.reduce((sum, item) => sum + item.evidenceWeight, 0) / resolved.accepted.length
    : 0;
  const availableCoverage = coverage.filter((item) => item.status === "available").length / coverage.length;
  const conflictPenalty = Math.min(0.35, resolved.conflicts.length * 0.1);
  const evidenceQuality = clamp(0.55 * averageWeight + 0.45 * availableCoverage - conflictPenalty, 0, 0.95);

  return {
    ok: true,
    version: CONTEXT_ENGINE_VERSION,
    generatedAt,
    eventId,
    kickoffAt,
    paperOnly: true,
    decisionAuthority: "context sensitivity only; cannot independently promote PLAY",
    contextStatus: resolved.conflicts.length ? "conflicted" : resolved.accepted.length ? "available" : "missing",
    baselineModelVersion: context.baseline.modelVersion,
    before: {
      probabilities: context.baseline.probabilities,
      expectedGoals: context.baseline.expectedGoals,
      fairOdds: context.baseline.fairOdds
    },
    after: {
      probabilities: context.adjusted.probabilities,
      expectedGoals: context.adjusted.expectedGoals,
      fairOdds: context.adjusted.fairOdds,
      label: "bounded-context-sensitivity-preview"
    },
    probabilityDelta: context.probabilityDelta,
    teamRatingDelta: context.teamRatingDelta,
    goalEnvironmentDelta: context.goalEnvironmentDelta,
    contributions: context.contributions,
    evidence: {
      received: normalized.length,
      accepted: resolved.accepted,
      rejected: rejected.map((item) => ({ id: item.id, errors: item.errors, sourceId: item.sourceId })),
      conflicts: resolved.conflicts,
      superseded: resolved.superseded.map((item) => item.id),
      coverage,
      evidenceQuality: round(evidenceQuality, 4)
    },
    unknowns: coverage.filter((item) => item.status !== "available").map((item) => ({
      category: item.category,
      reason: item.status === "conflict" ? "conflicting-evidence" : "no-eligible-evidence"
    })),
    safety: {
      futureEvidenceUsed: false,
      postKickoffEvidenceUsed: false,
      staleEvidenceUsed: false,
      unconfirmedPresentedAsConfirmed: false,
      automaticPlayPromotion: false,
      bookmakerConnection: false,
      realMoneyExecution: false,
      paperOnly: true
    },
    formulas: [
      "evidence_weight = confirmation_weight × confidence × source_trust × freshness_weight",
      "team_elo_delta = clamp(impact × evidence_weight × category_cap, -category_cap, category_cap)",
      "total_team_elo_delta is capped to ±80 Elo points per team",
      "event goal-environment delta is capped to ±0.35",
      "context preview reruns the same transparent Elo–Poisson baseline with bounded deltas",
      "materially conflicting evidence is withheld instead of averaged"
    ],
    limitations: [
      "Context impact caps are documented conservative defaults and are not yet league-calibrated.",
      "The adjusted output is a sensitivity preview, not independent betting authority.",
      "No context item is accepted without production-publishable source governance and a pre-kickoff timestamp.",
      "Missing context lowers evidence quality and remains visible; it is never silently treated as neutral."
    ]
  };
}
