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

  return <ReleaseReadinessClient profile={profile} />;
}
