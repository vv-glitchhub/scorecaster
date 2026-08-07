import Link from "next/link";
import ProbabilityLabClient from "./ProbabilityLabClient";

export const metadata = {
  title: "Transparent 1X2 probabilities | Scorecaster",
  description: "Open Elo-Davidson and Poisson pre-match home, draw and away probability calculations with chronology-safe V2 challenger validation."
};

export default function ProbabilitiesPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-4 py-3 text-sm leading-6 text-[var(--sc-text-secondary)]">
        <strong className="text-[var(--sc-text)]">Transparent 1X2 V2 validation:</strong>{" "}
        the production probability still uses the documented V1 baseline. Dixon-Coles is evaluated only as a chronology-gated offline challenger and cannot change PLAY or stake decisions automatically.
      </section>
      <div className="flex justify-end">
        <Link href="/xray" className="rounded-xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-4 py-2 text-sm font-black text-[var(--sc-text)] hover:border-[var(--sc-brand)]">
          Open Match X-Ray →
        </Link>
      </div>
      <ProbabilityLabClient />
    </div>
  );
}
