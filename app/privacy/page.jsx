import PolicyPage from "../components/PolicyPage";

export const metadata = { title: "Privacy | Scorecaster" };

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy policy"
      intro="Scorecaster is designed to collect the minimum account, verified-watchlist, market-timeline, alert-history, model-audit and paper-tracking data required to operate the service. It does not process deposits, withdrawals, payment cards, bank accounts or bookmaker credentials."
      sections={[
        {
          title: "Data we process",
          body: [
            "An account may contain an email address, an internal user identifier, optional display name, paper-bankroll settings, paper bets, result tracking, verified watchlist selections, alert thresholds, deduplicated alert history, verified price snapshots, bounded model-audit snapshots and security-relevant timestamps.",
            "A Market Timeline snapshot contains a watched event and selection, current decimal odds, decision label, bounded market metrics, bookmaker label, source label and capture time. The server recomputes the snapshot from current Top Picks; client-supplied price or model fields are not trusted.",
            "When a current Scorecaster pick is saved through the audited paper flow, the server may store a compact snapshot of public team-form and schedule features, source status, market benchmark and shadow-model output. It does not contain contacts, precise location, payment data or bookmaker credentials.",
            "Alert Inbox rows contain the verified alert type, severity, title, message, related match and selection, bounded comparison details, first and last seen timestamps, read state and resolved state.",
            "A paper bankroll is a simulation value. It is not a real-money account balance and is not connected to a bank, payment provider or betting operator."
          ]
        },
        {
          title: "Why data is processed",
          body: [
            "Account data is used for authentication, cross-device synchronization, paper history, risk calculations, verified watchlist comparisons, descriptive price-history views, alert acknowledgement, model auditing, user-requested export and account deletion.",
            "Market Timeline points are used only to describe how the verified available price, implied probability, bookmaker label and Scorecaster decision changed while the selection was watched. They are not treated as evidence of sharp money, inside information or the event outcome.",
            "Settled paper rows with a server-verified feature snapshot may be used for chronological comparison of the market-consensus champion and a sport-specific shadow challenger. The shadow model has no automatic promotion path and does not change the production probability, PLAY decision, edge, EV or stake.",
            "We do not require precise location, contacts, camera, microphone, identity documents or payment information for the Scorecaster MVP."
          ]
        },
        {
          title: "Verified watchlist, Market Timeline and Alert Inbox",
          body: [
            "A signed-in user may add a current Scorecaster selection to the watchlist. The server verifies the event and selection against current live-provider analysis before storing it.",
            "A signed-in user may explicitly capture the current price for an owned watchlist selection. The server verifies the same event, sport and selection again before storing a timeline point. Duplicate or unchanged points may be suppressed.",
            "User-triggered watchlist refresh compares the stored state with current verified data and may report a kickoff window, price movement, decision change or a price below the calculated PLAY floor. Missing current data remains unavailable; Scorecaster does not invent a replacement market.",
            "Server-generated changes are deduplicated into the user's Alert Inbox. A condition may be marked read, remain active, become resolved or reopen as unread if it appears again. Clients cannot submit arbitrary inbox content.",
            "Watchlist V2, Market Timeline V1 and Alert Inbox V1 do not create a paper stake, place a wager or claim background push-notification delivery."
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
            "Transport uses HTTPS. Supabase authentication and forced database Row Level Security restrict account, paper, watchlist, Market Timeline and Alert Inbox rows to the authenticated user. Protected APIs also enforce user validation, bounded inputs and per-user quotas.",
            "Only paper feature snapshots and market price points recomputed from the current server analysis are marked as server-audited. Client-supplied snapshot, odds or model fields are not trusted for model evaluation or price history.",
            "No system is perfectly immune to attack. Scorecaster minimizes potential harm by limiting collected data and separating public client configuration from server-only settings."
          ]
        },
        {
          title: "Your controls",
          body: [
            "Authenticated users can pause or remove watchlist rows, capture timeline points, mark inbox alerts read, request an export through /api/account/export and delete their account through the in-app account deletion flow when server deletion is configured.",
            "Account export includes paper-audit snapshots, verified watchlist rows, Market Timeline points and Alert Inbox rows. Removing a watchlist row cascades its timeline points, and account deletion removes all of those rows. Public release requires a configured support contact and a finalized controller identity."
          ]
        }
      ]}
    />
  );
}
