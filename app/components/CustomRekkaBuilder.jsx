"use client";

import { getParlaySummary } from "@/lib/bookmaker-odds";

export default function CustomRekkaBuilder({
  picks,
  onRemove,
  onClear,
}) {
  const summary = getParlaySummary(picks);

  return (
    <section
      style={{
        marginTop: 40,
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 30,
        padding: 28,
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#86efac",
              fontWeight: 900,
              marginBottom: 8,
            }}
          >
            OMA REKKA
          </div>

          <h2
            style={{
              fontSize: 34,
              fontWeight: 950,
              margin: 0,
            }}
          >
            Rakenna oma yhdistelmä
          </h2>
        </div>

        <button
          onClick={onClear}
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            background: "transparent",
            color: "#fff",
            borderRadius: 18,
            padding: "12px 18px",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Tyhjennä
        </button>
      </div>

      {picks.length === 0 ? (
        <p
          style={{
            marginTop: 22,
            color: "#94a3b8",
            fontWeight: 700,
          }}
        >
          Lisää kohteita top value -listasta.
        </p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gap: 14,
              marginTop: 22,
            }}
          >
            {picks.map((pick) => (
              <div
                key={pick.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 20,
                  padding: 18,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    fontWeight: 950,
                    fontSize: 18,
                  }}
                >
                  {pick.match.home_team} vs{" "}
                  {pick.match.away_team}
                </div>

                <div
                  style={{
                    marginTop: 6,
                    color: "#86efac",
                    fontWeight: 900,
                  }}
                >
                  {pick.selection} @ {pick.odds}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    color: "#94a3b8",
                    lineHeight: 1.5,
                    fontWeight: 700,
                  }}
                >
                  Edge {(pick.edge * 100).toFixed(1)}% ·
                  Luottamus {pick.confidence.toFixed(0)}/100
                </div>

                <button
                  onClick={() => onRemove(pick.id)}
                  style={{
                    marginTop: 14,
                    border: "1px solid rgba(239,68,68,0.35)",
                    background: "rgba(239,68,68,0.12)",
                    color: "#fff",
                    borderRadius: 14,
                    padding: "10px 14px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Poista
                </button>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 26,
              border: "1px solid rgba(34,197,94,0.30)",
              background: "rgba(34,197,94,0.10)",
              borderRadius: 24,
              padding: 22,
            }}
          >
            <div
              style={{
                color: "#94a3b8",
                fontWeight: 800,
              }}
            >
              REKAN KOKONAISKERROIN
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 62,
                fontWeight: 950,
                lineHeight: 1,
              }}
            >
              {summary.totalOdds.toFixed(2)}
            </div>

            <div
              style={{
                marginTop: 10,
                color: "#86efac",
                fontWeight: 900,
              }}
            >
              Keskimääräinen edge{" "}
              {(summary.avgEdge * 100).toFixed(1)}%
            </div>
          </div>
        </>
      )}
    </section>
  );
}
