import AlertInboxClient from "./AlertInboxClient";

export const metadata = {
  title: "Alert Inbox",
  description: "User-specific verified Watchlist alert history, preferences and inbox controls."
};

export default function AlertInboxPage() {
  return <AlertInboxClient />;
}
