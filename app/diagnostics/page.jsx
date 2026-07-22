import DiagnosticsClient from "./DiagnosticsClient";

export const metadata = {
  title: "Decision Diagnostics · Scorecaster",
  description: "Audit PLAY, CAUTION and SKIP decisions, data quality and safety-gate reasons."
};

export default function DiagnosticsPage() {
  return <DiagnosticsClient />;
}
