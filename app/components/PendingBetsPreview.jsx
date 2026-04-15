"use client";

import { useMemo } from "react";
import { useBetStore } from "@/lib/useBetStore";

export default function PendingBetsPreview({ lang = "en" }) {
  const { bets } = useBetStore();

  const pendingBets = useMemo(() => {
    return [...bets]
      .filter((bet) => bet.result === "pending")
      .reverse()
      .slice(0, 5);
  }, [bets]);

  const title =
    lang === "fi" ? "Avoimet vedot" : "Pending Bets";

  const emptyText =
    lang === "fi"
      ? "Avoimia vetoja ei ole."
      : "No pending bets.";

  const stakeLabel =
    lang === "fi" ? "Panos" : "Stake";

  if (pendingBets.length === 0) {
    return (
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(0,0,0,0.2)",
          borderRadius: "16px",
          padding: "16px",
          color: "#94a3b8",
          fontSize: "14px",
        }}
      >
        <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#fff" }}>{title}</p>
        <p style={{ margin: 0 }}>{emptyText}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      <p style={{ margin: 0, fontWeight: 700, color: "#fff" }}>{title}</p>

      {pendingBets.map((bet) => (
        <div
          key={bet.id}
          style={{
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(0,0,0,0.2)",
            borderRadius: "16px",
            padding: "14px",
          }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>
            {bet.match}
          </p>
          <p style={{ margin: "8px 0 0", color: "#cbd5e1", fontSize: "14px" }}>
            {bet.selection}
          </p>
          <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: "13px" }}>
            Odds {bet.odds} • {stakeLabel} €{Number(bet.stake).toFixed(2)}
          </p>
        </div>
      ))}
    </div>
  );
}
