import { evaluateIndependentIntelligenceSafetyV1 } from "./intelligence-play-safety-v1.mjs";

const HOUR_MS = 60 * 60 * 1000;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clean(value, limit = 180) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function normalizedTeam(value) {
  return clean(value, 120)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|hc|bc|club|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamTokens(value) {
  return normalizedTeam(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function teamMatches(candidate, expected) {
  const left = normalizedTeam(candidate);
  const right = normalizedTeam(expected);
  if (!left || !right) return false;
  if (left === right) return true;

  const leftTokens = new Set(teamTokens(left));
  const rightTokens = teamTokens(right);
  const overlap = rightTokens.filter((token) => leftTokens.has(token));
  return overlap.length >= Math.min(2, rightTokens.length);
}

function parseTimestamp(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function ageHours(value, now) {
  const timestamp = parseTimestamp(value);
  if (timestamp === null) return null;
  return Math.max(0, (now - timestamp) / HOUR_MS);
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function trustFromType(type, fallback = 0.5) {
  const scores = {
    official_team: 0.98,
    official_league: 0.95,
    official_tournament: 0.95,
    official_data_provider: 0.9,
    verified_journalist: 0.78,
    major_media: 0.76,
    local_media: 0.68,
    media: 0.62,
    odds_market: 0.75,
    unknown: 0.45
  };
  return scores[String(type || "unknown").toLowerCase()] ?? fallback;
}

function statusSeverity(status) {
  const value = clean(status, 80).toLowerCase();
  if (["out", "injured", "ruled out"].includes(value)) return 1;
  if (["suspended", "ban", "banned"].includes(value)) return 0.95;
  if (["doubtful", "game-time decision"].includes(value)) return 0.55;
  if (["questionable", "probable"].includes(value)) return 0.3;
  if (["available", "active", "cleared"].includes(value)) return -0.25;
  return 0;
}

function matchSide(team, match) {
  if (teamMatches(team, match.homeTeam)) return "home";
  if (teamMatches(team, match.awayTeam)) return "away";
  return null;
}

function normalizeNews(section, match, now) {
  const rows = Array.isArray(section?.data) ? section.data : [];
  const seen = new Set();
  const items = [];

  for (const row of rows) {
    const title = clean(row?.title || row?.headline, 240);
    const url = safeHttpsUrl(row?.url);
    const publishedAt = parseTimestamp(row?.publishedAt || row?.updatedAt);
    if (!title || !url || publishedAt === null) continue;
    const age = Math.max(0, (now - publishedAt) / HOUR_MS);
    if (age > 96) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    const text = `${title} ${clean(row?.description || row?.summary, 500)}`;
    const mentions = [];
    if (teamTokens(match.homeTeam).some((token) => normalizedTeam(text).includes(token))) mentions.push("home");
    if (teamTokens(match.awayTeam).some((token) => normalizedTeam(text).includes(token))) mentions.push("away");

    items.push({
      title,
      description: clean(row?.description || row?.summary, 500) || null,
      source: clean(row?.source || row?.publisher || "unknown", 120),
      sourceType: clean(row?.sourceType || "media", 60),
      sourceTrust: clamp(trustFromType(row?.sourceType || "media"), 0, 1),
      url,
      publishedAt: new Date(publishedAt).toISOString(),
      ageHours: Number(age.toFixed(2)),
      mentions
    });
  }

  return items.slice(0, 10);
}

function normalizeInjuries(section, match, now) {
  const rows = Array.isArray(section?.data) ? section.data : [];
  const retrievedAt = section?.retrievedAt || section?.generatedAt || null;
  const items = [];

  for (const row of rows) {
    const side = matchSide(row?.team, match);
    if (!side) continue;
    const status = clean(row?.status, 80).toLowerCase();
    const severity = statusSeverity(status);
    if (severity === 0) continue;

    const observedAt = row?.updatedAt || row?.publishedAt || retrievedAt;
    const age = ageHours(observedAt, now);
    if (age === null || age > 120) continue;

    const importance = clamp(finite(row?.importance, 1), 0.25, 3);
    const sourceType = clean(row?.sourceType || "official_data_provider", 60);
    const sourceTrust = clamp(trustFromType(sourceType, 0.75), 0, 1);
    const rawImpact = -severity * importance * 0.012 * sourceTrust;

    items.push({
      name: clean(row?.name || row?.player || "player", 120),
      team: side === "home" ? match.homeTeam : match.awayTeam,
      side,
      status,
      injury: clean(row?.injury || row?.reason, 160) || null,
      importance,
      source: clean(row?.source || section?.source || "provider", 100),
      sourceType,
      sourceTrust,
      observedAt: new Date(parseTimestamp(observedAt)).toISOString(),
      ageHours: Number(age.toFixed(2)),
      impact: Number(clamp(rawImpact, -0.05, 0.015).toFixed(4))
    });
  }

  return items.slice(0, 30);
}

function lineupTeamRows(section, match) {
  const data = section?.data && typeof section.data === "object" ? section.data : {};
  const rows = [];
  if (Array.isArray(data.teams)) rows.push(...data.teams);
  if (data.home && typeof data.home === "object") rows.push({ ...data.home, team: data.home.team || match.homeTeam });
  if (data.away && typeof data.away === "object") rows.push({ ...data.away, team: data.away.team || match.awayTeam });
  if (data.team || data.teamName) rows.push(data);
  return rows;
}

function normalizedStartingPlayers(row = {}) {
  const rows = Array.isArray(row?.startingPlayers)
    ? row.startingPlayers
    : Array.isArray(row?.starters)
      ? row.starters
      : [];
  return rows.slice(0, 20).map((player) => ({
    name: clean(player?.name || player?.playerName, 120),
    position: clean(player?.position, 20) || null,
    confirmed: player?.confirmed !== false,
    importance: clamp(finite(player?.importance, 1), 0.25, 3),
    playerId: player?.playerId ?? player?.PlayerId ?? null
  })).filter((player) => player.name);
}

function normalizeLineups(section, match, now) {
  const rows = lineupTeamRows(section, match);
  const retrievedAt = section?.retrievedAt || section?.generatedAt || null;
  const items = [];

  for (const row of rows) {
    const side = matchSide(row?.team || row?.teamName, match);
    if (!side) continue;
    const observedAt = row?.updatedAt || row?.confirmedAt || retrievedAt;
    const age = ageHours(observedAt, now);
    if (age === null || age > 36) continue;

    const startersConfirmed = Boolean(row?.startersConfirmed || row?.confirmed);
    const goalieConfirmed = Boolean(row?.goalieConfirmed);
    const keyPlayersAvailable = row?.keyPlayersAvailable === true
      ? true
      : row?.keyPlayersAvailable === false
        ? false
        : null;
    const stability = clamp(finite(row?.lineupStability, 0), -1, 1);
    const sourceType = clean(row?.sourceType || "official_data_provider", 60);
    const sourceTrust = clamp(trustFromType(sourceType, 0.75), 0, 1);
    const startingPlayers = normalizedStartingPlayers(row);

    let impact = 0;
    if (startersConfirmed) impact += 0.004;
    if (goalieConfirmed) impact += 0.006;
    if (keyPlayersAvailable === false) impact -= 0.025;
    impact += stability * 0.006;
    impact *= sourceTrust;

    items.push({
      team: side === "home" ? match.homeTeam : match.awayTeam,
      side,
      startersConfirmed,
      goalieConfirmed,
      keyPlayersAvailable,
      lineupStability: stability,
      source: clean(row?.source || section?.source || "provider", 100),
      sourceType,
      sourceTrust,
      observedAt: new Date(parseTimestamp(observedAt)).toISOString(),
      ageHours: Number(age.toFixed(2)),
      startingPlayers,
      impact: Number(clamp(impact, -0.04, 0.02).toFixed(4))
    });
  }

  return items.slice(0, 4);
}

function injuryConflicts(injuries) {
  const groups = new Map();
  for (const item of injuries) {
    const key = `${item.side}:${normalizedTeam(item.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const conflicts = [];
  for (const [key, rows] of groups) {
    const hasUnavailable = rows.some((row) => statusSeverity(row.status) > 0.5);
    const hasAvailable = rows.some((row) => statusSeverity(row.status) < 0);
    if (hasUnavailable && hasAvailable) conflicts.push(`Conflicting availability reports for ${key.split(":").slice(1).join(":")}.`);
  }
  return conflicts;
}

function sideImpact(items, side) {
  return Number(clamp(
    items.filter((item) => item.side === side).reduce((sum, item) => sum + finite(item.impact), 0),
    -0.08,
    0.04
  ).toFixed(4));
}

export function buildSportsIntelligenceReport({ match = {}, intelligence = {}, now = Date.now() } = {}) {
  const safeMatch = {
    homeTeam: clean(match.homeTeam, 120),
    awayTeam: clean(match.awayTeam, 120),
    sport: clean(match.sport, 120),
    league: clean(match.league, 120),
    commenceTime: clean(match.commenceTime, 80) || null,
    eventId: clean(match.eventId, 160) || null
  };

  const news = normalizeNews(intelligence.news, safeMatch, now);
  const injuries = normalizeInjuries(intelligence.injuries, safeMatch, now);
  const lineups = normalizeLineups(intelligence.lineup, safeMatch, now);
  const conflicts = injuryConflicts(injuries);

  const providerLive = {
    news: intelligence.news?.ok === true && intelligence.news?.mode === "live",
    injuries: intelligence.injuries?.ok === true && intelligence.injuries?.mode === "live",
    lineup: intelligence.lineup?.ok === true && intelligence.lineup?.mode === "live"
  };
  const sourceNames = new Set([
    ...news.map((item) => item.source),
    ...injuries.map((item) => item.source),
    ...lineups.map((item) => item.source)
  ].filter(Boolean));
  const teamCoverage = {
    homeInjuries: injuries.some((item) => item.side === "home") || providerLive.injuries,
    awayInjuries: injuries.some((item) => item.side === "away") || providerLive.injuries,
    homeLineup: lineups.some((item) => item.side === "home"),
    awayLineup: lineups.some((item) => item.side === "away")
  };

  const checks = {
    freshNews: news.length > 0,
    injuryStatusChecked: providerLive.injuries,
    teamAttributedInjuries: injuries.every((item) => Boolean(item.side)),
    homeLineupVerified: teamCoverage.homeLineup,
    awayLineupVerified: teamCoverage.awayLineup,
    noConflicts: conflicts.length === 0,
    sourceDiversity: sourceNames.size >= 2
  };
  const verifiedCount = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;
  const score = Number((verifiedCount / totalChecks).toFixed(2));

  const readinessLevel = checks.homeLineupVerified && checks.awayLineupVerified && checks.injuryStatusChecked && checks.noConflicts
    ? "verified"
    : verifiedCount >= 3
      ? "partial"
      : "market-only";

  const impacts = {
    home: Number(clamp(sideImpact(injuries, "home") + sideImpact(lineups, "home"), -0.08, 0.04).toFixed(4)),
    away: Number(clamp(sideImpact(injuries, "away") + sideImpact(lineups, "away"), -0.08, 0.04).toFixed(4))
  };

  const missing = [];
  if (!checks.freshNews) missing.push("fresh independent match news");
  if (!checks.injuryStatusChecked) missing.push("live injury status check");
  if (!checks.homeLineupVerified) missing.push("verified home lineup");
  if (!checks.awayLineupVerified) missing.push("verified away lineup");
  if (!checks.sourceDiversity) missing.push("two independent source families");
  if (!checks.noConflicts) missing.push("resolved evidence conflicts");

  return {
    version: "sports-intelligence-v1",
    generatedAt: new Date(now).toISOString(),
    match: safeMatch,
    readiness: {
      level: readinessLevel,
      score,
      verifiedCount,
      totalChecks,
      checks,
      missing,
      fullyVerified: readinessLevel === "verified",
      allowsIndependentPlayEvidence: readinessLevel === "verified" && conflicts.length === 0
    },
    providerLive,
    sourceCount: sourceNames.size,
    sources: [...sourceNames],
    conflicts,
    impacts,
    news,
    injuries,
    lineups,
    probabilityAdjusted: false,
    marketProbabilityChanged: false
  };
}

function currentProductDecision(pick) {
  if (pick?.productDecision === "PLAY" || pick?.decision === "BET" || pick?.decision === "PLAY") return "PLAY";
  if (pick?.productDecision === "SKIP" || pick?.decision === "PASS" || pick?.decision === "SKIP") return "SKIP";
  return "CAUTION";
}

function selectionSide(pick, report) {
  const selection = pick?.selection || pick?.label;
  if (teamMatches(selection, report?.match?.homeTeam)) return "home";
  if (teamMatches(selection, report?.match?.awayTeam)) return "away";
  return null;
}

export function applySportsIntelligenceGate(pick = {}, report = {}) {
  const initialDecision = currentProductDecision(pick);
  const side = selectionSide(pick, report);
  const opponentSide = side === "home" ? "away" : side === "away" ? "home" : null;
  const selectedImpact = side ? finite(report?.impacts?.[side]) : 0;
  const opponentImpact = opponentSide ? finite(report?.impacts?.[opponentSide]) : 0;
  const relativeImpact = Number(clamp(selectedImpact - opponentImpact, -0.1, 0.1).toFixed(4));
  const intelligenceSafety = evaluateIndependentIntelligenceSafetyV1({ report, relativeImpact });
  const negativeVerifiedEvidence = intelligenceSafety.negativeVerifiedEvidence;
  const criticalConflict = intelligenceSafety.criticalConflict;
  const evidenceVerified = intelligenceSafety.verified;

  let productDecision = initialDecision;
  const reasons = [];
  if (initialDecision === "PLAY" && negativeVerifiedEvidence) {
    productDecision = "CAUTION";
    reasons.push("Verified team-attributed evidence is negative for the selected side.");
  }
  if (initialDecision === "PLAY" && criticalConflict) {
    productDecision = "CAUTION";
    reasons.push("Independent sources contain an unresolved conflict.");
  }

  const sourceTrust = report?.readiness?.level === "verified"
    ? 0.88
    : report?.readiness?.level === "partial"
      ? 0.65
      : 0.5;

  return {
    ...pick,
    agentVersion: "V11-model-lab+sports-intelligence-v1",
    productDecision,
    decision: productDecision === "PLAY" ? "BET" : productDecision === "SKIP" ? "PASS" : "WATCH",
    independentEvidenceVerified: evidenceVerified,
    intelligenceReadiness: report?.readiness || null,
    sportsIntelligence: report,
    intelligenceSelectionSide: side,
    intelligenceRelativeImpact: relativeImpact,
    intelligenceSafety,
    intelligenceUsedForUpgrade: false,
    probabilityAdjustedByIntelligence: false,
    sourceTrust: Math.min(finite(pick.sourceTrust, sourceTrust), sourceTrust),
    evidenceGateReason: reasons.length
      ? reasons.join(" ")
      : evidenceVerified
        ? "Independent evidence is verified; no verified negative signal or unresolved conflict blocked the market decision."
        : "Independent evidence is incomplete; missing evidence is neutral and did not override the market decision."
  };
}
