import EventDetailClient from "./EventDetailClient";

export const metadata = {
  title: "Event Detail",
  description: "Verified market, Sports Intelligence and paper-only event analysis."
};

export default async function EventDetailPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  return (
    <EventDetailClient
      eventId={decodeURIComponent(String(resolvedParams?.eventId || ""))}
      sport={String(resolvedSearch?.sport || "")}
      initialSelection={String(resolvedSearch?.selection || "")}
    />
  );
}
