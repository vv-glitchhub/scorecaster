const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function text(value, max = 240) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function freshness(value, now, maxAgeMs) {
  const parsed = timestamp(value);
  if (parsed === null) return "unknown";
  if (parsed > now + 10 * 60 * 1000) return "invalid";
  return now - parsed <= maxAgeMs ? "fresh" : "stale";
}

function providerStatus(category, result = {}) {
  const data = category === "lineup"
    ? result?.data && typeof result.data === "object" ? result.data : null
    : Array.isArray(result?.data) ? result.data : [];
  const live = result?.ok === true && result?.mode === "live";
  return {
    category,
    provider: text(result?.source || "unavailable", 80),
    mode: text(result?.mode || "unavailable", 40),
    live,
    searched: live,
    count: Array.isArray(data) ? data.length : data ? 1 : 0,
    error: result?.ok === false ? text(result?.error || "Provider request failed", 180) : null,
    retrievedAt: result?.retrievedAt || null
  };
}

function newsEvidence(result, now) {
  if (result?.ok !== true || result?.mode !== "live" || !Array.isArray(result.data)) return [];
  return result.data
    .filter((item) => text(item?.title) && text(item?.source))
    .map((item) => ({
      category: "news",
      subject: text(item.title, 220),
      status: "reported",
      detail: text(item.description || item.title, 320),
      source: text(item.source, 100),
      sourceType: text(item.sourceType || "media", 60),
      url: /^https:\/\//i.test(String(item.url || "")) ? String(item.url).slice(0, 500) : null,
      observedAt: item.publishedAt || null,
      freshness: freshness(item.publishedAt, now, 14 * DAY_MS),
      trust: clamp(item.sourceTrust ?? 0.5, 0, 1),
      verified: true
    }))
    .filter((item) => item.freshness !== "invalid")
    .slice(0, 6);
}

function injuryEvidence(result, now) {
  if (result?.ok !== true || result?.mode !== "live" || !Array.isArray(result.data)) return [];
  return result.data
    .filter((item) => text(item?.name) && text(item?.team) && text(item?.status))
    .map((item) => ({
      category: "injury",
      subject: text(item.name, 120),
      status: text(item.status, 80),
      detail: text(item.injury || "No injury detail supplied", 220),
      team: text(item.team, 120),
      source: text(item.source || result.source, 100),
      sourceType: text(item.sourceType || "official_data_provider", 60),
      observedAt: item.updatedAt || null,
      freshness: freshness(item.updatedAt, now, 7 * DAY_MS),
      trust: clamp(item.sourceTrust ?? 0.8, 0, 1),
      importance: clamp(item.importance ?? 0, 0, 5),
      verified: true
    }))
    .filter((item) => item.freshness !== "invalid")
    .slice(0, 12);
}

function lineupEvidence(result, now) {
  const item = result?.data;
  if (result?.ok !== true || result?.mode !== "live" || !item || typeof item !== "object") return [];
  const observedAt = item.updatedAt || result.retrievedAt || null;
  const source = text(item.source || result.source, 100);
  const trust = clamp(item.sourceTrust ?? 0.8, 0, 1);
  const evidence = [];

  if (item.startersConfirmed === true || item.startersConfirmed === false) {
    evidence.push({
      category: "lineup",
      subject: "Starting lineup",
      status: item.startersConfirmed ? "confirmed" : "not_confirmed",
      detail: item.startersConfirmed ? "The provider marks the starting lineup as confirmed." : "The provider does not mark the starting lineup as confirmed.",
      source,
      sourceType: text(item.sourceType || "official_data_provider", 60),
      observedAt,
      freshness: freshness(observedAt, now, DAY_MS),
      trust,
      verified: true
    });
  }

  if (item.goalieConfirmed === true || item.goalieConfirmed === false) {
    evidence.push({
      category: "lineup",
      subject: "Starting goalie",
      status: item.goalieConfirmed ? "confirmed" : "not_confirmed",
      detail: item.goalieConfirmed ? "The provider marks the starting goalie as confirmed." : "The provider does not mark the starting goalie as confirmed.",
      source,
      sourceType: text(item.sourceType || "official_data_provider", 60),
      observedAt,
      freshness: freshness(observedAt, now, DAY_MS),
      trust,
      verified: true
    });
  }

  if (item.keyPlayersAvailable === true || item.keyPlayersAvailable === false) {
    evidence.push({
      category: "lineup",
      subject: "Key-player availability",
      status: item.keyPlayersAvailable ? "available" : "availability_concern",
      detail: item.keyPlayersAvailable ? "The provider reports no key-player availability concern." : "The provider reports a key-player availability concern.",
      source,
      sourceType: text(item.sourceType || "official_data_provider", 60),
      observedAt,
      freshness: freshness(observedAt, now, DAY_MS),
      trust,
      verified: true
    });
  }

  return evidence.filter((entry) => entry.freshness !== "invalid").slice(0, 4);
}

