import AiCoachClient from "./AiCoachClient";

export const metadata = {
  title: "AI Coach | Scorecaster",
  description: "Evidence-based coaching from the user's own paper records, closing-line evidence and safety decisions."
};

export default function CoachPage() {
  return <AiCoachClient />;
}
