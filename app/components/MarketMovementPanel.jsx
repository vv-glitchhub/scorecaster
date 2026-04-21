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

  const panelStyle = {
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "16px",
    padding: "16px",
    background: "rgba(0,0,0,0.2)",
  };

  if (!selectedMatch || !movements) {
    return (
      <div style={panelStyle}>
        <div style={{ fontWeight: 800, fontSize: "18px", marginBottom: "12px" }}>
          {title}
        </div>
        <div style={{ color: "#94a3b8", fontSize: "14px" }}>{empty}</div>
      </div>
    );
  }

  const rows =
    market === "totals"
      ? [
          {
            label: `Over ${selectedMatch?.bestOdds?.point ?? "-"}`,
            movement: movements.over,
          },
          {
            label: `Under ${selectedMatch?.bestOdds?.point ?? "-"}`,
            movement: movements.under,
          },
        ]
      : market === "spreads"
      ? [
          {
            label: `${selectedMatch?.home_team || "Home"} ${
              selectedMatch?.bestOdds?.spreadPointHome ?? ""
            }`,
            movement: movements.spreadHome,
          },
          {
            label: `${selectedMatch?.away_team || "Away"} ${
              selectedMatch?.bestOdds?.spreadPointAway ?? ""
            }`,
            movement: movements.spreadAway,
          },
        ]
      : [
          {
            label: selectedMatch?.home_team || "Home",
            movement: movements.home,
          },
          {
            label: lang === "fi" ? "Tasapeli" : "Draw",
            movement: movements.draw,
          },
          {
            label: selectedMatch?.away_team || "Away",
            movement: movements.away,
          },
        ];

  const hasMovement = rows.some((row) => row.movement?.delta != null);

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 800, fontSize: "18px", marginBottom: "12px" }}>
        {title}
      </div>

      {!hasMovement ? (
        <div style={{ color: "#94a3b8", fontSize: "14px" }}>{empty}</div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "10px",
          }}
        >
          {rows.map((row) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    color: "#ffffff",
                    fontSize: "14px",
                  }}
                >
                  {row.label}
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  {row.movement?.previous != null && row.movement?.current != null
                    ? `${row.movement.previous} → ${row.movement.current}`
                    : empty}
                </div>
              </div>

              <OddsMovementBadge movement={row.movement} lang={lang} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
