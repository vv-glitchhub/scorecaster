import RecommendationIntelligenceCenter from "../components/RecommendationIntelligenceCenter";

export const metadata = {
  title: "Near PLAY",
  description: "Scorecasterin paper-only näkymä kohteille, joilta puuttuu yksi näkyvä PLAY-portti."
};

export default function NearPlayPage() {
  return <RecommendationIntelligenceCenter mode="near-play" />;
}
