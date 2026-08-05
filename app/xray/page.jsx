import MatchXRayClient from "./MatchXRayClient";

export const metadata = {
  title: "Match X-Ray | Scorecaster",
  description: "Timestamped matchup evidence, expected goals, scoreline scenarios and transparent pre-match risk analysis."
};

export default function MatchXRayPage() {
  return <MatchXRayClient />;
}
