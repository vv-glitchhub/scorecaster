import UnifiedDataLayerClient from "./UnifiedDataLayerClient";

export const metadata = {
  title: "Unified Sports Data | Scorecaster",
  description: "Multi-provider odds, team context, weather, market movement, source reliability and grounded AI data provenance."
};

export default function UnifiedDataLayerPage() {
  return <UnifiedDataLayerClient />;
}
