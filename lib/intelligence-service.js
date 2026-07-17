function resolveOrigin(origin) {
  if (origin) return origin;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

function unavailable() {
  return {
    intelligence: {
      news: { ok: false, mode: "unavailable", source: "news-provider", data: [] },
      injuries: { ok: false, mode: "unavailable", source: "injury-provider", data: [] },
      lineup: { ok: false, mode: "unavailable", source: "lineup-provider", data: {} }
    },
    readiness: {
      level: "market-only",
      score: 0,
      verifiedCount: 0,
      totalChecks: 3,
      missing: ["fresh independent match news", "fresh verified injury status", "confirmed starting lineup"],
      fullyVerified: false,
      allowsIndependentPlayEvidence: false
    }
  };
}

export async function loadIntelligenceForMatch({ homeTeam, awayTeam, sport, league, origin }) {
  const baseOrigin = resolveOrigin(origin);
  const url = baseOrigin ? `${baseOrigin}/api/intelligence` : "/api/intelligence";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ homeTeam, awayTeam, sport, league }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) return unavailable();
    const data = await response.json();
    if (data?.ok !== true || !data?.intelligence || !data?.readiness) return unavailable();

    return {
      intelligence: data.intelligence,
      readiness: data.readiness
    };
  } catch {
    return unavailable();
  }
}
