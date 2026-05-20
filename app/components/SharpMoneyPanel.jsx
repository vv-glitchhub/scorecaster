"use client";

import { detectSharpMoney } from "@/lib/sharp-money";

export default function SharpMoneyPanel({
  match,
}) {
  if (!match) return null;

  const sharp = detectSharpMoney(match);

  return (
    <section
      style={{
        border: sharp.detected
          ? "1px solid rgba(239,68,68,0.35)"
          : "1px solid rgba(255,255,255,0.10)",
        borderRadius: 22,
        padding: 18,
        background: sharp.detected
          ? "rgba(127,29,29,0.20)"
          : "rgba(2,6,23,0.72)",
        color: "#fff",
      }}
    >
      <h2 style={{ marginTop: 0 }}>
        Sharp Money Detection
      </h2>

      {sharp.detected ? (
        <>
          <div
            style={{
              color: "#fca5a5",
              fontWeight: 900,
            }}
          >
            Sharp movement detected
          </div>

          <div style={{ marginTop: 12 }}>
            Side:
            {" "}
            {sharp.direction}
          </div>

          <div>
            Strength:
            {" "}
            {(sharp.strength * 100).toFixed(1)}%
          </div>

          <div style={{ marginTop: 12 }}>
            {sharp.reason}
          </div>
        </>
      ) : (
        <div style={{ color: "#94a3b8" }}>
          No sharp market activity detected.
        </div>
      )}
    </section>
  );
}
