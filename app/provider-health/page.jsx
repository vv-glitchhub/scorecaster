import DiagnosticsV2Client from "../diagnostics-v2/DiagnosticsV2Client";
import DiagnosticsV21Enhancements from "../diagnostics-v2/DiagnosticsV21Enhancements";
import UnifiedDataHistoryClient from "../data-layer/UnifiedDataHistoryClient";

export const metadata = {
  title: "Provider Health V2 | Scorecaster",
  description: "Live provider availability, persistent observations, divergence, freshness, coverage, closing lines and root-cause guidance."
};

export default function ProviderHealthPage() {
  return <div className="space-y-10"><UnifiedDataHistoryClient compact /><DiagnosticsV21Enhancements compact /><DiagnosticsV2Client focus="provider" /></div>;
}