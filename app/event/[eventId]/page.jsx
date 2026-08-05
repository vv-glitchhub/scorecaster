import EventContextPanel from "./EventContextPanel";
import EventDataAuditClient from "./EventDataAuditClient";
import EventDetailClient from "./EventDetailClient";

export const metadata = {
  title: "Event Detail",
  description: "Verified market, Context Engine, Unified Sports Data, AI provenance and paper-only event analysis."
};

export default async function EventDetailPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const eventId = decodeURIComponent(String(resolvedParams?.eventId || ""));
  const sport = String(resolvedSearch?.sport || "");
  return (
    <div className="space-y-10">
      <EventDetailClient
        eventId={eventId}
        sport={sport}
        initialSelection={String(resolvedSearch?.selection || "")}
      />
      <EventContextPanel eventId={eventId} sport={sport} />
      <EventDataAuditClient eventId={eventId} sport={sport} />
    </div>
  );
}
