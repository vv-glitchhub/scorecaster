import MarketMicrostructureClient from "./MarketMicrostructureClient";

export const metadata = {
  title: "Market Microstructure | Scorecaster",
  description: "Opening, current and closing provider prices with stale-feed, outlier and synchronized-movement evidence."
};

export default async function MarketMicrostructurePage({ searchParams }) {
  const resolved = await searchParams;
  return (
    <MarketMicrostructureClient
      initialEventId={String(resolved?.eventId || "")}
      initialMarket={String(resolved?.market || "h2h")}
      initialSelection={String(resolved?.selection || "")}
    />
  );
}
