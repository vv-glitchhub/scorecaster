import DiagnosticsV2Client from "./DiagnosticsV2Client";
import DiagnosticsV21Enhancements from "./DiagnosticsV21Enhancements";

export const metadata = {
  title: "Decision Diagnostics V2.1 | Scorecaster",
  description: "Decision trends, root-cause guidance, history, alerts, provider health, paper outcomes, CLV and safe threshold simulation."
};

export default function DiagnosticsV2Page() {
  return <div className="space-y-10"><DiagnosticsV21Enhancements /><DiagnosticsV2Client /></div>;
}
