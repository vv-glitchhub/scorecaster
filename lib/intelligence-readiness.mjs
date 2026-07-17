function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function validDate(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function providerState(section) {
  const mode = String(section?.mode || "unknown");
  const ok = section?.ok === true;
  const data = Array.isArray(section?.data) ? section.data : section?.data && typeof section.data === "object" ? section.data : null;
  const count = Array.isArray(data) ? data.length : data ? Object.keys(data).length : 0;
  return { ok, mode, count, source: String(section?.source || "unknown") };
}

function newestTimestamp(items = [], fields = []) {
  return items.reduce((newest, item) => {
    for (const field of fields) {
      const timestamp = validDate(item?.[field]);
      if (timestamp !== null && timestamp > newest) return timestamp;
    }
    return newest;
  }, 0) || null;
}

export function buildIntelligenceReadiness(intelligence = {}, { now = Date.now() } = {}) {
  const news = providerState(intelligence.news);
  const injuries = providerState(intelligence.injuries);
  const lineup = providerState(intelligence.lineup);

  const newsItems = Array.isArray(intelligence.news?.data) ? intelligence.news.data : [];
  const injuryItems = Array.isArray(intelligence.injuries?.data) ? intelligence.injuries.data : [];
  const lineupData = intelligence.lineup?.data && typeof intelligence.lineup.data === "object"
    ? intelligence.lineup.data
    : {};

  const latestNews = newestTimestamp(newsItems, ["publishedAt", "updatedAt"]);
  const latestInjury = newestTimestamp(injuryItems, ["updatedAt", "publishedAt"]);
  const lineupTimestamp = validDate(lineupData.updatedAt || lineupData.confirmedAt || intelligence.lineup?.updatedAt);

  const newsFresh = latestNews !== null && now - latestNews <= 48 * 60 * 60 * 1000;
  const injuryFresh = latestInjury !== null && now - latestInjury <= 72 * 60 * 60 * 1000;
  const lineupConfirmed = Boolean(lineupData.startersConfirmed || lineupData.confirmed || intelligence.lineup?.startersConfirmed);
  const lineupFresh = lineupTimestamp !== null && now - lineupTimestamp <= 24 * 60 * 60 * 1000;

  const checks = {
    liveNews: news.ok && news.mode === "live" && news.count > 0 && newsFresh,
    liveInjuries: injuries.ok && injuries.mode === "live" && injuryFresh,
    confirmedLineup: lineup.ok && lineup.mode === "live" && lineupConfirmed && lineupFresh
  };

  const verifiedCount = Object.values(checks).filter(Boolean).length;
  const score = Number((verifiedCount / 3).toFixed(2));
  const missing = [];

  if (!checks.liveNews) missing.push("fresh independent match news");
  if (!checks.liveInjuries) missing.push("fresh verified injury status");
  if (!checks.confirmedLineup) missing.push("confirmed starting lineup");

  const level = verifiedCount === 3 ? "verified" : verifiedCount >= 1 ? "partial" : "market-only";

  return {
    level,
    score,
    verifiedCount,
    totalChecks: 3,
    checks,
    missing,
    providers: { news, injuries, lineup },
    timestamps: {
      latestNews: latestNews ? new Date(latestNews).toISOString() : null,
      latestInjury: latestInjury ? new Date(latestInjury).toISOString() : null,
      lineup: lineupTimestamp ? new Date(lineupTimestamp).toISOString() : null
    },
    fullyVerified: level === "verified",
    allowsIndependentPlayEvidence: level === "verified"
  };
}

export function applyEvidenceGate(pick = {}, readiness = {}) {
  const currentDecision = pick.productDecision || (pick.decision === "BET" ? "PLAY" : pick.decision === "PASS" ? "SKIP" : "CAUTION");
  const marketOnly = readiness.level !== "verified";
  const nextDecision = currentDecision === "PLAY" && marketOnly ? "CAUTION" : currentDecision;

  return {
    ...pick,
    intelligenceReadiness: readiness,
    independentEvidenceVerified: readiness.level === "verified",
    productDecision: nextDecision,
    decision: nextDecision === "PLAY" ? "BET" : nextDecision === "SKIP" ? "PASS" : "WATCH",
    evidenceGateReason: marketOnly
      ? `Independent evidence is ${readiness.level || "unavailable"}; market consensus alone cannot produce PLAY.`
      : "Fresh news, injury status and starting lineup are verified.",
    sourceTrust: Math.min(finite(pick.sourceTrust, 0.35), readiness.level === "verified" ? 0.95 : readiness.level === "partial" ? 0.7 : 0.55)
  };
}
