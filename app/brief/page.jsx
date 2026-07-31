import DailyBriefClient from "./DailyBriefClient";

export const metadata = {
  title: "Daily Brief | Scorecaster",
  description: "A concise daily view of Scorecaster decisions, watch items and paper-portfolio discipline."
};

export default function DailyBriefPage() {
  return <DailyBriefClient />;
}
