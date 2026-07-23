import AutonomousAgentClient from "./AutonomousAgentClient";
import AutonomousV12Panel from "./AutonomousV12Panel";

export const metadata = {
  title: "Autonomous Scorecaster V12 | Scorecaster",
  description: "Configure and audit Scorecaster's autonomous paper agent, learning loop, risk controls and circuit breakers."
};

export default function AutonomousAgentPage() {
  return (
    <div className="space-y-12">
      <AutonomousV12Panel />
      <AutonomousAgentClient />
    </div>
  );
}
