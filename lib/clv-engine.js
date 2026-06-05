export function calculateCLV({ betOdds, closingOdds }) {
  const bet = Number(betOdds || 0);
  const close = Number(closingOdds || 0);

  if (!bet || !close || bet <= 1 || close <= 1) {
    return {
      clv: 0,
      clvPercent: 0,
      positive: false,
      note: "CLV not available."
    };
  }

  const betImplied = 1 / bet;
  const closingImplied = 1 / close;

  const clv = closingImplied - betImplied;

  return {
    clv,
    clvPercent: clv * 100,
    positive: clv > 0,
    note: clv > 0 ? "Positive closing line value." : "Negative closing line value."
  };
}
