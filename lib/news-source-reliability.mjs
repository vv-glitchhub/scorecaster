const TYPE_BASE = Object.freeze({
  official_team: 0.98,
  official_league: 0.96,
  official_tournament: 0.96,
  official_data_provider: 0.9,
  verified_journalist: 0.82,
  major_media: 0.8,
  local_media: 0.7,
  media: 0.62,
  betting_media: 0.58,
  social_media: 0.35,
  fan_forum: 0.2,
  unknown: 0.45
});

function clean(value, limit = 180) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function clamp(value, min = 0, max = 1) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : 0));
}

function domainFromUrl(value) {
  try {
    return new URL(String(value || "")).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function configuredDomainScores() {
  try {
    const parsed = JSON.parse(process.env.NEWS_SOURCE_TRUST_JSON || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function ageHours(value, now) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? Math.max(0, (now - timestamp) / 3_600_000) : null;
}

export function scoreNewsSource(article = {}, { now = Date.now(), corroboratingSources = 1 } = {}) {
  const type = clean(article.sourceType || "media", 60).toLowerCase();
  const domain = domainFromUrl(article.url);
  const configured = configuredDomainScores();
  const explicit = Number(article.sourceTrust);
  const base = Number.isFinite(explicit)
    ? clamp(explicit)
    : Number.isFinite(Number(configured[domain]))
      ? clamp(configured[domain])
      : TYPE_BASE[type] ?? TYPE_BASE.unknown;
  const age = ageHours(article.publishedAt || article.updatedAt, now);
  const freshnessAdjustment = age === null ? -0.08 : age <= 6 ? 0.06 : age <= 24 ? 0.03 : age <= 72 ? 0 : -0.08;
  const corroborationAdjustment = corroboratingSources >= 3 ? 0.08 : corroboratingSources >= 2 ? 0.04 : 0;
  const hasPrimaryLink = ["official_team", "official_league", "official_tournament", "official_data_provider"].includes(type);
  const primaryAdjustment = hasPrimaryLink ? 0.04 : 0;
  const score = clamp(base + freshnessAdjustment + corroborationAdjustment + primaryAdjustment);
  const label = score >= 0.85 ? "very-high" : score >= 0.7 ? "high" : score >= 0.5 ? "medium" : score >= 0.3 ? "low" : "very-low";

  const reasons = [
    `Source type ${type} starts at ${(base * 100).toFixed(0)}% trust.`,
    age === null ? "Publication time is missing." : `Article age is ${age.toFixed(1)} hours.`,
    corroboratingSources > 1 ? `${corroboratingSources} independent sources corroborate the topic.` : "No independent corroboration was found.",
    hasPrimaryLink ? "The source is a primary or official source." : "The source is not classified as primary."
  ];

  return {
    source: clean(article.source || domain || "unknown", 120),
    domain: domain || null,
    sourceType: type,
    score: Number(score.toFixed(3)),
    label,
    ageHours: age === null ? null : Number(age.toFixed(2)),
    corroboratingSources,
    reasons,
    usableForDecision: score >= 0.7 && age !== null && age <= 72,
    usableForExplanation: score >= 0.5 && age !== null && age <= 96
  };
}

export function scoreNewsCollection(articles = [], options = {}) {
  const domains = new Set(articles.map((article) => domainFromUrl(article?.url)).filter(Boolean));
  return articles.map((article) => ({
    ...article,
    reliability: scoreNewsSource(article, { ...options, corroboratingSources: domains.size })
  }));
}
