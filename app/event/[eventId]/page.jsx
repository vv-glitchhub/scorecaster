import EventContextPanel from "./EventContextPanel";
import EventDataAuditClient from "./EventDataAuditClient";
import EventDetailClient from "./EventDetailClient";
import EventMarketMicrostructurePanel from "./EventMarketMicrostructurePanel";

export const metadata = {
  title: "Event Detail",
  description: "Verified market, Market Microstructure, Context Engine, Unified Sports Data, AI provenance and paper-only event analysis."
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
      <EventMarketMicrostructurePanel eventId={eventId} />
      <EventContextPanel eventId={eventId} sport={sport} />
      <EventDataAuditClient eventId={eventId} sport={sport} />
    </div>
  );
}
