import DailyBriefClient from "./DailyBriefClient";
import RecommendationDailyBriefV2 from "./RecommendationDailyBriefV2";

export const metadata = {
  title: "Daily Brief | Scorecaster",
  description: "A concise daily view of Scorecaster recommendations, Near PLAY, Auto-Watch, alerts, risk and paper-portfolio discipline."
};

export default function DailyBriefPage() {
  return (
    <div className="space-y-7">
      <RecommendationDailyBriefV2 />
      <DailyBriefClient />
    </div>
  );
}
