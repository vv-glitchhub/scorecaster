import PolicyPage from "../../components/PolicyPage";

export const metadata = { title: "Alert Inbox V2 privacy | Scorecaster" };

export default function AlertInboxPrivacyPage() {
  return (
    <PolicyPage
      title="Alert Inbox V2 privacy notice"
      intro="Alert Inbox V2 stores the minimum structured data needed to show user-specific verified Watchlist changes. It remains an in-app, user-refreshed feature and does not register a device push token."
      sections={[
        {
          title: "Stored data",
          body: [
            "Rows may contain a user-specific server fingerprint, Watchlist reference, alert type, severity, fallback title and message, match and selection labels, bounded comparison details, active state, read timestamp, resolved timestamp, optional dismissal timestamp, and first and latest observation times.",
            "Preferences may contain whether Alert Inbox is enabled, minimum severity, and enabled kickoff, price, decision and availability categories."
          ]
        },
        {
          title: "How rows are created",
          body: [
            "Rows are generated only from the authenticated user's server-verified Watchlist comparison. The client cannot supply an alert fingerprint, title, message, severity or calculated market state.",
            "Known structured alert types are rendered in Finnish, English or Spanish by the client. The database fallback text remains available for auditing."
          ]
        },
        {
          title: "User controls",
          body: [
            "Users may change filtering preferences, mark alerts read or unread, mark all visible alerts read, and dismiss alerts from the visible inbox.",
            "A dedicated authenticated export endpoint returns the user's Alert Inbox settings and history. Permanent account deletion removes settings, inbox rows and the related Watchlist rows."
          ]
        },
        {
          title: "Protection and limits",
          body: [
            "Forced Row Level Security and explicit authenticated-user filters isolate rows and settings. Protected APIs validate origin, authentication, bounded input and per-user quotas.",
            "Alert Inbox V2 does not request operating-system notification permission, store a device push token, run background delivery, create a paper stake or handle real money."
          ]
        }
      ]}
    />
  );
}
