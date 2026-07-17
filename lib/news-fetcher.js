function normalizeNewsItem(item = {}) {
  return {
    title: item.title || item.headline || "Untitled news",
    source: item.source || item.publisher || "unknown",
    sourceType: item.sourceType || "unknown",
    url: item.url || null,
    publishedAt: item.publishedAt || item.date || null,
    sourceTrust: item.sourceTrust ?? 0.5
  };
}

function normalizedTeamWords(team) {
  return String(team || "")
    .toLowerCase()
    .split(/[^a-z0-9À-ÿ]+/i)
    .filter((word) => word.length >= 4);
}

function isRelevantNews(article, homeTeam, awayTeam) {
  const text = `${article.title || ""} ${article.description || ""}`.toLowerCase();
  const homeWords = normalizedTeamWords(homeTeam);
  const awayWords = normalizedTeamWords(awayTeam);
  const homeHit = homeWords.some((word) => text.includes(word));
  const awayHit = awayWords.some((word) => text.includes(word));
  return homeHit && awayHit;
}

function isBlockedUrl(url = "") {
  const blocked = ["consent.yahoo.com", "slashdot.org/firehose"];
  return blocked.some((domain) => String(url).includes(domain));
}

export async function fetchNewsForMatch({ homeTeam, awayTeam, sport, league }) {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return {
      ok: true,
      source: "news-provider",
      mode: "not_configured",
      query: `${homeTeam} ${awayTeam}`,
      data: []
    };
  }

  const rawQuery = `("${homeTeam}" AND "${awayTeam}") OR ("${homeTeam}" AND "${league || sport || ""}") OR ("${awayTeam}" AND "${league || sport || ""}")`;
  const query = encodeURIComponent(rawQuery);
  const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        source: "newsapi",
        mode: "api_error",
        status: res.status,
        data: []
      };
    }

    const articles = Array.isArray(data.articles) ? data.articles : [];
    const relevant = articles
      .filter((article) => isRelevantNews(article, homeTeam, awayTeam))
      .filter((article) => !isBlockedUrl(article.url));

    return {
      ok: true,
      source: "newsapi",
      mode: "live",
      query: rawQuery,
      totalResults: Number(data.totalResults || 0),
      relevantCount: relevant.length,
      data: relevant.slice(0, 10).map((article) => normalizeNewsItem({
        title: article.title,
        source: article.source?.name,
        sourceType: "media",
        url: article.url,
        publishedAt: article.publishedAt,
        sourceTrust: 0.7
      }))
    };
  } catch {
    return {
      ok: false,
      source: "newsapi",
      mode: "fetch_error",
      data: []
    };
  }
}
