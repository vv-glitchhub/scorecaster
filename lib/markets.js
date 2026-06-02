export const MARKETS = [
  {
    key: "h2h",
    title: "H2H / Moneyline"
  },
  {
    key: "spreads",
    title: "Spreads / Handicap"
  },
  {
    key: "totals",
    title: "Totals / Over-Under"
  }
];

export const MARKET_QUERY = MARKETS.map((market) => market.key).join(",");
