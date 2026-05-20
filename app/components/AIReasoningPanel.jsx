"use client";

export default function AIReasoningPanel({
  pick,
  movement,
}) {
  if (!pick) return null;

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
        AI Betting Assistant
      </h2>

      <div
        style={{
          color: "#94a3b8",
          lineHeight: 1.7,
        }}
      >
        AI believes there is value on:
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 20,
          fontWeight: 900,
        }}
      >
        {pick.label}
      </div>

      <div style={{ marginTop: 12 }}>
        Odds: {pick.odds}
      </div>

      <div>
        Edge: {(pick.edge * 100).toFixed(1)}%
      </div>

      <div>
        EV: {pick.ev.toFixed(2)}
      </div>

      <div>
        Kelly: {(pick.kelly * 100).toFixed(1)}%
      </div>

      <div style={{ marginTop: 18 }}>
        <b>Model V3 reasoning:</b>
      </div>

      <ul
        style={{
          color: "#94a3b8",
          lineHeight: 1.7,
        }}
      >
        {(pick.reasons || []).map((reason) => (
          <li key={reason}>{reason}</li>
        ))}

        {movement ? (
          <li>
            Market movement detected:
            {" "}
            {movement.direction}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
