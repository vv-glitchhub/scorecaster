"use client";

import { getAllMovements } from "@/lib/odds-history-store";

function card(extra = {}) {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 18,
    background: "rgba(2,6,23,0.72)",
    maxWidth: "100%",
    overflow: "hidden",
    ...extra,
  };
}

function pct(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function MovementRow({ label, movement }) {
  if (!movement) return null;

  const color =
    movement.direction === "up"
      ? "#86efac"
      : movement.direction === "down"
      ? "#fca5a5"
      : "#cbd5e1";

  const arrow =
    movement.direction === "up"
      ? "↑"
      : movement.direction === "down"
      ? "↓"
      : "→";

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

      <div style={{ color, fontWeight: 900, marginTop: 4 }}>
        {movement.first.toFixed(2)} → {movement.latest.toFixed(2)} {arrow}
      </div>

      <div style={{ color: "#94a3b8", marginTop: 4, fontSize: 13 }}>
        Muutos {pct(movement.changePct)} · snapshotteja {movement.snapshots}
      </div>
    </div>
  );
}

export default function LineMovementPanel({ match }) {
  if (!match) return null;

  const movements = getAllMovements(match);
  const hasMovement = Object.values(movements).some(Boolean);

  return (
    <section style={card()}>
      <h2 style={{ marginTop: 0 }}>Line movement</h2>

      {!hasMovement ? (
        <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>
          Ei vielä tarpeeksi historiaa. Paina myöhemmin uudelleen “Hae pelit”, niin appi vertaa
          vanhaa ja uutta kerrointa.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <MovementRow label="Koti / ML" movement={movements.home} />
          <MovementRow label="Tasapeli" movement={movements.draw} />
          <MovementRow label="Vieras / ML" movement={movements.away} />
          <MovementRow label="Over" movement={movements.over} />
          <MovementRow label="Under" movement={movements.under} />
          <MovementRow label="Koti handicap" movement={movements.spreadHome} />
          <MovementRow label="Vieras handicap" movement={movements.spreadAway} />
        </div>
      )}
    </section>
  );
}
