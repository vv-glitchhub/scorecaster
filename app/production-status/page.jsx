import ProductionStatusClient from "./production-status-client";
import PersonalLaunchStatus from "./PersonalLaunchStatus";

export const metadata = {
  title: "Production Status | Scorecaster"
};

export default function ProductionStatusPage() {
  return (
    <div className="space-y-8">
      <ProductionStatusClient />
      <PersonalLaunchStatus />
    </div>
  );
}
