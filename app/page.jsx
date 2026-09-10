import AutoWatchRecommendationsPanel from "./components/AutoWatchRecommendationsPanel";
import ProfessionalSurfaceRail from "./components/ProfessionalSurfaceRail";
import RecommendationAlertCTA from "./components/RecommendationAlertCTA";
import RecommendationSpotlight from "./components/RecommendationSpotlight";
import TodayPageClient from "./components/TodayPageV3";
import DeferredSection from "./components/DeferredSection";

export const metadata = {
  title: "Tänään"
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <TodayPageClient />
      <DeferredSection title={{ fi: "Suositusvertailu ja automaattinen seuranta", en: "Recommendation comparison and automatic watching", es: "Comparación y seguimiento automático" }}>
        <div className="space-y-5">
          <RecommendationSpotlight />
          <AutoWatchRecommendationsPanel compact />
          <RecommendationAlertCTA />
          <ProfessionalSurfaceRail surface="today" />
        </div>
      </DeferredSection>
    </div>
  );
}
