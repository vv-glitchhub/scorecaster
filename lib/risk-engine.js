export function analyzeBetRisk({ stake, bankroll, edge, ev, kellyMode }) {
  const numericStake = Number(stake || 0);
  const numericBankroll = Number(bankroll || 0);
  const stakeRatio = numericBankroll > 0 ? numericStake / numericBankroll : 0;

  const warnings = [];

  if (stakeRatio >= 0.1) {
    warnings.push("Stake is very large compared to bankroll.");
  } else if (stakeRatio >= 0.05) {
    warnings.push("Stake exceeds 5% of bankroll.");
  }

  if (kellyMode === "full") {
    warnings.push("Full Kelly is aggressive and can create high volatility.");
  }

  if (edge <= 0) {
    warnings.push("This bet has no positive model edge.");
  }

  if (ev <= 0) {
    warnings.push("Expected value is not positive.");
  }

  let level = "Low";

  if (warnings.length >= 3) level = "High";
  else if (warnings.length >= 1) level = "Medium";

  return {
    level,
    warnings,
    stakeRatio
  };
}
