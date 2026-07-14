import PolicyPage from "../components/PolicyPage";

export const metadata = { title: "Privacy | Scorecaster" };

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy policy"
      intro="Scorecaster is designed to collect the minimum account and paper-tracking data required to operate the service. It does not process deposits, withdrawals, payment cards, bank accounts or bookmaker credentials."
      sections={[
        {
          title: "Data we process",
          body: [
            "An account may contain an email address, an internal user identifier, optional display name, paper-bankroll settings, paper bets, result tracking and security-relevant timestamps.",
            "A paper bankroll is a simulation value. It is not a real-money account balance and is not connected to a bank, payment provider or betting operator."
          ]
        },
        {
          title: "Why data is processed",
          body: [
            "Account data is used for authentication, cross-device synchronization, paper-bet history, risk calculations, user-requested export and account deletion.",
            "We do not require precise location, contacts, camera, microphone, identity documents or payment information for the Scorecaster MVP."
          ]
        },
        {
          title: "Protection and access",
          body: [
            "Transport uses HTTPS. Supabase authentication and database Row Level Security restrict account rows to the authenticated user. Server-only integration keys are not included in browser or mobile bundles.",
            "No system is perfectly immune to attack. Scorecaster minimizes potential harm by limiting the data collected and by separating public client configuration from server secrets."
          ]
        },
        {
          title: "Your controls",
          body: [
            "Authenticated users can request an export through /api/account/export and can delete their account through the in-app account deletion flow when server deletion is configured.",
            "Public release requires a configured support contact and a finalized controller identity. This policy must be reviewed before App Store or Google Play submission."
          ]
        }
      ]}
    />
  );
}
