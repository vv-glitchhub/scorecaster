export function analyzeRisk({
  bankroll = 1000,
  betSlip = [],
  betHistory = [],
}) {
  const bank = Number(bankroll) || 1000;

  const openHistoryBets = betHistory.filter((b) => b.status === "open");

  const slipStake = betSlip.reduce(
    (sum, p) => sum + Number(p.userStake || p.stake || 0),
    0
  );

  const openStake = openHistoryBets.reduce(
    (sum, b) => sum + Number(b.stake || 0),
    0
  );

  const totalExposure = slipStake + openStake;
  const exposurePct = bank > 0 ? totalExposure / bank : 0;

  const byBookmaker = {};

  for (const bet of [...betSlip, ...openHistoryBets]) {
    const book = bet.bookmaker || "Unknown";
    const stake = Number(bet.userStake || bet.stake || 0);

    byBookmaker[book] = (byBookmaker[book] || 0) + stake;
  }

  const bookmakerExposure = Object.entries(byBookmaker)
    .map(([bookmaker, stake]) => ({
      bookmaker,
      stake,
      pct: bank > 0 ? stake / bank : 0,
    }))
    .sort((a, b) => b.stake - a.stake);

  let level = "OK";
  let message = "Riskitaso on maltillinen.";

  if (exposurePct >= 0.2) {
    level = "KORKEA";
    message = "Liian suuri osa pelikassasta on riskissä. Pienennä panoksia.";
  } else if (exposurePct >= 0.1) {
    level = "VARO";
    message = "Altistus alkaa olla korkea. Pelaa mieluummin pienempiä singlejä.";
  }

  const maxSingleStake = bank * 0.03;
  const dailyLimit = bank * 0.08;

  return {
    bankroll: bank,
    slipStake,
    openStake,
    totalExposure,
    exposurePct,
    level,
    message,
    maxSingleStake,
    dailyLimit,
    bookmakerExposure,
  };
}
