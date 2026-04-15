"use client";

export default function OddsMovementBadge({ movement, lang = "en" }) {
  if (!movement || movement.delta == null) {
    return (
      <span
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          color: "#cbd5e1",
          borderRadius: "999px",
          padding: "6px 10px",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        {lang === "fi" ? "Ei muutosta" : "No change"}
      </span>
    );
  }

  const isUp = movement.direction === "up";
  const isDown = movement.direction === "down";

  const border = isUp
    ? "1px solid rgba(34,197,94,0.35)"
    : isDown
    ? "1px solid rgba(239,68,68,0.35)"
    : "1px solid rgba(255,255,255,0.12)";

  const background = isUp
    ? "rgba(34,197,94,0.08)"
    : isDown
    ? "rgba(239,68,68,0.08)"
    : "rgba(255,255,255,0.06)";

  const color = isUp ? "#bbf7d0" : isDown ? "#fecaca" : "#cbd5e1";
  const arrow = isUp ? "↑" : isDown ? "↓" : "→";
  const label =
    lang === "fi"
      ? `Muutos ${arrow} ${movement.delta > 0 ? "+" : ""}${movement.delta}`
      : `Move ${arrow} ${movement.delta > 0 ? "+" : ""}${movement.delta}`;

  return (
    <span
      style={{
        border,
        background,
        color,
        borderRadius: "999px",
        padding: "6px 10px",
        fontSize: "12px",
        fontWeight: 700,
      }}
      title={`Prev ${movement.previous ?? "-"} → Now ${movement.current ?? "-"}`}
    >
      {label}
    </span>
  );
}
