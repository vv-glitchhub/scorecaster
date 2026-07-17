const HIGH_TRUST_SOURCES = [
  "reuters",
  "associated press",
  "bbc",
  "nhl.com",
  "nba.com",
  "nfl.com",
  "mlb.com",
  "uefa",
  "premier league",
  "laliga"
];
const ESTABLISHED_SOURCES = ["espn", "sky sports", "the athletic", "cbs sports", "nbc sports"];

function sourceTrust(source = "") {
  const value = String(source).toLowerCase();
  if (HIGH_TRUST_SOURCES.some((name) => value.includes(name))) return 0.9;
  if (ESTABLISHED_SOURCES.some((name) => value.includes(name))) return 0.78;
  return 0.55;
}

function meaningfulTokens(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 4);
}

function teamMentionScore(text, team) {
  const tokens = meaningfulTokens(team);
  if (!tokens.length) return 0;
  const hits = tokens.filter((token) => text.includes(token)).length;
  return hits / tokens.length;
}

function relevance(article, homeTeam, awayTeam) {
  const haystack = `${article.title || ""} ${article.description || ""}`.toLowerCase();
  const homeScore = teamMentionScore(haystack, homeTeam);
  const awayScore = teamMentionScore(haystack, awayTeam);
  return {
    relevant: homeScore >= 0.5 || awayScore >= 0.5,
    scope: homeScore >= 0.5 && awayScore >= 0.5 ? "match" : homeScore >= 0.5 ? "home_team" : awayScore >= 0.5 ? "away_team" : "none",
    score: Math.max(homeScore, awayScore)
  };
}

function isBlockedUrl(url = "") {
  const blocked = ["consent.yahoo.com", "slashdot.org/firehose"];
  return !/^https:\/\//i.test(String(url || "")) || blocked.some((domain) => String(url).includes(domain));
}

function normalizeNewsItem(article, relevanceResult) {
  const source = article.source?.name || "unknown";
  return {
    title: String(article.title || "").slice(0, 220),
    description: String(article.description || "").slice(0, 320),
    source,
    sourceType: sourceTrust(source) >= 0.85 ? "high_trust_media_or_official" : "established_or_unclassified_media",
    url: article.url,
    publishedAt: article.publishedAt || null,
    sourceTrust: sourceTrust(source),
    relevanceScope: relevanceResult.scope,
    relevanceScore: relevanceResult.score
  };
}

export async function fetchNewsForMatch({ homeTeam, awayTeam, sport, league }) {
  const apiKey = process.env.NEWS_API_KEY;
  const retrievedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      ok: true,
      source: "news-provider-not-configured",
      mode: "not_configured",
      query: `${homeTeam} ${awayTeam}`,
      retrievedAt,
      data: []
    };
  }

  const rawQuery = `("${homeTeam}" OR "${awayTeam}") AND (${league || sport || "sports"})`;
  const query = encodeURIComponent(rawQuery);
  const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        source: "newsapi",
        mode: "api_error",
        error: data?.message || "News provider error",
        retrievedAt,
        data: []
      };
    }

    const articles = Array.isArray(data.articles) ? data.articles : [];
    const selected = articles
      .filter((article) => !isBlockedUrl(article.url))
      .map((article) => ({ article, relevanceResult: relevance(article, homeTeam, awayTeam) }))
      .filter((entry) => entry.relevanceResult.relevant)
      .sort((a, b) => b.relevanceResult.score - a.relevanceResult.score)
      .slice(0, 10)
      .map((entry) => normalizeNewsItem(entry.article, entry.relevanceResult));

    return {
      ok: true,
      source: "newsapi",
      mode: "live",
      query: rawQuery,
      totalResults: Number(data.totalResults || 0),
      relevantCount: selected.length,
      retrievedAt,
      data: selected
    };
  } catch (error) {
    return {
      ok: false,
      source: "newsapi",
      mode: "fetch_error",
      error: error instanceof Error ? error.message : "News provider request failed",
      retrievedAt,
      data: []
    };
  }
}
