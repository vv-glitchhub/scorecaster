import RecommendationIntelligenceCenter from "../components/RecommendationIntelligenceCenter";

export const metadata = {
  title: "Opportunity Radar",
  description: "Scorecasterin paper-only Opportunity Radar näyttää nykyiset recommendation-signaalit, portit ja live-ikkunan liigavalmiuden."
};

export default function OpportunityRadarPage() {
  return <RecommendationIntelligenceCenter mode="radar" />;
}
