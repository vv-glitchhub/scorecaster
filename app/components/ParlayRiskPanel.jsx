"use client";

import { analyzeParlayV2 } from "@/lib/parlay-engine-v2";

export default function ParlayRiskPanel({ picks = [], bankroll = 1000 }) {
  const analysis = analyzeParlayV2(picks, bankroll);

  if (!analysis.canAnalyze) return null;

  const riskText =
    analysis.status === "good"
      ? "Maltillinen rekka-riski."
      : analysis.status === "warning"
      ? "Kohonnut rekka-riski. Pienennä panosta."
      : "Liian korkea rekka-riski.";

  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 22,
        padding: 18,
        background: "rgba(2,6,23,0.72)",
        color: "#fff",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Rekka Risk Panel</h2>

      <div style={{ color: "#94a3b8", lineHeight: 1.6 }}>{riskText}</div>

      <div style={{ marginTop: 12, lineHeight: 1.7 }}>
        Weak legs: <b>{analysis.weakLegs.length}</b>
        <br />
        Risky legs: <b>{analysis.riskyLegs.length}</b>
        <br />
        Correlation warnings: <b>{analysis.correlation.warnings.length}</b>
      </div>
    </section>
  );
}
