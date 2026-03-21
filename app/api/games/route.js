import { NextResponse } from "next/server";

const mockGames = {
  jalkapallo: [
    { home: "HJK", away: "KuPS", league: "Veikkausliiga", time: "18:00", context: "Mock data" },
    { home: "Liverpool", away: "Arsenal", league: "Premier League", time: "19:30", context: "Mock data" }
  ],
  jaakiekko: [
    { home: "Tappara", away: "Ilves", league: "Liiga", time: "18:30", context: "Mock data" },
    { home: "Nashville", away: "Dallas", league: "NHL", time: "02:00", context: "Mock data" }
  ],
  koripallo: [
    { home: "Bulls", away: "Celtics", league: "NBA", time: "03:00", context: "Mock data" },
    { home: "Kataja", away: "Kouvot", league: "Korisliiga", time: "18:30", context: "Mock data" }
  ]
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport") || "jalkapallo";
  return NextResponse.json({ games: mockGames[sport] || [] });
}
