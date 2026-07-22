import AlertInboxClient from "./AlertInboxClient";
import DiagnosticIncidentPanel from "./DiagnosticIncidentPanel";

export const metadata = {
  title: "Alert Inbox | Scorecaster",
  description: "User-isolated watchlist alerts plus Scorecaster decision-flow and provider incidents."
};

export default function AlertInboxPage() {
  return <div className="space-y-8"><DiagnosticIncidentPanel /><AlertInboxClient /></div>;
}
