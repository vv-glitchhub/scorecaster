import Link from "next/link";
import ContextEngineClient from "./ContextEngineClient";

export const metadata = {
  title: "Context Engine | Scorecaster",
  description: "Timestamped pre-match lineup, injury, rest, travel, weather and official evidence."
};

export default function ContextPage() {
  return (
    <div className="space-y-6">
      <ContextEngineClient />
      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Context Pipeline</div>
        <h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">Operations and evidence health</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">The health endpoint exposes only safe readiness metadata. Manual evidence import is restricted to the configured Scorecaster operator account.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/context-operations" className="sc-button-secondary">Operator import</Link>
          <Link href="/api/context/health" className="sc-button-ghost">Public health JSON</Link>
          <Link href="/sources" className="sc-button-ghost">Source rights</Link>
        </div>
      </section>
    </div>
  );
}
