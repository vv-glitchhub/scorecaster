import PageSection from "@/app/components/PageSection";
import { getOddsData } from "@/lib/odds-service";
import {
  buildValueBetRows,
  getModelProbabilitiesForMatch,
} from "@/lib/model-engine-v1";

async function getBettingPageData() {
  try {
    const oddsData = await getOddsData({ sport: "icehockey_liiga" });
    const matches = oddsData?.matches || [];
    const selectedMatch = matches[0] || null;

    let model = null;
    let valueBets = [];
    let topPicks = [];

    if (selectedMatch) {
      model = getModelProbabilitiesForMatch(selectedMatch);
      valueBets = buildValueBetRows(selectedMatch, model);
    }

    topPicks = matches
      .flatMap((match) => {
        const matchModel = getModelProbabilitiesForMatch(match);
        return buildValueBetRows(match, matchModel).map((row) => ({
          matchId: match.id,
          home_team: match.home_team,
          away_team: match.away_team,
          selection: row.side,
          team: row.team,
          odds: row.odds,
          edgePct: row.edgePct,
          expectedValue: row.expectedValue,
          confidence: matchModel.confidence,
        }));
      })
      .filter((pick) => pick.expectedValue > 0)
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .slice(0, 8);

    return {
      oddsData,
      matches,
      selectedMatch,
      model,
      valueBets,
      topPicks,
    };
  } catch {
    return {
      oddsData: { matches: [], source: "unknown", cached: false },
      matches: [],
      selectedMatch: null,
      model: null,
      valueBets: [],
      topPicks: [],
    };
  }
}

export default async function BettingPage() {
  const { matches, selectedMatch, model, valueBets, topPicks } =
    await getBettingPageData();

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
                <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>
                  Sport
                </p>
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
                <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>
                  League
                </p>
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
                <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>
                  Market
                </p>
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
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: "14px",
                        color: "#94a3b8",
                      }}
                    >
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
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "16px",
                    gridTemplateColumns: "repeat(3, 1fr)",
                  }}
                >
                  <div style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", borderRadius: "16px", padding: "16px" }}>
                    <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Home odds</p>
                    <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                      {selectedMatch.bestOdds?.home ?? "-"}
                    </p>
                  </div>

                  <div style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", borderRadius: "16px", padding: "16px" }}>
                    <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Draw odds</p>
                    <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                      {selectedMatch.bestOdds?.draw ?? "-"}
                    </p>
                  </div>

                  <div style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", borderRadius: "16px", padding: "16px" }}>
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
                  <div style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", borderRadius: "16px", padding: "16px" }}>
                    <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Model Home</p>
                    <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                      {model ? `${(model.home * 100).toFixed(1)}%` : "-"}
                    </p>
                  </div>

                  <div style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", borderRadius: "16px", padding: "16px" }}>
                    <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Model Draw</p>
                    <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                      {model ? `${(model.draw * 100).toFixed(1)}%` : "-"}
                    </p>
                  </div>

                  <div style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", borderRadius: "16px", padding: "16px" }}>
                    <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Model Away</p>
                    <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                      {model ? `${(model.away * 100).toFixed(1)}%` : "-"}
                    </p>
                  </div>

                  <div style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", borderRadius: "16px", padding: "16px" }}>
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
                <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>
                  Bankroll
                </p>
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
                <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>
                  Staking model
                </p>
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
