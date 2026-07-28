import ProductionControlCenterClient from "./ProductionControlCenterClient";

export const metadata = {
  title: "Production Control Center | Scorecaster",
  description: "Production readiness, calibration, Daily Top 3, closing-line history and model comparison."
};

export default function ProductionControlCenterPage() {
  return <ProductionControlCenterClient />;
}
