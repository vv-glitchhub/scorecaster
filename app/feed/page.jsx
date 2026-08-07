import ProfessionalSurfaceRail from "../components/ProfessionalSurfaceRail";
import FeedClient from "./FeedClient";

export const metadata = {
  title: "AI Feed",
  description: "Scorecaster AI:n julkaisut, perustelut ja yhteisökeskustelu."
};

export default function FeedPage() {
  return (
    <div className="space-y-6">
      <ProfessionalSurfaceRail surface="feed" />
      <FeedClient />
    </div>
  );
}
