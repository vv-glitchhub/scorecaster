import MarketTimelineClient from "./MarketTimelineClient";

export const metadata = {
  title: "Market Timeline",
  description: "Verified descriptive price history for watched Scorecaster selections."
};

export default function MarketTimelinePage() {
  return <MarketTimelineClient />;
}
