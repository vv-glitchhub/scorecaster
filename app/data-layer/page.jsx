import UnifiedDataLayerClient from "./UnifiedDataLayerClient";
import UnifiedDataHistoryClient from "./UnifiedDataHistoryClient";

export const metadata = {
  title: "Unified Sports Data V2 | Scorecaster",
  description: "Multi-provider sports data, persistent snapshots, provider quality, closing odds, incidents and grounded AI provenance."
};

export default function UnifiedDataLayerPage() {
  return (
    <div className="space-y-12">
      <UnifiedDataLayerClient />
      <UnifiedDataHistoryClient />
    </div>
  );
}