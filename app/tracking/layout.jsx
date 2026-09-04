import { ProfessionalPortfolioRail } from "../components/ProfessionalSurfaceRail";
import ExternalSlipTrackerConnected from "./ExternalSlipTrackerConnected";

export default function TrackingLayout({ children }) {
  return (
    <div className="space-y-8">
      <ProfessionalPortfolioRail />
      {children}
      <ExternalSlipTrackerConnected />
    </div>
  );
}
