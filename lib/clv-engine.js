export function calculateCLV({
  betOdds,
  closingOdds
}) {
  if (
    !betOdds ||
    !closingOdds
  ) {
    return {
      clv: 0,
      positive: false
    };
  }

  const betProb = 1 / betOdds;
  const closeProb = 1 / closingOdds;

  const clv = closeProb - betProb;

  return {
    clv,
    positive: clv > 0
  };
}
