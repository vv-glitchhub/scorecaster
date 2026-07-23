import UnifiedDataLayerClient from "./UnifiedDataLayerClient";
import UnifiedDataHistoryClient from "./UnifiedDataHistoryClient";
import UnifiedCalibrationClient from "./UnifiedCalibrationClient";

export const metadata = {
  title: "Unified Sports Data V2 | Scorecaster",
  description: "Multi-provider sports data, persistent snapshots, provider quality, closing odds, incidents and chronology-safe calibration."
};

export default function UnifiedDataLayerPage() {
  return (
    <div className="space-y-12">
      <UnifiedDataLayerClient />
      <UnifiedDataHistoryClient />
      <UnifiedCalibrationClient />
    </div>
  );
}