function externalMarketEvidence(result, now) {
  if (result?.ok !== true || result?.mode !== "live" || !Array.isArray(result.data)) return [];
  return result.data
    .filter((item) => text(item?.title) && Number(item?.probability) > 0 && Number(item?.probability) < 1)
    .map((item) => ({
      category: "external_market",
      subject: text(item.title, 220),
      status: "observed",
      detail: `Observed external-market probability ${(Number(item.probability) * 100).toFixed(1)}%.`,
      source: text(result.source || "external market", 100),
      sourceType: "external_market",
      url: /^https:\/\//i.test(String(item.url || "")) ? String(item.url).slice(0, 500) : null,
      observedAt: result.retrievedAt || null,
      freshness: freshness(result.retrievedAt, now, DAY_MS),
      trust: 0.45,
      verified: true,
      decisionInput: false
    }))
    .filter((item) => item.freshness !== "invalid")
    .slice(0, 3);
}

function hoursToKickoff(value, now) {
  const parsed = timestamp(value);
  return parsed === null ? null : (parsed - now) / (60 * 60 * 1000);
}

export function buildVerifiedSportsIntelligence({
  news = {},
  injuries = {},
  lineup = {},
  externalMarkets = {},
  commenceTime = null,
  now = Date.now()
} = {}) {
  const sources = [
    providerStatus("news", news),
    providerStatus("injuries", injuries),
    providerStatus("lineup", lineup),
    providerStatus("external_market", externalMarkets)
  ];
  const evidence = [
    ...newsEvidence(news, now),
    ...injuryEvidence(injuries, now),
    ...lineupEvidence(lineup, now),
    ...externalMarketEvidence(externalMarkets, now)
  ];
  const sourceByCategory = Object.fromEntries(sources.map((item) => [item.category, item]));
  const lineupItems = evidence.filter((item) => item.category === "lineup");
  const injuryItems = evidence.filter((item) => item.category === "injury");
  const newsItems = evidence.filter((item) => item.category === "news");
  const kickoffHours = hoursToKickoff(commenceTime, now);
  const missing = [];

  if (!sourceByCategory.news.live) missing.push("verified independent news search");
  else if (!newsItems.length) missing.push("relevant recent news item");
  if (!sourceByCategory.injuries.live) missing.push("verified injury feed");
  if (!sourceByCategory.lineup.live) missing.push("verified lineup feed");
  else if (!lineupItems.some((item) => item.subject === "Starting lineup" && item.status === "confirmed")) missing.push("confirmed starting lineup");

  const coverageScore = clamp(
    (sourceByCategory.news.live ? 0.15 : 0) +
    (sourceByCategory.injuries.live ? 0.35 : 0) +
    (sourceByCategory.lineup.live ? 0.4 : 0) +
    (sourceByCategory.external_market.live ? 0.1 : 0),
    0,
    1
  );
  const staleEvidence = evidence.filter((item) => item.freshness === "stale");
  const availabilityConcern = lineupItems.some((item) => item.status === "availability_concern");
  const playGateReasons = [];

  if (availabilityConcern) playGateReasons.push("verified key-player availability concern");
  if (kickoffHours !== null && kickoffHours >= 0 && kickoffHours <= 6) {
    const lineupConfirmed = lineupItems.some((item) => item.subject === "Starting lineup" && item.status === "confirmed" && item.freshness === "fresh");
    if (!lineupConfirmed) playGateReasons.push("starting lineup is not freshly confirmed close to kickoff");
  }
  if (kickoffHours !== null && kickoffHours >= 0 && kickoffHours <= 12 && !sourceByCategory.injuries.live) {
    playGateReasons.push("verified injury feed is unavailable close to kickoff");
  }
  if (staleEvidence.some((item) => item.category === "lineup" || item.category === "injury")) {
    playGateReasons.push("critical lineup or injury evidence is stale");
  }

  const readiness = coverageScore >= 0.75 && playGateReasons.length === 0
    ? "high"
    : coverageScore >= 0.35
      ? "medium"
      : "low";
  const status = sources.some((item) => item.live)
    ? sources.every((item) => item.live || item.category === "external_market") ? "verified" : "partial"
    : "unavailable";

  return {
    version: "real-sports-intelligence-v1",
    generatedAt: new Date(now).toISOString(),
    status,
    readiness,
    coverageScore,
    kickoffHours,
    sources,
    evidence,
    missing,
    counts: {
      news: newsItems.length,
      injuries: injuryItems.length,
      lineup: lineupItems.length,
      externalMarkets: evidence.filter((item) => item.category === "external_market").length
    },
    playGate: {
      blocked: playGateReasons.length > 0,
      reasons: playGateReasons
    },
    probabilityAdjusted: false,
    edgeAdjusted: false,
    evAdjusted: false,
    externalMarketUsedForDecision: false
  };
}

