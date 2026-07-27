import DataCollectorClient from "./DataCollectorClient";

export const metadata = {
  title: "Data Collector | Scorecaster",
  description: "Rights-aware sports data collection, source licensing, health and publishable records."
};

export default function DataCollectorPage() {
  return <DataCollectorClient />;
}
