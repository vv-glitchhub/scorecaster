import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasSportsGameOddsKey = Boolean(process.env.SPORTSGAMEODDS_API_KEY);
  const hasTheOddsApiKey = Boolean(process.env.ODDS_API_KEY);

  return NextResponse.json({
    ok: true,
    env: {
      SPORTSGAMEODDS_API_KEY: hasSportsGameOddsKey ? "found" : "missing",
      ODDS_API_KEY: hasTheOddsApiKey ? "found" : "missing",
    },
    testUrls: {
      appOdds: "/api/odds",
      appOddsForce: "/api/odds?force=1",
    },
    message:
      "Tämä endpoint ei näytä avaimia turvallisuussyistä. Se kertoo vain löytyvätkö ne Vercelistä.",
  });
}
