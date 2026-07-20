import PolymarketIntelligenceClient from "./PolymarketIntelligenceClient";

export const metadata = {
  title: "Polymarket Intelligence · Scorecaster",
  description: "Read-only Polymarket sports market context for Scorecaster paper analysis."
};

export default function PolymarketIntelligencePage() {
  return <PolymarketIntelligenceClient />;
}
