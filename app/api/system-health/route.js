const ROUTES_TO_CHECK = [
  "/api/sports",
  "/api/top-picks?view=summary",
  "/api/portfolio",
  "/api/daily-picks",
  "/api/live-betting",
  "/api/historical-odds",
  "/api/sportsdata-test",
  "/api/news-test"
];

export async function GET(request) {
  const url = new URL(request.url);
  const checks = [];

  for (const path of ROUTES_TO_CHECK) {
    const startedAt = Date.now();

    try {
      const response = await fetch(`${url.origin}${path}`, {
        cache: "no-store"
      });

      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      checks.push({
        path,
        ok: response.ok && body?.ok !== false,
        status: response.status,
        source: body?.source || null,
        agentVersion: body?.agentVersion || null,
        count: body?.count || body?.summary?.totalPicks || body?.portfolio?.count || null,
        durationMs: Date.now() - startedAt,
        error: body?.error || null
      });
    } catch (error) {
      checks.push({
        path,
        ok: false,
        status: 0,
        durationMs: Date.now() - startedAt,
        error: error.message
      });
    }
  }

  const failed = checks.filter((item) => !item.ok);

  return Response.json({
    ok: failed.length === 0,
    source: "scorecaster-system-health",
    checkedAt: new Date().toISOString(),
    summary: {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length
    },
    checks
  });
}
