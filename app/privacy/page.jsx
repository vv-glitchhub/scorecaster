import PolicyPage from "../components/PolicyPage";

export const metadata = { title: "Privacy | Scorecaster" };

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy policy"
      intro="Scorecaster is designed to collect the minimum account, verified-watchlist, in-app notification and paper-tracking data required to operate the service. It does not process deposits, withdrawals, payment cards, bank accounts or bookmaker credentials."
      sections={[
        {
          title: "Data we process",
          body: [
            "An account may contain an email address, an internal user identifier, optional display name, paper-bankroll settings, paper bets, result tracking, verified watchlist selections, Notification Center preferences and security-relevant timestamps.",
            "Watchlist rows contain a provider event identifier, sport and market labels, selection, teams, scheduled start, the price and Scorecaster decision when added, and a bounded technical snapshot used for comparison.",
            "Notification rows contain a server-generated deduplication key, notification type and severity, related event and selection labels, bounded calculated details, first and latest observation times, and read or dismissed timestamps. Clients cannot upload custom notification text.",
            "A paper bankroll is a simulation value. It is not a real-money account balance and is not connected to a bank, payment provider or betting operator."
          ]
        },
        {
          title: "Why data is processed",
          body: [
            "Account data is used for authentication, cross-device synchronization, paper history, risk calculations, verified watchlist comparisons, the user-requested in-app notification inbox, data export and account deletion.",
            "Settled paper rows with a valid stored probability and timestamp may be used by Agent V11 for chronological calibration and drift evaluation. The challenger remains in shadow mode and does not silently change the production probability.",
            "We do not require precise location, contacts, camera, microphone, identity documents or payment information for the Scorecaster MVP."
          ]
        },
        {
          title: "Verified watchlist and Notification Center",
          body: [
            "A signed-in user may add a current Scorecaster selection to the watchlist. The server verifies the event and selection against current live-provider analysis before storing it.",
            "User-triggered refresh compares the stored state with current verified data and may report a kickoff window, price movement, decision change, unavailable market or a price below the calculated PLAY floor. Missing current data remains unavailable; Scorecaster does not invent a replacement market.",
            "Notification Center V1 stores only structured notifications generated from those verified comparisons. The interface localizes them to the selected language. Users can set a minimum severity, enable or disable categories, mark notifications read or unread, and dismiss them from the inbox.",
            "Notification Center V1 does not register device push tokens, request operating-system notification permission, run background delivery or place a paper stake. Synchronization is initiated by the user."
          ]
        },
        {
          title: "Optional governed explanation",
          body: [
            "A signed-in user may explicitly request an optional language-model explanation for an already calculated Agent decision. The server sends only a bounded market-decision contract containing the match, selection, calculated decision metrics, verified evidence, counterarguments and missing-evidence labels.",
            "The explanation request does not include the user's email address, name, account identifier, payment information, bookmaker credentials, authentication token or full paper history. Provider-side response storage is disabled. The provider is not permitted to change the deterministic probability, edge, expected value, stake, portfolio allocation or PLAY/WATCH/SKIP decision.",
            "If the optional provider is unavailable or the request is not eligible for enhanced output, Scorecaster returns a deterministic explanation instead. The browser may cache a completed explanation locally for a limited period to reduce repeated provider calls."
          ]
        },
        {
          title: "Protection and access",
          body: [
            "Transport uses HTTPS. Supabase authentication and forced database Row Level Security restrict account, paper, watchlist, notification and notification-setting rows to the authenticated user. Protected APIs also enforce user validation, bounded inputs and per-user quotas.",
            "No system is perfectly immune to attack. Scorecaster minimizes potential harm by limiting collected data and separating public client configuration from server-only settings."
          ]
        },
        {
          title: "Your controls",
          body: [
            "Authenticated users can pause or remove watchlist rows, control Notification Center preferences, mark or dismiss notifications, request an export through /api/account/export and delete their account through the in-app account deletion flow when server deletion is configured.",
            "Account export and deletion include verified watchlist rows, Notification Center settings and notification history. Public release requires a configured support contact and a finalized controller identity. This policy must be reviewed before App Store or Google Play submission."
          ]
        }
      ]}
    />
  );
}
