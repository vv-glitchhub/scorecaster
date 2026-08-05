import RiskLabClient from "./RiskLabClient";

export const metadata = {
  title: "Bankroll Risk Lab | Scorecaster",
  description: "Seeded paper-only Kelly, correlation, drawdown and risk-of-ruin simulation."
};

export default function RiskLabPage() {
  return <RiskLabClient />;
}
