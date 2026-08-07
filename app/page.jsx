import ProfessionalSurfaceRail from "./components/ProfessionalSurfaceRail";
import TodayPageClient from "./components/TodayPageClient";

export const metadata = {
  title: "Tänään"
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <ProfessionalSurfaceRail surface="today" />
      <TodayPageClient />
    </div>
  );
}
