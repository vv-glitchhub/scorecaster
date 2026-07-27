import DataCollectorClient from "./DataCollectorClient";

export const metadata = {
  title: "Data Collector V2 | Scorecaster",
  description: "Rights-aware sports data collection with source quality scores, incidents, coverage, event drilldowns and CSV export."
};

export default function DataCollectorPage() {
  return <DataCollectorClient />;
}
