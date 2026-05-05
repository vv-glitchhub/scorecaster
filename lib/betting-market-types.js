export const MARKET_TYPES = [
  {
    id: "h2h",
    labelFi: "Voittaja / 1X2",
    labelEn: "Moneyline / 1X2",
    descriptionFi: "Koti, tasapeli tai vieras.",
    descriptionEn: "Home, draw or away.",
  },
  {
    id: "totals",
    labelFi: "Yli / alle",
    labelEn: "Over / under",
    descriptionFi: "Ottelun kokonaismaalit tai pisteet.",
    descriptionEn: "Total goals or points.",
  },
  {
    id: "spreads",
    labelFi: "Tasoitus",
    labelEn: "Handicap / spread",
    descriptionFi: "Joukkue saa tai antaa tasoitusta.",
    descriptionEn: "Team gives or receives handicap.",
  },
];

export const FUTURE_MARKETS = [
  "Double chance",
  "Draw no bet",
  "Team totals",
  "Player props",
  "Same game parlay",
  "Arbitrage",
  "Middles",
  "Low hold markets",
];

export function decimalToProbability(odds) {
  const n = Number(odds);
  if (!Number.isFinite(n) || n <= 1) return null;
  return 1 / n;
}

export function expectedValue({ odds, probability }) {
  const o = Number(odds);
  const p = Number(probability);
  if (!Number.isFinite(o) || !Number.isFinite(p)) return null;
  return o * p - 1;
}

export function kellyStake({ odds, probability, bankroll, fraction = 0.25 }) {
  const o = Number(odds);
  const p = Number(probability);
  const b = Number(bankroll);
  const f = Number(fraction);

  if (!Number.isFinite(o) || !Number.isFinite(p) || !Number.isFinite(b)) return 0;
  if (o <= 1 || p <= 0 || p >= 1 || b <= 0) return 0;

  const decimalEdge = (o * p - 1) / (o - 1);
  const stake = Math.max(0, decimalEdge * b * f);

  return Number(stake.toFixed(2));
}

export function getPickGrade(edge) {
  if (edge >= 0.08) return { label: "A", textFi: "Vahva value", textEn: "Strong value" };
  if (edge >= 0.04) return { label: "B", textFi: "Hyvä value", textEn: "Good value" };
  if (edge >= 0.015) return { label: "C", textFi: "Pieni value", textEn: "Small value" };
  return { label: "D", textFi: "Heikko signaali", textEn: "Weak signal" };
}
