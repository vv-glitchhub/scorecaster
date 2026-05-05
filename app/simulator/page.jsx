import { cookies } from "next/headers";
import MatchSimulatorPanel from "@/app/components/MatchSimulatorPanel";
import { normalizeLang } from "@/lib/i18n";

const demoMatches = [
  {
    id: "sim-demo-1",
    sport_key: "icehockey_nhl",
    sport_title: "NHL",
    commence_time: new Date().toISOString(),
    home_team: "Florida Panthers",
    away_team: "Tampa Bay Lightning",
    bestOdds: {
      home: 2.05,
      draw: null,
      away: 1.82,
    },
  },
  {
    id: "sim-demo-2",
    sport_key: "soccer_epl",
    sport_title: "Premier League",
    commence_time: new Date().toISOString(),
    home_team: "Arsenal",
    away_team: "Chelsea",
    bestOdds: {
      home: 2.1,
      draw: 3.4,
      away: 3.25,
    },
  },
  {
    id: "sim-demo-3",
    sport_key: "basketball_nba",
    sport_title: "NBA",
    commence_time: new Date().toISOString(),
    home_team: "Boston Celtics",
    away_team: "Milwaukee Bucks",
    bestOdds: {
      home: 1.72,
      draw: null,
      away: 2.15,
    },
  },
  {
    id: "sim-demo-4",
    sport_key: "football_nfl",
    sport_title: "NFL",
    commence_time: new Date().toISOString(),
    home_team: "Kansas City Chiefs",
    away_team: "Buffalo Bills",
    bestOdds: {
      home: 1.9,
      draw: null,
      away: 1.95,
    },
  },
];

export default async function SimulatorPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "fi");

  return <MatchSimulatorPanel matches={demoMatches} lang={lang} />;
}
