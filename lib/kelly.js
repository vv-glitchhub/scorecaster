export function kellyStake({
  probability,
  odds,
  bankroll,
  fraction = 0.25,
}) {
  if (!probability || !odds || !bankroll) return 0;

  const b = odds - 1;
  if (b <= 0) return 0;

  const q = 1 - probability;
  const rawKelly = (b * probability - q) / b;

  if (!Number.isFinite(rawKelly) || rawKelly <= 0) return 0;

  return Number((rawKelly * fraction * bankroll).toFixed(2));
}
