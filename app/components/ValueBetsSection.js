"use client";

import { useEffect, useState } from "react";

export default function ValueBetsSection() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/value-bets");
        const data = await res.json();
        setBets(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function getColor(ev) {
    if (ev > 1.1) return "#00ff9f";   // 🔥 strong value
    if (ev > 1.05) return "#00d4ff";  // 👍 decent
    if (ev > 1.0) return "#ffaa00";   // ⚠️ small edge
    return "#666";                    // ❌ no value
  }

  function getLabel(ev) {
    if (ev > 1.1) return "🔥 BEST BET";
    if (ev > 1.05) return "VALUE";
    if (ev > 1.0) return "MARGINAL";
    return "NO EDGE";
  }

  if (loading) return <div>Loading value bets...</div>;
  if (!bets.length) return <div>No value bets found</div>;

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ marginBottom: 16 }}>💰 Value Bets</h2>

      <div style={{ display: "grid", gap: 12 }}>
        {bets.map((bet) => {
          const color = getColor(bet.best_ev);

          return (
            <div
              key={bet.id}
              style={{
                border: `1px solid ${color}`,
                borderRadius: 12,
                padding: 14,
                background: "#0f172a",
              }}
            >
              {/* HEADER */}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700 }}>
                  {bet.home_team} vs {bet.away_team}
                </div>

                <div
                  style={{
                    color,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {getLabel(bet.best_ev)}
                </div>
              </div>

              {/* MAIN */}
              <div style={{ marginTop: 8, fontSize: 18 }}>
                {bet.recommendation}
              </div>

              {/* STATS */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 10,
                  fontSize: 14,
                  opacity: 0.8,
                }}
              >
                <div>Odds: {bet.best_odds}</div>
                <div style={{ color }}>
                  EV: {bet.best_ev?.toFixed(2)}
                </div>
              </div>

              {/* CONFIDENCE */}
              <div style={{ marginTop: 6, fontSize: 13 }}>
                Confidence: {bet.confidence}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
