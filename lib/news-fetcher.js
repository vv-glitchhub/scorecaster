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

  const query = encodeURIComponent(
    `"${homeTeam}" OR "${awayTeam}" ${sport || ""} ${league || ""}`
  );

  const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`;

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

    return {
      ok: true,
      source: "newsapi",
      mode: "live",
      query,
      data: (data.articles || []).map((article) =>
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
