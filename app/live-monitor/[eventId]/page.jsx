import VerifiedLiveEventClient from "./VerifiedLiveEventClient";

export const metadata = {
  title: "Live Event Audit | Scorecaster",
  description: "Verified provider state, freshness, corrections, conflicts and paper-only live alerts for one event."
};

export default async function LiveEventAuditPage({ params }) {
  const resolved = await params;
  const eventId = decodeURIComponent(String(resolved?.eventId || ""));
  return <VerifiedLiveEventClient eventId={eventId} />;
}
