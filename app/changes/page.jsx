import MarketChangesClient from "./MarketChangesClient";

export const metadata = {
  title: "Market Change Radar | Scorecaster",
  description: "Compare governed Scorecaster decisions, prices and metrics with a locally saved baseline."
};

export default function MarketChangesPage() {
  return <MarketChangesClient />;
}
