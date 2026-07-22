import DiagnosticsV2Client from "../diagnostics-v2/DiagnosticsV2Client";
import DiagnosticsV21Enhancements from "../diagnostics-v2/DiagnosticsV21Enhancements";

export const metadata = {
  title: "Provider Health V1.1 | Scorecaster",
  description: "Live odds provider availability, freshness, coverage, league-level health and root-cause guidance."
};

export default function ProviderHealthPage() {
  return <div className="space-y-10"><DiagnosticsV21Enhancements compact /><DiagnosticsV2Client focus="provider" /></div>;
}
