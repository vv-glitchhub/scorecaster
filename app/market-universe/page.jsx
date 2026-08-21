import MarketUniverseClient from "./MarketUniverseClient";
import FootballMarketReferencePanel from "./FootballMarketReferencePanel";

export const metadata = {
  title: "Market Universe | Scorecaster",
  description: "Browse and analyze event-specific bookmaker markets beyond 1X2, with transparent football market coverage and provider gaps."
};

export default function MarketUniversePage() {
  return (
    <div className="space-y-7">
      <MarketUniverseClient />
      <FootballMarketReferencePanel />
    </div>
  );
}
