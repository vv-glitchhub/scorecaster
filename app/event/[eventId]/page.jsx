import Link from "next/link";
import ProfessionalExplanationCard from "../../components/ProfessionalExplanationCard";
import EventContextPanel from "./EventContextPanel";
import EventDataAuditClient from "./EventDataAuditClient";
import EventDetailClient from "./EventDetailClient";
import EventMarketMicrostructurePanel from "./EventMarketMicrostructurePanel";
import EventVerifiedLiveMonitorPanel from "./EventVerifiedLiveMonitorPanel";

export const metadata = {
  title: "Event Detail",
  description: "Verified market, live state integrity, professional explanation, Market Microstructure, Context Engine, Unified Sports Data, AI provenance and paper-only event analysis."
};

export default async function EventDetailPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const eventId = decodeURIComponent(String(resolvedParams?.eventId || ""));
  const sport = String(resolvedSearch?.sport || "");
  const gamePlanHref = `/match-intelligence?eventId=${encodeURIComponent(eventId)}&sport=${encodeURIComponent(sport)}`;

  return (
    <div className="space-y-10">
      <section className="rounded-[1.4rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4" data-match-intelligence-entry="true">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Match Intelligence V1</div>
          <div className="mt-1 font-black text-[var(--sc-text)]">Visual match map, evidence gaps and model disagreement</div>
          <p className="mt-1 text-sm text-[var(--sc-muted)]">A simpler visual layer over the same verified event analysis.</p>
        </div>
        <Link href={gamePlanHref} className="sc-button-primary mt-4 inline-flex shrink-0 sm:mt-0">Open Match Intelligence</Link>
      </section>

      <EventDetailClient
        eventId={eventId}
        sport={sport}
        initialSelection={String(resolvedSearch?.selection || "")}
      />
      <EventVerifiedLiveMonitorPanel eventId={eventId} />
      <ProfessionalExplanationCard eventId={eventId} />
      <EventMarketMicrostructurePanel eventId={eventId} />
      <EventContextPanel eventId={eventId} sport={sport} />
      <EventDataAuditClient eventId={eventId} sport={sport} />
    </div>
  );
}
