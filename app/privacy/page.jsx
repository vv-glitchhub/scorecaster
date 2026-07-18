import PolicyPage from "../components/PolicyPage";

export const metadata = { title: "Privacy | Scorecaster" };

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy policy"
      intro="Scorecaster is designed to collect the minimum account, verified-watchlist, alert-history, optional notification-device and paper-tracking data required to operate the service. It does not process deposits, withdrawals, payment cards, bank accounts or bookmaker credentials."
      sections={[
        {
          title: "Data we process",
          body: [
            "An account may contain an email address, an internal user identifier, optional display name, paper-bankroll settings, paper bets, result tracking, verified watchlist selections, alert thresholds, deduplicated alert history, notification preferences and security-relevant timestamps.",
            "Watchlist rows contain a provider event identifier, sport and market labels, selection, teams, scheduled start, the price and Scorecaster decision when added, and a bounded technical snapshot used for comparison.",
            "Alert Inbox rows contain the verified alert type, severity, title, message, related match and selection, bounded comparison details, first and last seen timestamps, read state and resolved state.",
            "When a user explicitly enables push notifications in the native application, Scorecaster stores the Expo push token, mobile platform, app and build versions, enabled state and last-seen timestamp. It does not require a hardware identifier, contacts or precise location for notification registration.",
            "A paper bankroll is a simulation value. It is not a real-money account balance and is not connected to a bank, payment provider or betting operator."
          ]
        },
        {
          title: "Why data is processed",
          body: [
            "Account data is used for authentication, cross-device synchronization, paper history, risk calculations, verified watchlist comparisons, alert acknowledgement, notification preferences, user-requested export and account deletion.",
            "A registered push token is a delivery address for future user-selected notifications. It is not an authentication credential and is not used to authorize account access.",
            "Settled paper rows with a valid stored probability and timestamp may be used by Agent V11 for chronological calibration and drift evaluation. The challenger remains in shadow mode and does not silently change the production probability.",
            "We do not require precise location, contacts, camera, microphone, identity documents or payment information for the Scorecaster MVP."
          ]
        },
        {
          title: "Verified watchlist and Alert Inbox",
          body: [
            "A signed-in user may add a current Scorecaster selection to the watchlist. The server verifies the event and selection against current live-provider analysis before storing it.",
            "User-triggered refresh compares the stored state with current verified data and may report a kickoff window, price movement, decision change or a price below the calculated PLAY floor. Missing current data remains unavailable; Scorecaster does not invent a replacement market.",
            "Server-generated changes are deduplicated into the user's Alert Inbox according to the user's notification preferences. A condition may be marked read, remain active, become resolved or reopen as unread if it appears again. Clients cannot submit arbitrary inbox content.",
            "Watchlist V2 and Alert Inbox V1 do not create a paper stake or place a wager."
          ]
        },
        {
          title: "Notification permissions and device registration",
          body: [
            "Push registration is optional and begins only after the signed-in user presses the enable button in the native iOS or Android application. The operating system permission prompt is shown before a token is requested.",
            "The server stores the delivery token behind authenticated APIs and forced Row Level Security. API responses and account exports contain only device metadata; the raw delivery token and its hash are not returned.",
            "The same delivery token may belong to only one Scorecaster user at a time. Registering it for the current signed-in user removes its association with another account.",
            "The user can remove the current device registration. Native sign-out attempts to remove the current device registration before closing the session, and permanent account deletion removes all notification preferences and device registrations.",
            "Notification Preferences & Device Registry V1 prepares consent, preferences and token storage. Background notification delivery is not active until a separately reviewed delivery worker and receipt-cleanup process are deployed."
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
            "Transport uses HTTPS. Supabase authentication and forced database Row Level Security restrict account, paper, watchlist, Alert Inbox, notification-preference and device-registration rows to the authenticated user. Protected APIs also enforce user validation, bounded inputs and per-user quotas.",
            "No system is perfectly immune to attack. Scorecaster minimizes potential harm by limiting collected data and separating public client configuration from server-only settings."
          ]
        },
        {
          title: "Your controls",
          body: [
            "Authenticated users can pause or remove watchlist rows, mark inbox alerts read, change notification categories, remove the current native device registration, request an export and permanently delete their account.",
            "Account export includes notification preferences and non-secret device metadata but excludes delivery tokens. Account deletion removes verified watchlist rows, Alert Inbox rows, notification preferences and all device registrations. Public release requires a configured support contact and a finalized controller identity."
          ]
        }
      ]}
    />
  );
}
