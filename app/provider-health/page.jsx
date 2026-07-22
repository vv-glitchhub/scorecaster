import DiagnosticsV2Client from "../diagnostics-v2/DiagnosticsV2Client";

export const metadata = {
  title: "Provider Health | Scorecaster",
  description: "Live odds provider availability, freshness, coverage and league-level health."
};

export default function ProviderHealthPage() {
  return <DiagnosticsV2Client focus="provider" />;
}