"use client";

export default function FloatingBetSlip({ betSlip = [], onClick }) {
  const count = betSlip.length;
  const totalOdds = betSlip.reduce((sum, p) => sum * Number(p.odds || 1), 1);

  if (!count) return null;

  return (
    <button className="floating-betslip" onClick={onClick}>
      <span>{count} vetoa</span>
      <b>Ker. {totalOdds.toFixed(2)}</b>
    </button>
  );
}
