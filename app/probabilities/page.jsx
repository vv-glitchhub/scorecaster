import ProbabilityLabClient from "./ProbabilityLabClient";

export const metadata = {
  title: "Transparent 1X2 probabilities | Scorecaster",
  description: "Open Elo-Davidson and Poisson pre-match home, draw and away probability calculations."
};

export default function ProbabilitiesPage() {
  return <ProbabilityLabClient />;
}
