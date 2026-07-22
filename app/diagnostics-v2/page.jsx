import DiagnosticsV2Client from "./DiagnosticsV2Client";

export const metadata = {
  title: "Decision Diagnostics V2 | Scorecaster",
  description: "Decision history, alerts, provider health, paper outcomes, CLV and safe threshold simulation."
};

export default function DiagnosticsV2Page() {
  return <DiagnosticsV2Client />;
}