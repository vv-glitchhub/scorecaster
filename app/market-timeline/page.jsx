import MarketTimelineClient from "./MarketTimelineClient";

export const metadata = {
  title: "Market Timeline",
  description: "Verified descriptive price history for watched Scorecaster selections."
};

export default async function MarketTimelinePage({ searchParams }) {
  const resolved = await searchParams;
  const initialEventId = String(resolved?.eventId || "").trim();
  return <MarketTimelineClient initialEventId={initialEventId} />;
}
