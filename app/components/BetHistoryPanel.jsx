"use client";

import {
  clearBetHistory,
  deleteBetFromHistory,
  getBetHistoryStats,
  getBetProfit,
  updateBetResult,
} from "@/lib/bet-history-store";

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "€0.00";
  return `€${n.toFixed(2)}`;
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(1)}%`;
}

function card(extra = {}) {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 18,
    background: "rgba(2,6,23,0.72)",
    ...extra,
  };
}

function smallButton(color = "neutral") {
  const styles = {
    neutral: {
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.08)",
      color: "#fff",
    },
    green: {
      border: "1px solid rgba(34,197,94,0.45)",
      background: "rgba(34,197,94,0.14)",
      color: "#bbf7d0",
    },
    red: {
      border: "1px solid rgba(239,68,68,0.45)",
      background: "rgba(127,29,29,0.22)",
      color: "#fecaca",
    },
    yellow: {
      border: "1px solid rgba(245,158,11,0.45)",
      background: "rgba(245,158,11,0.12)",
      color: "#fde68a",
    },
  };

  return {
    ...styles[color],
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 900,
    cursor: "pointer",
  };
}

export default function BetHistoryPanel({ bets = [], setBets }) {
  const stats = getBetHistoryStats(bets);

  function setResult(id, result) {
    setBets(updateBetResult(id, result));
  }

  function removeBet(id) {
    setBets(deleteBetFromHistory(id));
  }

  function clearAll() {
    setBets(clearBetHistory());
  }

  return (
    <section style={card()}>
      <h2 style={{ marginTop: 0 }}>Bet history / tulosseuranta</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <Stat label="Vetoja" value={stats.totalBets} />
        <Stat label="Avoinna" value={stats.openBets} />
        <Stat label="Profit" value={money(stats.profit)} good={stats.profit >= 0} />
        <Stat label="ROI" value={pct(stats.roi)} good={stats.roi >= 0} />
        <Stat label="Hit rate" value={pct(stats.hitRate)} />
        <Stat label="Avg odds" value={stats.averageOdds.toFixed(2)} />
      </div>

      {bets.length === 0 ? (
        <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>
          Ei tallennettuja vetoja. Lisää veto kuponkiin ja paina “Tallenna historiaan”.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {bets.map((bet) => {
            const profit = getBetProfit(bet);

            return (
              <div
                key={bet.id}
                style={card({
                  background: "rgba(255,255,255,0.04)",
                  padding: 14,
                })}
              >
                <div style={{ fontWeight: 900, fontSize: 19 }}>{bet.label}</div>

                <div style={{ color: "#94a3b8", marginTop: 4, lineHeight: 1.5 }}>
                  {bet.match?.home_team} vs {bet.match?.away_team}
                  <br />
                  {bet.market} · {bet.bookmaker}
                </div>

                <div style={{ marginTop: 8, lineHeight: 1.6 }}>
                  Kerroin: <b>{bet.odds}</b> · Panos: <b>{money(bet.stake)}</b>
                  <br />
                  Tulos: <b>{bet.result}</b> · Profit:{" "}
                  <b style={{ color: profit >= 0 ? "#86efac" : "#fca5a5" }}>
                    {money(profit)}
                  </b>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 12,
                  }}
                >
                  <button type="button" onClick={() => setResult(bet.id, "won")} style={smallButton("green")}>
                    Won
                  </button>

                  <button type="button" onClick={() => setResult(bet.id, "lost")} style={smallButton("red")}>
                    Lost
                  </button>

                  <button type="button" onClick={() => setResult(bet.id, "push")} style={smallButton("yellow")}>
                    Push
                  </button>

                  <button type="button" onClick={() => setResult(bet.id, "void")} style={smallButton("neutral")}>
                    Void
                  </button>

                  <button type="button" onClick={() => setResult(bet.id, "pending")} style={smallButton("neutral")}>
                    Pending
                  </button>

                  <button type="button" onClick={() => removeBet(bet.id)} style={smallButton("red")}>
                    Poista
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={clearAll}
            style={{
              width: "100%",
              border: "1px solid rgba(239,68,68,0.45)",
              background: "rgba(127,29,29,0.22)",
              color: "#fecaca",
              borderRadius: 16,
              padding: 14,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Tyhjennä historia
          </button>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, good = false }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 12,
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>
        {label}
      </div>

      <div
        style={{
          color: good ? "#86efac" : "#fff",
          fontWeight: 900,
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}
