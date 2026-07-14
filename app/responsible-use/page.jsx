import PolicyPage from "../components/PolicyPage";

export const metadata = { title: "Responsible use | Scorecaster" };

export default function ResponsibleUsePage() {
  return (
    <PolicyPage
      title="Responsible use"
      intro="Scorecaster should help users understand uncertainty and risk. It must be allowed to recommend SKIP and must never pressure a person to stake real money."
      sections={[
        {
          title: "Product rules",
          body: [
            "Scorecaster uses paper mode only. There are no deposits, withdrawals, real-money balances, bookmaker logins or bet-placement links.",
            "Risk limits are conservative defaults, not permission to gamble. A user can set a virtual bankroll and paper exposure limits for learning and model evaluation."
          ]
        },
        {
          title: "Warning signals",
          body: [
            "Repeatedly increasing stakes, chasing losses, ignoring limits, distress or treating model output as certainty are reasons to stop rather than continue.",
            "Historical accuracy does not guarantee future results. Odds and model probabilities can change quickly."
          ]
        },
        {
          title: "Age and wellbeing",
          body: [
            "The public mobile release must use an appropriate store age rating and must not be marketed to minors.",
            "Anyone concerned about their gambling should stop, use operator blocking tools where relevant and contact a qualified local support service."
          ]
        }
      ]}
    />
  );
}
