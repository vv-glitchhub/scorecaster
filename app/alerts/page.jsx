import AlertInboxClient from "./AlertInboxClient";
import AutonomousIncidentPanel from "./AutonomousIncidentPanel";
import DiagnosticIncidentPanel from "./DiagnosticIncidentPanel";

export const metadata = {
  title: "Alert Inbox | Scorecaster",
  description: "User-isolated watchlist alerts plus Scorecaster decision, provider and Autonomous Intelligence V12.1 safety incidents."
};

export default function AlertInboxPage() {
  return <div className="space-y-8"><AutonomousIncidentPanel /><DiagnosticIncidentPanel /><AlertInboxClient /></div>;
}
