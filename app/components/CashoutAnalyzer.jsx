"use client";

import { calculateCashoutValue } from "@/lib/live-engine";

export default function CashoutAnalyzer({
  bet,
}) {
  if (!bet) return null;

  const analysis = calculateCashoutValue(bet);

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
      <h2 style={{ marginTop: 0 }}>
        Cashout Analyzer
      </h2>

      <div style={{ marginTop: 12 }}>
        Suggested action:
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 24,
          fontWeight: 900,
        }}
      >
        {analysis.action}
      </div>

      <div
        style={{
          marginTop: 12,
          color: "#94a3b8",
        }}
      >
        {analysis.reason}
      </div>
    </section>
  );
}
