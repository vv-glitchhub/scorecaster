"use client";

import { useBetStore } from "@/lib/useBetStore";
import { getBetStats } from "@/lib/betStats";

export default function BetHistory() {
  const { bets, updateResult } = useBetStore();
  const stats = getBetStats(bets);

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      
      {/* STATS */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <Stat label="Staked" value={stats.totalStaked} />
        <Stat label="Profit" value={stats.totalProfit} />
        <Stat label="ROI" value={stats.roi.toFixed(2) + "%"} />
        <Stat label="W/L" value={`${stats.wins}/${stats.losses}`} />
      </div>

      {/* LIST */}
      {bets.map((b) => (
        <div
          key={b.id}
          style={{
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "12px",
            borderRadius: "12px",
          }}
        >
          <p style={{ margin: 0 }}>
            {b.match} – {b.selection}
          </p>

          <p style={{ margin: "6px 0", fontSize: "14px" }}>
            Odds: {b.odds} | Stake: {b.stake}
          </p>

          <p>Profit: {b.profit.toFixed(2)}</p>

          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={() => updateResult(b.id, "win")}>Win</button>
            <button onClick={() => updateResult(b.id, "lose")}>Lose</button>
            <button onClick={() => updateResult(b.id, "void")}>Void</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div
      style={{
        padding: "10px",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "10px",
      }}
    >
      <p style={{ margin: 0, fontSize: "12px", color: "#aaa" }}>{label}</p>
      <p style={{ margin: 0, fontWeight: "bold" }}>{value}</p>
    </div>
  );
}
