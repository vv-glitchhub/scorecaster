const SCORE_TIMEOUT_MS = 12_000;
const SCORE_LOOKBACK_DAYS = 3;

function safeWarning(value, fallback) {
  return String(value || fallback)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export async function loadScoreEvents(sport, { fetchImpl = fetch } = {}) {
  const apiKey = String(process.env.ODDS_API_KEY || "");
  if (!apiKey) {
    return { sport, events: [], warning: "Scores provider is not configured", status: 503 };
  }

  const params = new URLSearchParams({
    apiKey,
    daysFrom: String(SCORE_LOOKBACK_DAYS),
    dateFormat: "iso"
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCORE_TIMEOUT_MS);

  try {
    const response = await fetchImpl(
      `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sport)}/scores/?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal
      }
    );

    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }

    if (!response.ok) {
      return {
        sport,
        events: [],
        warning: response.status === 422
          ? "Scores are not available for this sport"
          : safeWarning(payload?.message, "Scores provider request failed"),
        status: response.status
      };
    }

    return {
      sport,
      events: Array.isArray(payload) ? payload : [],
      warning: null,
      status: response.status
    };
  } catch (error) {
    return {
      sport,
      events: [],
      warning: error?.name === "AbortError" ? "Scores provider timed out" : "Scores provider request failed",
      status: 503
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const PAPER_SCORE_LOOKBACK_DAYS = SCORE_LOOKBACK_DAYS;
