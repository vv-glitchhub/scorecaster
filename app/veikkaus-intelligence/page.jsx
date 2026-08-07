import VeikkausIntelligenceClient from "./VeikkausIntelligenceClient";

export const metadata = {
  title: "Veikkaus Intelligence | Scorecaster",
  description: "Paper-only fixed-odds and pool-game analysis for manual Veikkaus snapshots.",
};

export default function VeikkausIntelligencePage() {
  return <VeikkausIntelligenceClient />;
}
