import Link from "next/link";
import PageSection from "@/app/components/PageSection";
import { getBaseUrl } from "@/lib/app-url";

async function getTopPicks() {
  try {
    const baseUrl = getBaseUrl();

    const res = await fetch(
      `${baseUrl}/api/top-picks?sport=icehockey_liiga&limit=3`,
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

async function getOddsPreview() {
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

export default async function HomePage() {
  const [topPicksData, oddsData] = await Promise.all([
    getTopPicks(),
    getOddsPreview(),
  ]);

  const topPicks = topPicksData?.picks || [];
  const previewMatch = oddsData?.matches?.[0] || null;

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section
        style={{
          border: "1px solid rgba(16,185,129,0.25)",
          borderRadius: "24px",
          padding: "32px",
          background:
            "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(34,211,238,0.10))",
        }}
      >
        <div style={{ maxWidth: "760px" }}>
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
            Scorecaster Dashboard
          </p>

          <h1 style={{ margin: 0, fontSize: "42px", lineHeight: 1.1 }}>
            Clearer home view, dedicated betting workspace, dedicated simulator.
          </h1>

          <p style={{ marginTop: "16px", color: "#cbd5e1", fontSize: "16px" }}>
            Dashboard näyttää vain tärkeimmät asiat nopeasti. Raskas analyysi on
            betting-sivulla ja simulaatiot simulator-sivulla.
          </p>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "24px",
            }}
          >
            <Link
              href="/betting"
              style={{
                background: "#10b981",
                color: "#000",
                padding: "14px 18px",
                borderRadius: "16px",
                fontWeight: 700,
              }}
            >
              Open Betting Workspace
            </Link>

            <Link
              href="/simulator"
              style={{
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
                padding: "14px 18px",
                borderRadius: "16px",
                fontWeight: 700,
              }}
            >
              Open Simulator
            </Link>
          </div>
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gap: "24px",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <PageSection
          title="Top Picks"
          description="Best backend-ranked value spots right now."
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
                No top picks available.
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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 700 }}>
                        {pick.home_team} vs {pick.away_team}
                      </p>
                      <p
                        style={{
                          margin: "6px 0 0",
                          color: "#94a3b8",
                          fontSize: "14px",
                        }}
                      >
                        {pick.selection} • {pick.team}
                      </p>
                    </div>

                    <div style={{ textAlign: "right", fontSize: "14px" }}>
                      <p style={{ margin: 0, color: "#6ee7b7" }}>
                        EV {pick.edgePct}%
                      </p>
                      <p style={{ margin: "6px 0 0", color: "#cbd5e1" }}>
                        Odds {pick.odds}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </PageSection>

        <PageSection
          title="Data Source Status"
          description="Quick source and cache visibility."
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
                Odds source
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                {oddsData?.source || "unknown"}
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
                Cache status
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                {oddsData?.cached ? "cached" : "fresh"}
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
                Matches loaded
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                {oddsData?.matches?.length || 0}
              </p>
            </div>
          </div>
        </PageSection>

        <PageSection
          title="Simulator Preview"
          description="Quick look before opening the simulator."
        >
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(0,0,0,0.2)",
              borderRadius: "16px",
              padding: "16px",
            }}
          >
            <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>
              Next step
            </p>
            <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
              Run tournament / season simulations separately
            </p>
            <p style={{ marginTop: "12px", fontSize: "14px", color: "#cbd5e1" }}>
              Keep simulation logic isolated so betting workspace stays focused.
            </p>

            <Link
              href="/simulator"
              style={{
                display: "inline-block",
                marginTop: "16px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                padding: "10px 14px",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Go to simulator
            </Link>
          </div>
        </PageSection>
      </div>

      <PageSection
        title="Match Preview"
        description="Lightweight preview on the dashboard."
      >
        {!previewMatch ? (
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
            No match preview available.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "16px",
              gridTemplateColumns: "2fr 1fr",
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
              <p style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>
                {previewMatch.home_team} vs {previewMatch.away_team}
              </p>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#94a3b8",
                }}
              >
                {previewMatch.sport_title}
              </p>
              <p style={{ marginTop: "16px", fontSize: "14px", color: "#cbd5e1" }}>
                Dashboard näyttää vain kevyen preview’n. Täysi analyysi löytyy
                betting-sivulta.
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
                Best odds
              </p>

              <div
                style={{
                  marginTop: "12px",
                  display: "grid",
                  gap: "8px",
                  fontSize: "14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#cbd5e1" }}>Home</span>
                  <span>{previewMatch.bestOdds?.home ?? "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#cbd5e1" }}>Draw</span>
                  <span>{previewMatch.bestOdds?.draw ?? "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#cbd5e1" }}>Away</span>
                  <span>{previewMatch.bestOdds?.away ?? "-"}</span>
                </div>
              </div>

              <Link
                href="/betting"
                style={{
                  display: "inline-block",
                  marginTop: "16px",
                  background: "#10b981",
                  color: "#000",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                Open full betting analysis
              </Link>
            </div>
          </div>
        )}
      </PageSection>
    </div>
  );
}
