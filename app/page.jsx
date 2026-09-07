import AutoWatchRecommendationsPanel from "./components/AutoWatchRecommendationsPanel";
import ProfessionalSurfaceRail from "./components/ProfessionalSurfaceRail";
import RecommendationAlertCTA from "./components/RecommendationAlertCTA";
import RecommendationSpotlight from "./components/RecommendationSpotlight";
import TodayPageClient from "./components/TodayPageClient";

export const metadata = {
  title: "Tänään"
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <TodayPageClient />
      <RecommendationSpotlight />
      <AutoWatchRecommendationsPanel compact />
      <RecommendationAlertCTA />
      <ProfessionalSurfaceRail surface="today" />
    </div>
  );
}
