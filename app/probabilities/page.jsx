import Link from "next/link";
import ProbabilityLabClient from "./ProbabilityLabClient";

export const metadata = {
  title: "Transparent 1X2 probabilities | Scorecaster",
  description: "Open Elo-Davidson and Poisson pre-match home, draw and away probability calculations."
};

export default function ProbabilitiesPage() {
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Link href="/xray" className="rounded-xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-4 py-2 text-sm font-black text-[var(--sc-text)] hover:border-[var(--sc-brand)]">
          Open Match X-Ray →
        </Link>
      </div>
      <ProbabilityLabClient />
    </div>
  );
}
