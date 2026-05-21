"use client";

import { buildParlaySuggestions } from "@/lib/parlay-engine-v2";

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `€${n.toFixed(2)}` : "€0.00";
}

export default function ParlayBuilderPanel({ picks = [], bankroll = 1000, onAddMany }) {
  const suggestions = buildParlaySuggestions(picks, bankroll);

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
      <h2 style={{ marginTop: 0 }}>AI Rekka Builder</h2>

      {suggestions.length === 0 ? (
        <div style={{ color: "#94a3b8" }}>
          Ei järkevää rekkaehdotusta nykyisistä pickeistä.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {suggestions.map((combo, index) => (
            <div
              key={index}
              style={{
                border: "1px solid rgba(34,197,94,0.25)",
                borderRadius: 16,
                padding: 14,
                background: "rgba(34,197,94,0.08)",
              }}
            >
              <b>Rekka #{index + 1}</b>

              <div style={{ marginTop: 8, lineHeight: 1.6 }}>
                {combo.picks.map((p) => (
                  <div key={p.id || p.key}>• {p.label} @ {p.odds}</div>
                ))}
              </div>

              <div style={{ marginTop: 10, color: "#86efac", fontWeight: 900 }}>
                Kerroin {combo.analysis.combinedOdds.toFixed(2)} · EV{" "}
                {combo.analysis.ev.toFixed(2)} · Panos {money(combo.analysis.suggestedStake)}
              </div>

              <button
                type="button"
                onClick={() => onAddMany?.(combo.picks)}
                style={{
                  marginTop: 12,
                  width: "100%",
                  border: "1px solid rgba(34,197,94,0.55)",
                  background: "rgba(34,197,94,0.15)",
                  color: "#fff",
                  borderRadius: 14,
                  padding: 12,
                  fontWeight: 900,
                }}
              >
                Lisää rekka kuponkiin
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
