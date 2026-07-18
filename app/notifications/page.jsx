import NotificationCenterClient from "./NotificationCenterClient";

export const metadata = {
  title: "Notification Center",
  description: "User-specific in-app notifications generated from verified Scorecaster Watchlist changes."
};

export default function NotificationCenterPage() {
  return <NotificationCenterClient />;
}
