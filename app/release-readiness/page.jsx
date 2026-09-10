import Link from "next/link";
import manifest from "../../config/release-readiness.json";
import ReleaseReadinessClient from "./ReleaseReadinessClient";

export const metadata = {
  title: "Release Readiness | Scorecaster"
};

export default function ReleaseReadinessPage() {
  const profile = {
    version: manifest.version,
    productionBaseUrl: manifest.productionBaseUrl,
    productBoundary: manifest.productBoundary,
    migrationCount: manifest.supabaseMigrations.length,
    publicPageCount: manifest.publicPages.length,
    protectedProbeCount: manifest.protectedApis.length + manifest.internalWorkers.length,
    mobileLocales: manifest.mobileLocales,
    manualReleaseChecks: manifest.manualReleaseChecks
  };

  return <div className="space-y-5">
    <div className="rounded-2xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-4 text-sm text-[var(--sc-text-secondary)]">
      <strong className="text-[var(--sc-text)]">Acceptance & Validation V1</strong>{" "}
      yhdistää tuotantoterveyden, oikean evidence-kertymän ja model-vs-market holdoutin yhteen näkymään.{" "}
      <Link href="/acceptance-validation" className="font-black text-[var(--sc-brand)] underline">Avaa yhdistetty tarkistus</Link>
    </div>
    <ReleaseReadinessClient profile={profile} />
  </div>;
}
