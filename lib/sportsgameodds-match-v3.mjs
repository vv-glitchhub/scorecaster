export const SPORTSGAMEODDS_MIN_TEAM_SIMILARITY = 0.55;
export const SPORTSGAMEODDS_TIME_WINDOW_HOURS = 8;
export const SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE = 0.72;

function clean(value, limit = 160) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function bounded(value, digits = 3) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(Math.max(0, Math.min(1, number)) * factor) / factor;
}

function nonNegative(value, digits = 2) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(Math.max(0, number) * factor) / factor;
}

export function normalizedSportsGameOddsTeam(value) {
  return clean(value, 160)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|hc|bc|club|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamTokens(value) {
  return normalizedSportsGameOddsTeam(value).split(" ").filter((token) => token.length >= 3);
}

export function sportsGameOddsTeamSimilarity(candidate, expected) {
  const left = normalizedSportsGameOddsTeam(candidate);
  const right = normalizedSportsGameOddsTeam(expected);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;
  const leftTokens = new Set(teamTokens(left));
  const rightTokens = new Set(teamTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const overlap = [...rightTokens].filter((token) => leftTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return Math.min(0.85, overlap / Math.max(1, union) + (overlap >= 2 ? 0.2 : 0));
}

function eventTeamName(event, side) {
  const team = event?.teams?.[side] || event?.[`${side}Team`] || event?.[`${side}_team`] || {};
  if (typeof team === "string") return team;
  return clean(team?.names?.long || team?.names?.medium || team?.name || team?.teamName || team?.displayName, 160);
}

function eventStart(event) {
  const value = event?.startsAt || event?.startTime || event?.commenceTime || event?.commence_time;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function scoreEvent(event, match, swapped = false) {
  const providerHome = eventTeamName(event, "home");
  const providerAway = eventTeamName(event, "away");
  const expectedHome = swapped ? match.awayTeam : match.homeTeam;
  const expectedAway = swapped ? match.homeTeam : match.awayTeam;
  const homeScore = sportsGameOddsTeamSimilarity(providerHome, expectedHome);
  const awayScore = sportsGameOddsTeamSimilarity(providerAway, expectedAway);
  const targetStart = Date.parse(match.commenceTime || match.commence_time || "");
  const providerStart = eventStart(event);
  const timeDifferenceHours = Number.isFinite(targetStart) && providerStart !== null
    ? Math.abs(providerStart - targetStart) / 3_600_000
    : null;
  const timeScore = timeDifferenceHours === null
    ? 0.5
    : Math.max(0, 1 - timeDifferenceHours / SPORTSGAMEODDS_TIME_WINDOW_HOURS);
  const confidence = (homeScore + awayScore) / 2 * 0.85 + timeScore * 0.15;
  return { event, swapped, providerHome, providerAway, homeScore, awayScore, timeDifferenceHours, confidence };
}

function bestByConfidence(rows = []) {
  return [...rows].sort((left, right) => right.confidence - left.confidence)[0] || null;
}

function diagnosticCandidate(allCandidates, teamEligible, timeEligible) {
  return bestByConfidence(timeEligible) || bestByConfidence(teamEligible) || bestByConfidence(allCandidates);
}

export function evaluateSportsGameOddsCandidates(events = [], match = {}) {
  const sourceEvents = Array.isArray(events) ? events : [];
  const candidates = [];
  for (const event of sourceEvents) {
    candidates.push(scoreEvent(event, match, false), scoreEvent(event, match, true));
  }

  const teamEligible = candidates.filter((candidate) => (
    candidate.homeScore >= SPORTSGAMEODDS_MIN_TEAM_SIMILARITY
    && candidate.awayScore >= SPORTSGAMEODDS_MIN_TEAM_SIMILARITY
  ));
  const timeEligible = teamEligible.filter((candidate) => (
    candidate.timeDifferenceHours === null
    || candidate.timeDifferenceHours <= SPORTSGAMEODDS_TIME_WINDOW_HOURS
  ));
  const matchResult = bestByConfidence(timeEligible);
  const thresholdEligibleCount = timeEligible.filter((candidate) => (
    candidate.confidence >= SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE
  )).length;
  const diagnostic = diagnosticCandidate(candidates, teamEligible, timeEligible);
  const rejectionReason = !sourceEvents.length
    ? "no_candidates"
    : !teamEligible.length
      ? "team_similarity"
      : !timeEligible.length
        ? "time_window"
        : (matchResult?.confidence ?? 0) < SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE
          ? "confidence_threshold"
          : "matched";

  return {
    matchResult,
    diagnostics: {
      rejectionReason,
      candidateCount: sourceEvents.length,
      orientationCount: candidates.length,
      teamEligibleCount: teamEligible.length,
      timeEligibleCount: timeEligible.length,
      thresholdEligibleCount,
      bestConfidence: bounded(diagnostic?.confidence),
      bestHomeSimilarity: bounded(diagnostic?.homeScore),
      bestAwaySimilarity: bounded(diagnostic?.awayScore),
      bestTimeDifferenceHours: nonNegative(diagnostic?.timeDifferenceHours),
      teamSimilarityThreshold: SPORTSGAMEODDS_MIN_TEAM_SIMILARITY,
      timeWindowHours: SPORTSGAMEODDS_TIME_WINDOW_HOURS,
      matchConfidenceThreshold: SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE
    }
  };
}

export function safeSportsGameOddsMatchDiagnostics(diagnostics = {}) {
  const reason = String(diagnostics.rejectionReason || "unknown");
  return {
    rejectionReason: ["no_candidates", "team_similarity", "time_window", "confidence_threshold", "matched"].includes(reason)
      ? reason
      : "unknown",
    candidateCount: Math.max(0, Math.min(10000, Math.trunc(Number(diagnostics.candidateCount) || 0))),
    orientationCount: Math.max(0, Math.min(20000, Math.trunc(Number(diagnostics.orientationCount) || 0))),
    teamEligibleCount: Math.max(0, Math.min(20000, Math.trunc(Number(diagnostics.teamEligibleCount) || 0))),
    timeEligibleCount: Math.max(0, Math.min(20000, Math.trunc(Number(diagnostics.timeEligibleCount) || 0))),
    thresholdEligibleCount: Math.max(0, Math.min(20000, Math.trunc(Number(diagnostics.thresholdEligibleCount) || 0))),
    bestConfidence: bounded(diagnostics.bestConfidence),
    bestHomeSimilarity: bounded(diagnostics.bestHomeSimilarity),
    bestAwaySimilarity: bounded(diagnostics.bestAwaySimilarity),
    bestTimeDifferenceHours: nonNegative(diagnostics.bestTimeDifferenceHours),
    teamSimilarityThreshold: SPORTSGAMEODDS_MIN_TEAM_SIMILARITY,
    timeWindowHours: SPORTSGAMEODDS_TIME_WINDOW_HOURS,
    matchConfidenceThreshold: SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE
  };
}
