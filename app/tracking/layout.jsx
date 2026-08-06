import { ProfessionalPortfolioRail } from "../components/ProfessionalSurfaceRail";

export default function TrackingLayout({ children }) {
  return (
    <div className="space-y-8">
      <ProfessionalPortfolioRail />
      {children}
    </div>
  );
}
