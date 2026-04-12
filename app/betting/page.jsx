import PageSection from "@/app/components/PageSection";
import { getBaseUrl } from "@/lib/app-url";

async function getOdds() {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/api/odds?sport=icehockey_liiga`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return { matches: [], source: "unknown", cached: false };
    }

    return res.json();
  } catch {
    return { matches: [], source: "unknown", cached: false };
  }
}

async function getTopPicks() {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetch(
      `${baseUrl}/api/top-picks?sport=icehockey_liiga&limit=8`,
      {
        cache: "no-store",
      }
    );

    if (!res.ok) {
      return { picks: [], source: "unknown", cached: false };
    }

    return res.json();
  } catch {
    return { picks: [], source: "unknown", cached: false };
  }
}

async function getModelAnalysis(matchId) {
  try {
    const baseUrl = getBaseUrl();
    const url = matchId
      ? `${baseUrl}/api/model-analysis-v1?sport=icehockey_liiga&matchId=${matchId}`
      : `${baseUrl}/api/model-analysis-v1?sport=icehockey_liiga`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch {
    return null;
  }
}

export default async function BettingPage() {
  const oddsData = await getOdds();
  const matches = oddsData?.matches || [];
  const selectedMatch = matches[0] || null;

  const [topPicksData, analysisData] = await Promise.all([
    getTopPicks(),
    getModelAnalysis(selectedMatch?.id),
  ]);

  const topPicks = topPicksData?.picks || [];
  const valueBets = analysisData?.valueBets || [];
  const model = analysisData?.model || null;

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section
        style={{
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "24px",
          padding: "32px",
        }}
      >
        <p
          style={{
            margin: "0 0 12px",
            fontSize: "12px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#6ee7b7",
            fontWeight: 700,
          }}
        >
          Betting Workspace
        </p>
        <h1 style={{ margin: 0, fontSize: "36px", lineHeight: 1.1 }}>
          Full betting analysis, odds comparison and value bet workflow.
        </h1>
        <p style={{ marginTop: "16px", color: "#cbd5e1" }}>
          Tälle sivulle jää kaikki raskas analyysi. Myöhemmin tähän voi lisätä
          live bets, props, totals, handicap-markkinat ja lisää ranking-logiikkaa.
        </p>
      </section>

      <div
        style={{
          display: "grid",
          gap: "24px",
          gridTemplateColumns: "1.1fr 1.5fr 1fr",
        }}
      >
        <div style={{ display: "grid", gap: "24px" }}>
          <PageSection
            title="Filters"
            description="Sport / league / market controls can expand here."
          >
            <div style={{ display: "grid", gap: "12px" }}>
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "16px",
                  padding: "16px",
                }}
              >
                <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Sport</p>
                <p style={{ margin: "8px 0 0", fontWeight: 700 }}>Ice Hockey</p>
              </div>

              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "16px",
                  padding: "16px",
                }}
              >
                <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>League</p>
                <p style={{ margin: "8px 0 0", fontWeight: 700 }}>Liiga</p>
              </div>

              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "16px",
                  padding: "16px",
                }}
              >
                <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Market</p>
                <p style={{ margin: "8px 0 0", fontWeight: 700 }}>H2H</p>
              </div>
            </div>
          </PageSection>

          <PageSection
            title="Matches"
            description="Available matches for the selected sport."
          >
            <div style={{ display: "grid", gap: "12px" }}>
              {matches.length === 0 ? (
                <div
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: "16px",
                    padding: "16px",
                    color: "#94a3b8",
                    fontSize: "14px",
                  }}
                >
                  No matches found.
                </div>
              ) : (
                matches.map((match) => (
                  <div
                    key={match.id}
                    style={{
                      border:
                        selectedMatch?.id === match.id
                          ? "1px solid rgba(16,185,129,0.7)"
                          : "1px solid rgba(255,255,255,0.1)",
                      background:
                        selectedMatch?.id === match.id
                          ? "rgba(16,185,129,0.12)"
                          : "rgba(0,0,0,0.2)",
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 700 }}>
                      {match.home_team} vs {match.away_team}
                    </p>
                    <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#94a3b8" }}>
                      {match.sport_title}
                    </p>
                  </div>
                ))
              )}
            </div>
          </PageSection>
        </div>

        <div style={{ display: "grid", gap: "24px" }}>
          <PageSection
            title="Selected Match Analysis"
            description="Main match view, best odds and model output."
          >
            {!selectedMatch ? (
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "16px",
                  padding: "16px",
                  color: "#94a3b8",
                  fontSize: "14px",
                }}
              >
                No selected match.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "16px" }}>
                <div
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: "16px",
                    padding: "16px",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>
                    {selectedMatch.home_team} vs {selectedMatch.away_team}
                  </p>
                  <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#94a3b8" }}>
                    {selectedMatch.sport_title}
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "16px",
                    gridTemplateColumns: "repeat(3, 1fr)",
                  }}
                >
                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Home odds</p>
                    <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                      {selectedMatch.bestOdds?.home ?? "-"}
                    </p>
                  </div>

                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Draw odds</p>
                    <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                      {selectedMatch.bestOdds?.draw ?? "-"}
                    </p>
                  </div>

                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Away odds</p>
                    <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                      {selectedMatch.bestOdds?.away ?? "-"}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "16px",
                    gridTemplateColumns: "repeat(4, 1fr)",
                  }}
                >
                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Model Home</p>
                    <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                      {model ? `${(model.home * 100).toFixed(1)}%` : "-"}
                    </p>
                  </div>

                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Model Draw</p>
                    <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                      {model ? `${(model.draw * 100).toFixed(1)}%` : "-"}
                    </p>
                  </div>

                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Model Away</p>
                    <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                      {model ? `${(model.away * 100).toFixed(1)}%` : "-"}
                    </p>
                  </div>

                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Confidence</p>
                    <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                      {model ? `${model.confidence}%` : "-"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </PageSection>

          <PageSection
            title="Value Bets"
            description="Model edge versus current best odds."
          >
            <div style={{ display: "grid", gap: "12px" }}>
              {valueBets.length === 0 ? (
                <div
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: "16px",
                    padding: "16px",
                    color: "#94a3b8",
                    fontSize: "14px",
                  }}
                >
                  No value bet rows available.
                </div>
              ) : (
                valueBets.map((row) => (
                  <div
                    key={`${row.side}-${row.team}`}
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontWeight: 700 }}>
                          {row.side} • {row.team}
                        </p>
                        <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#94a3b8" }}>
                          Bookmaker: {row.bookmaker || "-"}
                        </p>
                      </div>

                      <div style={{ textAlign: "right", fontSize: "14px" }}>
                        <p style={{ margin: 0 }}>Odds {row.odds}</p>
                        <p style={{ margin: "6px 0 0", color: "#cbd5e1" }}>
                          Fair {row.fairOdds}
                        </p>
                        <p
                          style={{
                            margin: "6px 0 0",
                            color: row.edgePct > 0 ? "#6ee7b7" : "#fda4af",
                          }}
                        >
                          EV {row.edgePct}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </PageSection>
        </div>

        <div style={{ display: "grid", gap: "24px" }}>
          <PageSection
            title="Backend Top Picks"
            description="Ranked value opportunities."
          >
            <div style={{ display: "grid", gap: "12px" }}>
              {topPicks.length === 0 ? (
                <div
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: "16px",
                    padding: "16px",
                    color: "#94a3b8",
                    fontSize: "14px",
                  }}
                >
                  No backend picks available.
                </div>
              ) : (
                topPicks.map((pick) => (
                  <div
                    key={`${pick.matchId}-${pick.selection}`}
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 700 }}>
                      {pick.selection} @ {pick.odds}
                    </p>
                    <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#94a3b8" }}>
                      {pick.home_team} vs {pick.away_team}
                    </p>
                    <p style={{ margin: "10px 0 0", fontSize: "14px", color: "#6ee7b7" }}>
                      EV {pick.edgePct}% • Confidence {pick.confidence}%
                    </p>
                  </div>
                ))
              )}
            </div>
          </PageSection>

          <PageSection
            title="Bankroll"
            description="Placeholder for staking and Kelly logic."
          >
            <div style={{ display: "grid", gap: "12px" }}>
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "16px",
                  padding: "16px",
                }}
              >
                <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Bankroll</p>
                <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                  €1,000
                </p>
              </div>

              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "16px",
                  padding: "16px",
                }}
              >
                <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Staking model</p>
                <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                  Quarter Kelly
                </p>
              </div>
            </div>
          </PageSection>
        </div>
      </div>
    </div>
  );
}
