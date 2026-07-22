import WatchlistCandidates from "./WatchlistCandidates";
import WatchlistClient from "./WatchlistClient";

export const metadata = {
  title: "Watchlist & Alerts"
};

export default function WatchlistPage() {
  return (
    <div className="space-y-7">
      <WatchlistClient />
      <WatchlistCandidates />
    </div>
  );
}
