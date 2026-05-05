import BettingWorkspaceClient from "@/app/components/BettingWorkspaceClient";

const demoMatches = [
  {
    id: "1",
    home_team: "Vegas Golden Knights",
    away_team: "Anaheim Ducks",
    bestOdds: {
      home: 1.74,
      draw: null,
      away: 3.7,
    },
  },
  {
    id: "2",
    home_team: "Arsenal",
    away_team: "Chelsea",
    bestOdds: {
      home: 2.1,
      draw: 3.4,
      away: 3.2,
    },
  },
];

export default function Page() {
  return <BettingWorkspaceClient matches={demoMatches} />;
}
