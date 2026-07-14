import PolicyPage from "../components/PolicyPage";

export const metadata = { title: "Security | Scorecaster" };

export default function SecurityPage() {
  return (
    <PolicyPage
      title="Security model"
      intro="Scorecaster uses defense in depth: minimal data, authenticated server validation, database row isolation, secure mobile session storage and server-only integration secrets."
      sections={[
        {
          title: "Data minimization",
          body: [
            "The product does not need or request card numbers, bank details, deposits, withdrawals, identity documents, bookmaker passwords or real-money account balances.",
            "Paper-bet payloads are normalized and only allowlisted analysis fields are retained in raw metadata."
          ]
        },
        {
          title: "Authentication and authorization",
          body: [
            "Web requests use server-validated Supabase sessions. Mobile requests use short-lived bearer tokens that are verified again on the server.",
            "Row Level Security binds account rows to auth.uid(). Two-user isolation testing is mandatory before public launch."
          ]
        },
        {
          title: "Application protections",
          body: [
            "Mutating cookie requests require a matching Origin header. JSON body size, type, text length, numeric ranges, status values and record counts are validated.",
            "Security headers block framing, MIME sniffing and unnecessary camera, microphone, location, payment and USB permissions. CI scans for exposed secrets and CodeQL analyzes JavaScript and TypeScript."
          ]
        },
        {
          title: "Mobile protections",
          body: [
            "Supabase session data is split and stored in Expo SecureStore rather than ordinary application storage. Production API traffic must use HTTPS.",
            "Service-role, Odds API and AI provider keys are forbidden from the mobile bundle and remain server-only."
          ]
        },
        {
          title: "Disclosure status",
          body: [
            "A dedicated vulnerability-reporting address and response process must be configured before public store launch. Do not include sensitive vulnerability details in a public issue."
          ]
        }
      ]}
    />
  );
}
