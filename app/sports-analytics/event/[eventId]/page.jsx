import SportsAnalyticsEventClient from "./SportsAnalyticsEventClient";

export const metadata = {
  title: "Event Analytics | Scorecaster",
  description: "Event-level provider, metric, participant, trend and data-quality drilldown."
};

export default async function SportsAnalyticsEventPage({ params }) {
  const { eventId } = await params;
  return <SportsAnalyticsEventClient eventId={eventId} />;
}
