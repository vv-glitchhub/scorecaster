import MarketUniverseClient from "./MarketUniverseClient";

export const metadata = {
  title: "Market Universe | Scorecaster",
  description: "Browse and analyze event-specific bookmaker markets beyond 1X2: team goals, BTTS, props, corners, cards and more."
};

export default function MarketUniversePage() {
  return <MarketUniverseClient />;
}
