import Link from "next/link";
import MatchIntelligenceClient from "./MatchIntelligenceClient";

export const metadata = {
  title: "Match Intelligence | Scorecaster",
  description: "Visual event analysis with verified context, model coverage, uncertainty and missing-evidence boundaries."
};

export default async function MatchIntelligencePage({ searchParams }) {
  const resolved = await searchParams;
  const eventId = String(resolved?.eventId || "").trim();
  const sport = String(resolved?.sport || "").trim();

  if (!eventId || !sport) {
    return (
      <section className="sc-surface rounded-[1.65rem] p-6 sm:p-8">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Match Intelligence V1</div>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--sc-text)]">Choose an event first</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--sc-muted)]">Match Intelligence is event-specific and never fills a missing event with example data.</p>
        <Link href="/events" className="sc-button-primary mt-5 inline-flex">Open events</Link>
      </section>
    );
  }

  return <MatchIntelligenceClient eventId={eventId} sport={sport} />;
}
