import Link from "next/link";
import DecisionEvidenceClient from "./DecisionEvidenceClient";

export const metadata = {
  title: "Decision Evidence | Scorecaster",
  description: "Auditable evidence contract for Scorecaster event decisions."
};

export default async function DecisionEvidencePage({ searchParams }) {
  const resolved = await searchParams;
  const eventId = String(resolved?.eventId || "").trim();
  const sport = String(resolved?.sport || "").trim();
  const selection = String(resolved?.selection || "").trim();

  if (!eventId || !sport) {
    return (
      <section className="sc-surface rounded-[1.65rem] p-6 sm:p-8">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Decision Evidence V1</div>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--sc-text)]">Choose an event first</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--sc-muted)]">Decision Evidence is event-specific and never fills missing inputs with example data.</p>
        <Link href="/events" className="sc-button-primary mt-5 inline-flex">Open events</Link>
      </section>
    );
  }

  return <DecisionEvidenceClient eventId={eventId} sport={sport} selection={selection} />;
}
