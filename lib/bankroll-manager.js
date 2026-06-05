const MAX_TOTAL_EXPOSURE = 0.2;
const MAX_SINGLE_BET = 0.04;

export function calculateBankrollPlan({
  bankroll = 1000,
  picks = []
}) {
  const betPicks = picks.filter(
    (pick) => pick.decision === "BET"
  );

  const totalAllowed =
    bankroll * MAX_TOTAL_EXPOSURE;

  let allocated = 0;

  const recommendations =
    betPicks.map((pick) => {
      const confidence =
        Number(pick.finalScore || 0);

      let stake =
        bankroll *
        Math.min(
          confidence * 0.15,
          MAX_SINGLE_BET
        );

      allocated += stake;

      return {
        match: pick.match,
        selection: pick.selection,
        stake
      };
    });

  if (
    allocated > totalAllowed
  ) {
    const scale =
      totalAllowed / allocated;

    recommendations.forEach(
      (item) => {
        item.stake *= scale;
      }
    );

    allocated = totalAllowed;
  }

  return {
    bankroll,
    allocated,
    remaining:
      bankroll - allocated,

    recommendations
  };
}
