"use client";

import { calculateCLV } from "@/lib/clv-engine";

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "€0.00";
  return `€${n.toFixed(2)}`;
}

function pct(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export default function BetSlipPanel({
  picks = [],
  matches = [],
  onRemove,
  onClear,
  onStakeChange,
  onSaveToHistory,
}) {
  const totalStake = picks.reduce(
    (sum, p) => sum + Number(p.userStake || p.stake || 0),
    0
  );

  const potentialReturn = picks.reduce(
    (sum, p) => sum + Number(p.userStake || p.stake || 0) * Number(p.odds || 0),
    0
  );

  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 22,
        padding: 18,
        background: "rgba(2,6,23,0.72)",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Betslip / Kuponki</h2>

      {picks.length === 0 ? (
        <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>
          Ei vetoja kupongilla.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {picks.map((pick) => {
            const clv = calculateCLV(pick, matches);
            const clvColor =
              clv.status === "positive"
                ? "#86efac"
                : clv.status === "negative"
                ? "#fca5a5"
                : "#cbd5e1";

            return (
              <div
                key={pick.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 16,
                  padding: 14,
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 20 }}>{pick.label}</div>

                <div style={{ color: "#94a3b8", marginTop: 4 }}>
                  {pick.match?.home_team} vs {pick.match?.away_team}
                </div>

                <div style={{ marginTop: 8, lineHeight: 1.5 }}>
                  {pick.market} · Odds {pick.odds} · {pick.bookmaker || "Unknown"}
                </div>

                <div style={{ marginTop: 8, color: "#86efac", fontWeight: 900 }}>
                  Edge {(Number(pick.edge) * 100).toFixed(1)}% · EV{" "}
                  {Number(pick.ev).toFixed(2)}
                </div>

                <div
                  style={{
                    marginTop: 10,
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 14,
                    padding: 12,
                    background: "rgba(0,0,0,0.20)",
                  }}
                >
                  <div style={{ color: clvColor, fontWeight: 900 }}>
                    {clv.label}
                  </div>

                  <div style={{ color: "#cbd5e1", marginTop: 6, lineHeight: 1.5 }}>
                    Otettu kerroin: {clv.takenOdds || "-"}
                    <br />
                    Nykyinen kerroin: {clv.currentOdds || "-"}
                    <br />
                    Muutos: {clv.difference != null ? clv.difference.toFixed(2) : "-"} /{" "}
                    {clv.percentage != null ? pct(clv.percentage) : "-"}
                  </div>

                  <div style={{ color: "#94a3b8", marginTop: 6 }}>
                    {clv.message}
                  </div>
                </div>

                <label
                  style={{
                    display: "block",
                    marginTop: 10,
                    color: "#94a3b8",
                    fontWeight: 800,
                  }}
                >
                  Panos €
                </label>

                <input
                  value={pick.userStake ?? pick.stake ?? 0}
                  onChange={(e) => onStakeChange(pick.id, e.target.value)}
                  inputMode="decimal"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: 6,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.07)",
                    color: "#fff",
                    borderRadius: 14,
                    padding: 12,
                    fontSize: 16,
                    fontWeight: 800,
                  }}
                />

                <div style={{ marginTop: 8, color: "#86efac", fontWeight: 900 }}>
                  Mahdollinen palautus:{" "}
                  {money(Number(pick.userStake || pick.stake || 0) * Number(pick.odds || 0))}
                </div>

                <button
                  type="button"
                  onClick={() => onSaveToHistory?.(pick)}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    border: "1px solid rgba(34,197,94,0.45)",
                    background: "rgba(34,197,94,0.14)",
                    color: "#bbf7d0",
                    borderRadius: 14,
                    padding: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Tallenna historiaan
                </button>

                <button
                  type="button"
                  onClick={() => onRemove(pick.id)}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    border: "1px solid rgba(239,68,68,0.45)",
                    background: "rgba(127,29,29,0.22)",
                    color: "#fecaca",
                    borderRadius: 14,
                    padding: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Poista
                </button>
              </div>
            );
          })}

          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.10)",
              paddingTop: 12,
              display: "grid",
              gap: 6,
              fontWeight: 900,
            }}
          >
            <div>Kokonaispanos: {money(totalStake)}</div>
            <div style={{ color: "#86efac" }}>
              Mahdollinen palautus: {money(potentialReturn)}
            </div>
          </div>

          <button
            type="button"
            onClick={onClear}
            style={{
              width: "100%",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              borderRadius: 16,
              padding: 14,
              fontSize: 16,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Tyhjennä kuponki
          </button>
        </div>
      )}
    </section>
  );
}
