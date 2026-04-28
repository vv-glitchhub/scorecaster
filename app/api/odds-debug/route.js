import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      reason: "ODDS_API_KEY puuttuu Vercelistä.",
    });
  }

  try {
    const sportsUrl =
      `https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`;

    const sportsResponse = await fetch(sportsUrl, {
      cache: "no-store",
    });

    const sportsText = await sportsResponse.text();

    if (!sportsResponse.ok) {
      return NextResponse.json({
        ok: false,
        step: "sports",
        status: sportsResponse.status,
        response: sportsText,
      });
    }

    const sports = JSON.parse(sportsText);

    const wantedSports = Array.isArray(sports)
      ? sports.filter((sport) =>
          String(sport.key || "").includes("icehockey") ||
          String(sport.group || "").toLowerCase().includes("ice hockey") ||
          String(sport.title || "").toLowerCase().includes("liiga") ||
          String(sport.title || "").toLowerCase().includes("nhl")
        )
      : [];

    const oddsUrl =
      `https://api.the-odds-api.com/v4/sports/icehockey_liiga/odds/` +
      `?apiKey=${apiKey}` +
      `&regions=eu` +
      `&markets=h2h` +
      `&oddsFormat=decimal`;

    const oddsResponse = await fetch(oddsUrl, {
      cache: "no-store",
    });

    const oddsText = await oddsResponse.text();

    return NextResponse.json({
      ok: oddsResponse.ok,
      sportsStatus: sportsResponse.status,
      oddsStatus: oddsResponse.status,
      availableIceHockeySports: wantedSports,
      oddsRaw: oddsText,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      reason: error.message,
    });
  }
}
