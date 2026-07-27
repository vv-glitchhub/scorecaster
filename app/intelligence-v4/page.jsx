import IntelligenceV4Client from "./IntelligenceV4Client";

export const metadata = {
  title: "Intelligence V4 | Scorecaster",
  description: "Digital Twin, model registry, matchup graph, strategy backtests and risk signals."
};

export default function IntelligenceV4Page() {
  return <IntelligenceV4Client />;
}
