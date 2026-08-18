const NEWS_API_SAFE_ERROR_CODES = new Set([
  "apiKeyDisabled",
  "apiKeyExhausted",
  "apiKeyInvalid",
  "apiKeyMissing",
  "parameterInvalid",
  "parametersMissing",
  "rateLimited",
  "sourcesTooMany",
  "sourceDoesNotExist",
  "unexpectedError"
]);

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

function normalizeNewsItem(item = {}) {
  const url = safeHttpsUrl(item.url);
  if (!url) return null;
  return {
    title: String(item.title || item.headline || "").trim().slice(0, 240),
    description: String(item.description || item.summary || "").trim().slice(0, 500) || null,
    source: String(item.source || item.publisher || "unknown").trim().slice(0, 120),
    sourceType: "media",
    url,
    publishedAt: item.publishedAt || item.date || null,
    sourceTrust: 0.62
  };
}

function normalizedTeamWords(team) {
  return String(team || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length >= 4 && !["club", "football", "hockey", "basketball"].includes(word));
}

function isRelevantNews(article, homeTeam, awayTeam) {
  const text = `${article.title || ""} ${article.description || ""}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

function safeNewsApiErrorCode(value) {
  const code = String(value || "").trim();
  return NEWS_API_SAFE_ERROR_CODES.has(code) ? code : null;
}

function classifyNewsApiFailure(status, errorCode) {
  if (errorCode === "apiKeyExhausted") return "quota_exhausted";
  if (errorCode === "rateLimited" || Number(status) === 429) return "rate_limited";
  if (["apiKeyDisabled", "apiKeyInvalid", "apiKeyMissing"].includes(errorCode) || Number(status) === 401) {
    return "auth_error";
  }
  return "api_error";
}

function retryAfterSeconds(response) {
  const value = response?.headers?.get?.("retry-after");
  if (!value || !/^\d+$/.test(value.trim())) return null;
  return Math.max(0, Math.min(86_400, Number.parseInt(value, 10)));
}

export async function fetchNewsForMatch({ homeTeam, awayTeam, sport, league }) {
  const apiKey = process.env.NEWS_API_KEY;
  const retrievedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      ok: true,
      source: "news-provider",
      mode: "not_configured",
      query: `${homeTeam} ${awayTeam}`,
      retrievedAt,
      data: []
    };
  }

  const rawQuery = `("${homeTeam}" AND "${awayTeam}") OR ("${homeTeam}" AND "${league || sport || ""}") OR ("${awayTeam}" AND "${league || sport || ""}")`;
  const query = encodeURIComponent(rawQuery);
  const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=20`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey
      }
    });
    const data = await res.json();

    if (!res.ok) {
      const errorCode = safeNewsApiErrorCode(data?.code);
      return {
        ok: false,
        source: "newsapi",
        mode: classifyNewsApiFailure(res.status, errorCode),
        status: res.status,
        errorCode,
        retryAfterSeconds: retryAfterSeconds(res),
        retrievedAt,
        data: []
      };
    }

    const articles = Array.isArray(data.articles) ? data.articles : [];
    const seen = new Set();
    const relevant = [];

    for (const article of articles) {
      if (!isRelevantNews(article, homeTeam, awayTeam)) continue;
      if (isBlockedUrl(article.url)) continue;
      const normalized = normalizeNewsItem({
        title: article.title,
        description: article.description,
        source: article.source?.name,
        url: article.url,
        publishedAt: article.publishedAt
      });
      if (!normalized?.title || !normalized.url || seen.has(normalized.url)) continue;
      seen.add(normalized.url);
      relevant.push(normalized);
    }

    return {
      ok: true,
      source: "newsapi",
      mode: "live",
      query: rawQuery,
      retrievedAt,
      totalResults: Number(data.totalResults || 0),
      relevantCount: relevant.length,
      data: relevant.slice(0, 10)
    };
  } catch {
    return {
      ok: false,
      source: "newsapi",
      mode: "fetch_error",
      retrievedAt,
      data: []
    };
  }
}

export const NEWS_API_PROVIDER_POLICY = Object.freeze({
  safeErrorCodesOnly: true,
  rawErrorMessageRetained: false,
  credentialRetained: false,
  rawPayloadRetained: false,
  paperOnly: true
});