export function attachVerifiedSportsIntelligence(pick = {}, report) {
  const safeReport = report || buildVerifiedSportsIntelligence({ commenceTime: pick.commenceTime });
  const newsItems = safeReport.evidence.filter((item) => item.category === "news");
  const injuries = safeReport.evidence.filter((item) => item.category === "injury");
  const lineupEvidence = safeReport.evidence.filter((item) => item.category === "lineup");
  const lineup = {
    startersConfirmed: lineupEvidence.some((item) => item.subject === "Starting lineup" && item.status === "confirmed"),
    goalieConfirmed: lineupEvidence.some((item) => item.subject === "Starting goalie" && item.status === "confirmed"),
    keyPlayersAvailable: lineupEvidence.some((item) => item.subject === "Key-player availability")
      ? !lineupEvidence.some((item) => item.status === "availability_concern")
      : null,
    sourceVerified: safeReport.sources.find((item) => item.category === "lineup")?.live === true
  };

  return {
    ...pick,
    newsItems,
    injuries,
    lineup,
    verifiedIntelligence: safeReport,
    contextCoverage: safeReport.coverageScore,
    contextReadiness: safeReport.readiness,
    contextBlockers: safeReport.playGate.reasons,
    probabilityAdjustedByContext: false,
    modelProbability: pick.modelProbability,
    consensusProbability: pick.consensusProbability,
    edge: pick.edge,
    ev: pick.ev
  };
}

export function buildUnevaluatedSportsIntelligence(commenceTime = null, now = Date.now()) {
  return {
    version: "real-sports-intelligence-v1",
    generatedAt: new Date(now).toISOString(),
    status: "not_evaluated",
    readiness: "low",
    coverageScore: 0,
    kickoffHours: hoursToKickoff(commenceTime, now),
    sources: [],
    evidence: [],
    missing: ["verified news, injury and lineup evaluation"],
    counts: { news: 0, injuries: 0, lineup: 0, externalMarkets: 0 },
    playGate: { blocked: false, reasons: [] },
    probabilityAdjusted: false,
    edgeAdjusted: false,
    evAdjusted: false,
    externalMarketUsedForDecision: false
  };
}
