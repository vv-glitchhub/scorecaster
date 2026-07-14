import PolicyPage from "../components/PolicyPage";

export const metadata = { title: "Terms | Scorecaster" };

export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms of use"
      intro="Scorecaster is a sports-analysis, education, risk-control and paper-tracking product. It does not place bets or provide a real-money gambling account."
      sections={[
        {
          title: "No guarantee of profit",
          body: [
            "Probabilities, edge, expected value, confidence, AI explanations and suggested paper stakes are estimates. They can be incomplete, delayed or wrong.",
            "A PLAY, CAUTION, WATCH or SKIP label is analytical output, not a promise of a result or financial advice."
          ]
        },
        {
          title: "Paper mode only",
          body: [
            "Balances and stakes stored by Scorecaster are simulation values. Scorecaster does not accept deposits, execute wagers, withdraw funds or connect to a bookmaker account.",
            "Users remain responsible for complying with the law and for any activity performed outside Scorecaster."
          ]
        },
        {
          title: "Acceptable use",
          body: [
            "Do not attack, overload, scrape excessively, bypass access controls, upload malicious content or attempt to access another user's data.",
            "Accounts may be restricted when necessary to protect the service or other users."
          ]
        },
        {
          title: "Release status",
          body: [
            "The current product is an alpha foundation and may change. Store release requires final legal identity, support details, age-rating review and jurisdiction-specific review."
          ]
        }
      ]}
    />
  );
}
