import PolicyPage from "../components/PolicyPage";

export const metadata = { title: "Privacy | Scorecaster" };

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy policy"
      intro="Scorecaster is designed to collect the minimum account, verified-watchlist, alert-history, alert-preference, model-audit and paper-tracking data required to operate the service. It does not process deposits, withdrawals, payment cards, bank accounts or bookmaker credentials."
      sections={[
        {
          title: "Data we process",
          body: [
            "An account may contain an email address, an internal user identifier, optional display name, paper-bankroll settings, paper bets, result tracking, verified watchlist selections, alert thresholds, Alert Inbox preferences, deduplicated alert history, bounded model-audit snapshots and security-relevant timestamps.",
            "When a current Scorecaster pick is saved through the audited paper flow, the server may store a compact snapshot of public team-form and schedule features, source status, market benchmark and shadow-model output. It does not contain contacts, precise location, payment data or bookmaker credentials.",
            "Watchlist rows contain a provider event identifier, sport and market labels, selection, teams, scheduled start, the price and Scorecaster decision when added, and a bounded technical snapshot used for comparison.",
            "Alert Inbox rows contain the verified alert type, severity, server-generated fallback title and message, related match and selection, bounded comparison details, first and last seen timestamps, read state, resolved state and optional dismissal timestamp. The interface localizes supported structured alert types to the selected language.",
            "Alert Inbox preferences may include whether the inbox is enabled, minimum severity and enabled alert categories.",
            "A paper bankroll is a simulation value. It is not a real-money account balance and is not connected to a bank, payment provider or betting operator."
          ]
        },
        {
          title: "Why data is processed",
          body: [
            "Account data is used for authentication, cross-device synchronization, paper history, risk calculations, verified watchlist comparisons, inbox filtering and acknowledgement, model auditing, user-requested export and account deletion.",
            "Settled paper rows with a server-verified feature snapshot may be used for chronological comparison of the market-consensus champion and a sport-specific shadow challenger. The shadow model has no automatic promotion path and does not change the production probability, PLAY decision, edge, EV or stake.",
            "We do not require precise location, contacts, camera, microphone, identity documents or payment information for the Scorecaster MVP."
          ]
        },
        {
          title: "Verified watchlist and Alert Inbox",
          body: [
            "A signed-in user may add a current Scorecaster selection to the watchlist. The server verifies the event and selection against current live-provider analysis before storing it.",
            "User-triggered refresh compares the stored state with current verified data and may report a kickoff window, price movement, decision change, unavailable market or a price below the calculated PLAY floor. Missing current data remains unavailable; Scorecaster does not invent a replacement market.",
            "Server-generated changes are deduplicated into the user's Alert Inbox. A condition may be marked read or unread, remain active, become resolved, be dismissed from the visible inbox or reopen as unread after it has genuinely resolved and later reappeared. Clients cannot submit arbitrary inbox content.",
            "Preferences filter future Watchlist synchronizations by severity and category. Existing visible history remains until it is dismissed or the account is deleted.",
            "Watchlist V2 and Alert Inbox V2 do not create a paper stake, place a wager, register a device notification token or claim background delivery."
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
            "Transport uses HTTPS. Supabase authentication and forced database Row Level Security restrict account, paper, watchlist, Alert Inbox and inbox-setting rows to the authenticated user. Protected APIs also enforce user validation, bounded inputs and per-user quotas.",
            "Only a feature snapshot recomputed from the current server analysis is marked as server-audited. Client-supplied snapshot fields are not trusted for model evaluation.",
            "No system is perfectly immune to attack. Scorecaster minimizes potential harm by limiting collected data and separating public client configuration from server-only settings."
          ]
        },
        {
          title: "Your controls",
          body: [
            "Authenticated users can pause or remove watchlist rows, change Alert Inbox preferences, mark alerts read or unread, dismiss alerts from the visible inbox, request an export through /api/account/export and delete their account through the in-app account deletion flow when server deletion is configured.",
            "Account export includes paper-audit snapshots, verified watchlist rows, Alert Inbox settings, and visible and dismissed inbox rows. Account deletion removes the rows containing those data. Public release requires a configured support contact and a finalized controller identity."
          ]
        }
      ]}
    />
  );
}
