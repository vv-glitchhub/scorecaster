"use client";

import { useBetStore } from "@/lib/useBetStore";
import { getBetStats } from "@/lib/betStats";
import ProfitChart from "@/app/components/ProfitChart";

function Stat({ label, value }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "12px",
        background: "rgba(255,255,255,0.04)",
        minWidth: "120px",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "12px",
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </p>
      <p style={{ margin: "8px 0 0", fontWeight: 700, fontSize: "18px" }}>
        {value}
      </p>
    </div>
  );
}

function resultBadge(result) {
  if (result === "win") return { label: "WIN", color: "#10b981" };
  if (result === "lose") return { label: "LOSE", color: "#ef4444" };
  if (result === "void") return { label: "VOID", color: "#f59e0b" };
  return { label: "PENDING", color: "#64748b" };
}

function actionButtonStyle() {
  return {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  };
}

export default function BetHistory() {
  const { bets, updateResult, removeBet, clearBets } = useBetStore();
  const stats = getBetStats(bets);

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Stat label="Staked" value={`€${stats.totalStaked.toFixed(2)}`} />
        <Stat label="Profit" value={`€${stats.totalProfit.toFixed(2)}`} />
        <Stat label="ROI" value={`${stats.roi.toFixed(2)}%`} />
        <Stat label="W/L" value={`${stats.wins}/${stats.losses}`} />
        <Stat label="Pending" value={stats.pending} />
        <Stat label="Void" value={stats.voids} />
      </div>

      <ProfitChart bets={bets} />

      {bets.length > 0 ? (
        <div>
          <button type="button" onClick={clearBets} style={actionButtonStyle()}>
            Clear All Bets
          </button>
        </div>
      ) : null}

      {bets.length === 0 ? (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(0,0,0,0.2)",
            borderRadius: "16px",
            padding: "16px",
            color: "#94a3b8",
          }}
        >
          No bets added yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {[...bets].reverse().map((bet) => {
            const badge = resultBadge(bet.result);

            return (
              <div
                key={bet.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "16px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>{bet.match}</p>
                    <p style={{ margin: "8px 0 0", color: "#cbd5e1", fontSize: "14px" }}>
                      {bet.selection}
                    </p>
                    <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: "14px" }}>
                      Odds {bet.odds} • Stake €{Number(bet.stake).toFixed(2)}
                    </p>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        display: "inline-block",
                        border: `1px solid ${badge.color}55`,
                        background: `${badge.color}22`,
                        color: "#fff",
                        borderRadius: "999px",
                        padding: "6px 10px",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {badge.label}
                    </div>
                    <p
                      style={{
                        margin: "10px 0 0",
                        fontWeight: 700,
                        color:
                          bet.profit > 0
                            ? "#10b981"
                            : bet.profit < 0
                            ? "#ef4444"
                            : "#cbd5e1",
                      }}
                    >
                      Profit €{Number(bet.profit).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginTop: "14px",
                  }}
                >
                  <button type="button" onClick={() => updateResult(bet.id, "win")} style={actionButtonStyle()}>
                    Win
                  </button>
                  <button type="button" onClick={() => updateResult(bet.id, "lose")} style={actionButtonStyle()}>
                    Lose
                  </button>
                  <button type="button" onClick={() => updateResult(bet.id, "void")} style={actionButtonStyle()}>
                    Void
                  </button>
                  <button type="button" onClick={() => updateResult(bet.id, "pending")} style={actionButtonStyle()}>
                    Pending
                  </button>
                  <button type="button" onClick={() => removeBet(bet.id)} style={actionButtonStyle()}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
