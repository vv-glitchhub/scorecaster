import { Suspense } from "react";
import TransparencyClient from "./TransparencyClient";

export const metadata = {
  title: "Open methodology | Scorecaster",
  description: "Public Scorecaster formulas, decision gates, normalized inputs and source attribution."
};

function TransparencyLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-72 animate-pulse rounded-[2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]" />
      <div className="h-96 animate-pulse rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]" />
    </div>
  );
}

export default function TransparencyPage() {
  return (
    <Suspense fallback={<TransparencyLoading />}>
      <TransparencyClient />
    </Suspense>
  );
}
