import MissionControlClient from "./MissionControlClient";

export const metadata = {
  title: "Autonomous Mission Control V12 | Scorecaster",
  description: "Autonomous paper-agent health, learning, risk circuit breakers, data readiness and audited run history."
};

export default function MissionControlPage() {
  return <MissionControlClient />;
}
