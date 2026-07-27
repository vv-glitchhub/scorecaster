import SportsAnalyticsClient from "./SportsAnalyticsClient";
import SportsAnalyticsActivationClient from "./SportsAnalyticsActivationClient";

export const metadata = {
  title: "Sports Analytics | Scorecaster",
  description: "Automatic multi-sport observations, provider coverage, trends, comparisons, activation priorities and visual golf distance profiles."
};

export default function SportsAnalyticsPage() {
  return (
    <div className="space-y-12">
      <SportsAnalyticsClient />
      <SportsAnalyticsActivationClient />
    </div>
  );
}
