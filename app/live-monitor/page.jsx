import VerifiedLiveMonitorClient from "./VerifiedLiveMonitorClient";

export const metadata = {
  title: "Verified Live Monitor | Scorecaster",
  description: "Timestamped event-state integrity, provider freshness, corrections, conflicts and informational paper-only alerts."
};

export default function LiveMonitorPage() {
  return <VerifiedLiveMonitorClient />;
}
