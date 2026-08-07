import ProfessionalSurfaceRail from "../components/ProfessionalSurfaceRail";
import EventsClient from "./EventsClient";

export const metadata = {
  title: "Verified Events",
  description: "Open current Scorecaster events in the verified Event Detail view."
};

export default function EventsPage() {
  return (
    <div className="space-y-6">
      <ProfessionalSurfaceRail surface="events" />
      <EventsClient />
    </div>
  );
}
