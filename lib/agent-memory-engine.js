export function buildAgentMemory(trackedBets = []) {
  const memory = {
    totalBets: trackedBets.length,
    wins: 0,
    losses: 0,
    profit: 0,

    sports: {},
    markets: {},
    bookmakers: {},

    strengths: [],
    weaknesses: []
  };

  for (const bet of trackedBets) {
    const won = bet.result === "WIN";

    if (won) memory.wins++;
    else if (bet.result === "LOSS") memory.losses++;

    memory.profit += Number(bet.profit || 0);

    const sport =
      bet.sportKey || "unknown";

    const market =
      bet.marketKey || "unknown";

    const bookmaker =
      bet.bookmaker || "unknown";

    if (!memory.sports[sport]) {
      memory.sports[sport] = {
        bets: 0,
        wins: 0,
        profit: 0
      };
    }

    if (!memory.markets[market]) {
      memory.markets[market] = {
        bets: 0,
        wins: 0,
        profit: 0
      };
    }

    if (!memory.bookmakers[bookmaker]) {
      memory.bookmakers[bookmaker] = {
        bets: 0,
        wins: 0,
        profit: 0
      };
    }

    memory.sports[sport].bets++;
    memory.markets[market].bets++;
    memory.bookmakers[bookmaker].bets++;

    if (won) {
      memory.sports[sport].wins++;
      memory.markets[market].wins++;
      memory.bookmakers[bookmaker].wins++;
    }

    memory.sports[sport].profit += Number(
      bet.profit || 0
    );

    memory.markets[market].profit += Number(
      bet.profit || 0
    );

    memory.bookmakers[bookmaker].profit += Number(
      bet.profit || 0
    );
  }

  memory.strengths = Object.entries(
    memory.sports
  )
    .sort(
      (a, b) =>
        b[1].profit - a[1].profit
    )
    .slice(0, 5);

  memory.weaknesses = Object.entries(
    memory.sports
  )
    .sort(
      (a, b) =>
        a[1].profit - b[1].profit
    )
    .slice(0, 5);

  return memory;
}
