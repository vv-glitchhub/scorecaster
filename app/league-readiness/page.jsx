import LeagueReadinessClient from "./LeagueReadinessClient";

export const metadata = {
  title: "League Readiness | Scorecaster",
  description: "Current-window recommendation data-readiness by league without historical quality claims or decision upgrades."
};

export default function LeagueReadinessPage() {
  return <LeagueReadinessClient />;
}
