import AlertInboxClient from "./AlertInboxClient";

export const metadata = {
  title: "Alert Inbox | Scorecaster",
  description: "User-isolated verified Watchlist alert history, filters and reversible inbox controls."
};

export default function AlertInboxPage() {
  return <AlertInboxClient />;
}
