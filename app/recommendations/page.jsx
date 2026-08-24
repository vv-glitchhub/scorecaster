import AutoWatchRecommendationsPanel from "../components/AutoWatchRecommendationsPanel";
import RecommendationsClient from "./RecommendationsClient";

export const metadata = {
  title: "Suositukset",
  description: "Scorecasterin paper-only suosituskeskus näyttää mitä live-kohteita kannattaa tutkia ja miksi."
};

export default function RecommendationsPage() {
  return (
    <div className="space-y-6">
      <AutoWatchRecommendationsPanel compact />
      <RecommendationsClient />
    </div>
  );
}
