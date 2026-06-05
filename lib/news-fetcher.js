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

function isRelevantNews(article, homeTeam, awayTeam) {
  const text = `${article.title || ""} ${article.description || ""}`.toLowerCase();

  const home = String(homeTeam || "").toLowerCase();
  const away = String(awayTeam || "").toLowerCase();

  const homeWords = home.split(" ").filter(Boolean);
  const awayWords = away.split(" ").filter(Boolean);

  const homeHit = homeWords.some((word) => text.includes(word));
  const awayHit = awayWords.some((word) => text.includes(word));

  return homeHit && awayHit;
}

export async function fetchNewsForMatch({ homeTeam, awayTeam, sport, league }) {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return {
      ok: true,
      source: "placeholder-news-fetcher",
      mode: "no_api_key",
      query: `${homeTeam} ${awayTeam}`,
      data: []
    };
  }

  const rawQuery = `("${homeTeam}" AND "${awayTeam}") OR ("${homeTeam}" AND ${league || sport || ""}) OR ("${awayTeam}" AND ${league || sport || ""})`;

  const query = encodeURIComponent(rawQuery);

  const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;

  try {
    const res = await fetch(url, {
      cache: "no-store"
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        source: "newsapi",
        mode: "api_error",
        error: data?.message || "News API error",
        data: []
      };
    }

    const articles = data.articles || [];

    const relevant = articles.filter((article) =>
      isRelevantNews(article, homeTeam, awayTeam)
    );

    const selected = relevant.length ? relevant : articles.slice(0, 5);

    return {
      ok: true,
      source: "newsapi",
      mode: "live",
      query: rawQuery,
      totalResults: data.totalResults || 0,
      relevantCount: relevant.length,
      data: selected.slice(0, 10).map((article) =>
        normalizeNewsItem({
          title: article.title,
          source: article.source?.name,
          sourceType: "major_media",
          url: article.url,
          publishedAt: article.publishedAt,
          sourceTrust: 0.85
        })
      )
    };
  } catch (error) {
    return {
      ok: false,
      source: "newsapi",
      mode: "fetch_error",
      error: error.message,
      data: []
    };
  }
}
