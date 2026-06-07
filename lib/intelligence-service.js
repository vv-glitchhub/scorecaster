function resolveOrigin(origin) {
  if (origin) return origin;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

export async function loadIntelligenceForMatch({
  homeTeam,
  awayTeam,
  sport,
  league,
  origin
}) {
  const baseOrigin = resolveOrigin(origin);
  const url = baseOrigin ? `${baseOrigin}/api/intelligence` : "/api/intelligence";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      homeTeam,
      awayTeam,
      sport,
      league
    })
  });

  const data = await response.json();

  return (
    data.intelligence || {
      news: [],
      injuries: [],
      lineup: {},
      polymarket: null
    }
  );
}
