import CompareRecommendationsClient from "../CompareRecommendationsClient";

export const metadata = {
  title: "Vertaa suosituksia",
  description: "Vertaa Scorecasterin paper-only suosituksia samalla tuotantodatalla ja näkyvillä PLAY-porteilla."
};

export default function RecommendationComparePage() {
  return <CompareRecommendationsClient />;
}
