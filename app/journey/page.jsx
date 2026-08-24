import JourneyClient from "./JourneyClient";

export const metadata = {
  title: "Recommendation Journey",
  description: "Scorecasterin paper-only päätös- ja markkinahistoria seurattaville kohteille."
};

export default function RecommendationJourneyPage() {
  return <JourneyClient />;
}
