import Link from "next/link";
import MatchIntelligenceClient from "./MatchIntelligenceClient";
import VerifiedMarketJourneyClient from "./VerifiedMarketJourneyClient";

export const metadata = {
  title: "Match Journey | Scorecaster",
  description: "A mobile-first journey from verified match context and evidence to a read-only decision and paper-only review."
};

export default async function MatchIntelligencePage({ searchParams }) {
  const resolved = await searchParams;
  const eventId = String(resolved?.eventId || "").trim();
  const sport = String(resolved?.sport || "").trim();

  if (!eventId || !sport) {
    return (
      <section className="sc-surface rounded-[1.65rem] p-6 sm:p-8">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Match Journey V1</div>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--sc-text)]">Choose an event first</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--sc-muted)]">Match Journey is event-specific and never fills a missing event with example data.</p>
        <Link href="/events" className="sc-button-primary mt-5 inline-flex">Open events</Link>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href={`/decision-evidence?eventId=${encodeURIComponent(eventId)}&sport=${encodeURIComponent(sport)}`}
          className="sc-button-secondary inline-flex"
          data-decision-evidence-link="true"
        >
          Decision Evidence
        </Link>
      </div>
      <MatchIntelligenceClient eventId={eventId} sport={sport} />
      <VerifiedMarketJourneyClient eventId={eventId} sport={sport} />
    </div>
  );
}
