"use client";

import OddsMovementBadge from "@/app/components/OddsMovementBadge";

export default function MarketMovementPanel({
  market = "h2h",
  selectedMatch,
  movements,
  lang = "en",
}) {
  const title = lang === "fi" ? "Markkinaliike" : "Market Movement";
  const empty =
    lang === "fi"
      ? "Ei vielä riittävästi historiadataa liikkeen näyttämiseen."
      : "Not enough history yet to show movement.";

  if (!selectedMatch || !movements) {
    return (
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(0,0,0,0.2)",
          borderRadius: "16px",
          padding: "16px",
          color: "#94a3b8",
        }}
      >
        {empty}
      </div>
    );
  }

  const rows =
    market === "totals"
      ? [
          {
            label: `Over ${selectedMatch.bestOdds?.point ?? "-"}`,
            movement: movements.over,
          },
          {
            label: `Under ${selectedMatch.bestOdds?.point ?? "-"}`,
            movement: movements.under,
          },
        ]
      : market === "spreads"
      ? [
          {
            label: `${selectedMatch.home_team} ${selectedMatch.bestOdds?.spreadPointHome ?? ""}`,
            movement: movements.spreadHome,
          },
          {
            label: `${selectedMatch.away_team} ${selectedMatch.bestOdds?.spreadPointAway ?? ""}`,
            movement: movements.spreadAway,
          },
        ]
      : [
          { label: selectedMatch.home_team, movement: movements.home },
          { label: lang === "fi" ? "Tasapeli" : "Draw", movement: movements.draw },
          { label: selectedMatch.away_team, movement: movements.away },
        ];

  const hasMovement = rows.some((row) => row.movement?.delta != null);

  if (!hasMovement) {
    return (
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(0,0,0,0.2)",
          borderRadius: "16px",
          padding: "16px",
          color: "#94a3b8",
        }}
      >
        <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#fff" }}>{title}</p>
        <p style={{ margin: 0 }}>{empty}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      <p style={{ margin: 0, fontWeight: 700 }}>{title}</p>

      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(0,0,0,0.2)",
            borderRadius: "16px",
            padding: "14px",
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>{row.label}</p>
            <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#94a3b8" }}>
              {row.movement?.previous != null && row.movement?.current != null
                ? `${row.movement.previous} → ${row.movement.current}`
                : empty}
            </p>
          </div>

          <OddsMovementBadge movement={row.movement} lang={lang} />
        </div>
      ))}
    </div>
  );
}
