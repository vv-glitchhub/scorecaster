import EventsClient from "./EventsClient";

export const metadata = {
  title: "Verified Events",
  description: "Open current Scorecaster events in the verified Event Detail view."
};

export default function EventsPage() {
  return <EventsClient />;
}
