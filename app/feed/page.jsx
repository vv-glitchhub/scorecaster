import FeedClient from "./FeedClient";

export const metadata = {
  title: "AI Feed",
  description: "Scorecaster AI:n julkaisut, perustelut ja yhteisökeskustelu."
};

export default function FeedPage() {
  return <FeedClient />;
}
