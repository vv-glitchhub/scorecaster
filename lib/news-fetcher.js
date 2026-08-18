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

const NEWS_API_MAX_CONCURRENCY = 2;
const NEWS_API_RATE_LIMIT_BACKOFF_MS = 60 * 1000;
const NEWS_API_QUOTA_BACKOFF_MS = 30 * 60 * 1000;
const NEWS_API_AUTH_BACKOFF_MS = 15 * 60 * 1000;
const NEWS_API_TRANSIENT_BACKOFF_MS = 30 * 1000;
const NEWS_API_MAX_BACKOFF_MS = 30 * 60 * 1000;
const GLOBAL_NEWS_API_STATE_KEY = "__scorecasterNewsApiCircuitV1";

function circuitState() {
  if (!globalThis[GLOBAL_NEWS_API_STATE_KEY]) {
    globalThis[GLOBAL_NEWS_API_STATE_KEY] = {
      inFlight: 0,
      waiters: [],
      backoffUntil: 0,
      mode: null,
      status: null,
      errorCode: null
    };
  }
  return globalThis[GLOBAL_NEWS_API_STATE_KEY];
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

function backoffDurationMs(mode, retryAfter = null) {
  if (mode === "quota_exhausted") return NEWS_API_QUOTA_BACKOFF_MS;
  if (mode === "auth_error") return NEWS_API_AUTH_BACKOFF_MS;
  if (mode === "rate_limited") {
    const providerMs = Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : 0;
    return Math.min(NEWS_API_MAX_BACKOFF_MS, Math.max(NEWS_API_RATE_LIMIT_BACKOFF_MS, providerMs));
  }
  return NEWS_API_TRANSIENT_BACKOFF_MS;
}

function activateBackoff({ mode, status = null, errorCode = null, retryAfter = null, now = Date.now() }) {
  const state = circuitState();
  const duration = backoffDurationMs(mode, retryAfter);
  const until = now + duration;
  if (until >= state.backoffUntil) {
    state.backoffUntil = until;
    state.mode = mode;
    state.status = Number.isFinite(Number(status)) ? Number(status) : null;
    state.errorCode = safeNewsApiErrorCode(errorCode);
  }
}

function activeBackoff(now = Date.now()) {
  const state = circuitState();
  if (!state.backoffUntil || state.backoffUntil <= now) {
    if (state.backoffUntil) {
      state.backoffUntil = 0;
      state.mode = null;
      state.status = null;
      state.errorCode = null;
    }
    return null;
  }
  return {
    mode: state.mode || "api_error",
    status: state.status,
    errorCode: state.errorCode,
    retryAfterSeconds: Math.max(1, Math.ceil((state.backoffUntil - now) / 1000))
  };
}

async function acquireSlot() {
  const state = circuitState();
  if (state.inFlight < NEWS_API_MAX_CONCURRENCY) {
    state.inFlight += 1;
    return;
  }
  await new Promise((resolve) => state.waiters.push(resolve));
  state.inFlight += 1;
}

function releaseSlot() {
  const state = circuitState();
  state.inFlight = Math.max(0, state.inFlight - 1);
  const next = state.waiters.shift();
  if (next) next();
}

function backoffResult(backoff, { homeTeam, awayTeam, retrievedAt }) {
  return {
    ok: false,
    source: "newsapi",
    mode: backoff.mode,
    status: backoff.status,
    errorCode: backoff.errorCode,
    retryAfterSeconds: backoff.retryAfterSeconds,
    backoffActive: true,
    networkRequestMade: false,
    query: `${homeTeam} ${awayTeam}`,
    retrievedAt,
    data: []
  };
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
      networkRequestMade: false,
      data: []
    };
  }

  const beforeQueue = activeBackoff();
  if (beforeQueue) return backoffResult(beforeQueue, { homeTeam, awayTeam, retrievedAt });

  await acquireSlot();
  try {
    const afterQueue = activeBackoff();
    if (afterQueue) return backoffResult(afterQueue, { homeTeam, awayTeam, retrievedAt });

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
        const mode = classifyNewsApiFailure(res.status, errorCode);
        const retryAfter = retryAfterSeconds(res);
        activateBackoff({ mode, status: res.status, errorCode, retryAfter });
        return {
          ok: false,
          source: "newsapi",
          mode,
          status: res.status,
          errorCode,
          retryAfterSeconds: retryAfter,
          backoffActive: true,
          networkRequestMade: true,
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
        backoffActive: false,
        networkRequestMade: true,
        data: relevant.slice(0, 10)
      };
    } catch {
      activateBackoff({ mode: "fetch_error" });
      return {
        ok: false,
        source: "newsapi",
        mode: "fetch_error",
        backoffActive: true,
        networkRequestMade: true,
        retrievedAt,
        data: []
      };
    }
  } finally {
    releaseSlot();
  }
}

export function resetNewsApiCircuitForTests() {
  const state = circuitState();
  state.inFlight = 0;
  state.waiters = [];
  state.backoffUntil = 0;
  state.mode = null;
  state.status = null;
  state.errorCode = null;
}

export const NEWS_API_PROVIDER_POLICY = Object.freeze({
  safeErrorCodesOnly: true,
  rawErrorMessageRetained: false,
  credentialRetained: false,
  rawPayloadRetained: false,
  maxConcurrency: NEWS_API_MAX_CONCURRENCY,
  adaptiveBackoff: true,
  rateLimitMinimumBackoffSeconds: NEWS_API_RATE_LIMIT_BACKOFF_MS / 1000,
  quotaBackoffMinutes: NEWS_API_QUOTA_BACKOFF_MS / (60 * 1000),
  authBackoffMinutes: NEWS_API_AUTH_BACKOFF_MS / (60 * 1000),
  probabilityChanged: false,
  decisionChanged: false,
  paperOnly: true
});
