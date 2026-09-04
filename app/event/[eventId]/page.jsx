import Link from "next/link";
import ProfessionalExplanationCard from "../../components/ProfessionalExplanationCard";
import EventContextPanel from "./EventContextPanel";
import EventDataAuditClient from "./EventDataAuditClient";
import EventDetailClient from "./EventDetailClient";
import EventMarketMicrostructurePanel from "./EventMarketMicrostructurePanel";
import EventVerifiedLiveMonitorPanel from "./EventVerifiedLiveMonitorPanel";
import FootballIndependentEvidencePanel from "./FootballIndependentEvidencePanel";
import MatchCenterV4 from "./MatchCenterV4";

export const metadata = {
  title: "Event Detail",
  description: "Verified Match Center, market, Match Journey and Story, independent football evidence, professional explanation, Market Microstructure, Context Engine, Unified Sports Data, AI provenance and paper-only event analysis."
};

export default async function EventDetailPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const eventId = decodeURIComponent(String(resolvedParams?.eventId || ""));
  const sport = String(resolvedSearch?.sport || "");
  const selection = String(resolvedSearch?.selection || "");
  const encodedEvent = encodeURIComponent(eventId);
  const encodedSport = encodeURIComponent(sport);
  const encodedSelection = encodeURIComponent(selection);
  const gamePlanHref = `/match-intelligence?eventId=${encodedEvent}&sport=${encodedSport}${selection ? `&selection=${encodedSelection}` : ""}`;
  const recommendationJourneyHref = `/journey?eventId=${encodedEvent}${selection ? `&selection=${encodedSelection}` : ""}`;

  return (
    <div className="space-y-10">
      <MatchCenterV4 eventId={eventId} sport={sport} selection={selection} />

      <section className="rounded-[1.55rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-5" data-match-journey-story-v2="true">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Match Journey + Story V2</div>
            <div className="mt-1 text-xl font-black text-[var(--sc-text)]">One verified event, three chronological views</div>
            <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">Match Journey explains the current context and evidence. Recommendation Journey shows only stored server-side price/decision history for a watched selection. Match Story remains the post-settlement paper review. None of these views can change probability or upgrade a decision.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={gamePlanHref} className="sc-button-primary" data-match-intelligence-entry="true">Open Match Journey</Link>
            <Link href={recommendationJourneyHref} className="sc-button-secondary">Recommendation Journey</Link>
            <Link href="/tracking" className="sc-button-secondary">Match Story / paper history</Link>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Before / now</div><div className="mt-1 text-sm font-black text-[var(--sc-text)]">Context + evidence + market journey</div></div>
          <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">While watched</div><div className="mt-1 text-sm font-black text-[var(--sc-text)]">Stored Recommendation Journey snapshots</div></div>
          <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">After settlement</div><div className="mt-1 text-sm font-black text-[var(--sc-text)]">Paper Match Story + Outcome Review</div></div>
        </div>
        <div className="mt-3 text-xs font-bold text-[var(--sc-muted)]">paper-only · historical evidence is never reconstructed · decisionUpgradeAllowed=false</div>
      </section>

      <EventDetailClient eventId={eventId} sport={sport} initialSelection={selection} />
      <FootballIndependentEvidencePanel eventId={eventId} sport={sport} selection={selection} />
      <EventVerifiedLiveMonitorPanel eventId={eventId} />
      <ProfessionalExplanationCard eventId={eventId} />
      <EventMarketMicrostructurePanel eventId={eventId} />
      <EventContextPanel eventId={eventId} sport={sport} />
      <EventDataAuditClient eventId={eventId} sport={sport} />
    </div>
  );
}
