import SourceRegistryClient from "./SourceRegistryClient";

export const metadata = {
  title: "Source registry | Scorecaster",
  description: "Public Scorecaster source licenses, attribution rules, freshness thresholds and redistribution controls."
};

export default function SourcesPage() {
  return <SourceRegistryClient />;
}
