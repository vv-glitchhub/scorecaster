import ChampionChallengerClient from "./ChampionChallengerClient";

export const metadata = {
  title: "Champion / Challenger | Scorecaster",
  description: "Chronology-safe shadow-model scorecard against the paired no-vig market benchmark with manual-only promotion."
};

export default function ChampionChallengerPage() {
  return <ChampionChallengerClient />;
}
