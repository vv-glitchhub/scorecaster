import Link from "next/link";
import PageSection from "@/app/components/PageSection";
import SourceBadge from "@/app/components/SourceBadge";
import { getBaseUrl } from "@/lib/app-url";
import { cookies } from "next/headers";
import { getDictionary, normalizeLang } from "@/lib/i18n";

async function getTopPicks() {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetch(
      `${baseUrl}/api/top-picks?sport=icehockey_liiga&limit=3`,
      { cache: "no-store" }
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
      return { matches: [], source: "unknown", cached: false, reason: "" };
    }

    return res.json();
  } catch {
    return { matches: [], source: "unknown", cached: false, reason: "" };
  }
}

function cardStyle() {
  return {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "20px",
    padding: "20px",
    background: "rgba(255,255,255,0.03)",
  };
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "fi");
  const t = getDictionary(lang);

  const [topPicksData, oddsData] = await Promise.all([
    getTopPicks(),
    getOddsPreview(),
  ]);

  const topPicks = Array.isArray(topPicksData?.picks) ? topPicksData.picks : [];
  const previewMatch = oddsData?.matches?.[0] || null;

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <PageSection
        eyebrow={t.dashboardEyebrow}
        title={t.dashboardTitle}
        subtitle={t.dashboardDescription}
      >
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/betting"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "48px",
              padding: "0 18px",
              borderRadius: "14px",
              textDecoration: "none",
              fontWeight: 800,
              background: "rgba(34,197,94,0.16)",
              border: "1px solid rgba(34,197,94,0.45)",
              color: "#dcfce7",
            }}
          >
            {t.openBettingWorkspace}
          </Link>

          <Link
            href="/simulator"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "48px",
              padding: "0 18px",
              borderRadius: "14px",
              textDecoration: "none",
              fontWeight: 800,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#ffffff",
            }}
          >
            {t.openSimulator}
          </Link>
        </div>
      </PageSection>

      <PageSection
        title={t.disclaimerTitle}
        subtitle={t.disclaimerDescription}
      >
        <div style={cardStyle()}>
          <div
            style={{
              color: "#94a3b8",
              fontSize: "16px",
              lineHeight: 1.7,
            }}
          >
            {t.disclaimerText}
          </div>
        </div>
      </PageSection>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 0.95fr)",
          gap: "16px",
        }}
      >
        <div style={cardStyle()}>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 900,
              color: "#ffffff",
              marginBottom: "8px",
            }}
          >
            {t.topPicks}
          </div>

          <div
            style={{
              color: "#94a3b8",
              fontSize: "15px",
              lineHeight: 1.6,
              marginBottom: "16px",
            }}
          >
            {t.topPicksDescription}
          </div>

          {topPicks.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: "14px" }}>{t.noTopPicks}</div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {topPicks.map((pick, index) => (
                <div
                  key={`${pick.match_id || pick.home_team}-${pick.team}-${index}`}
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    padding: "14px",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      color: "#ffffff",
                      fontSize: "15px",
                    }}
                  >
                    {pick.home_team} vs {pick.away_team}
                  </div>

                  <div
                    style={{
                      marginTop: "6px",
                      color: "#94a3b8",
                      fontSize: "13px",
                    }}
                  >
                    {t.selection}: {pick.selection} • {pick.team}
                  </div>

                  <div
                    style={{
                      marginTop: "10px",
                      display: "flex",
                      gap: "12px",
                      flexWrap: "wrap",
                      fontSize: "13px",
                      color: "#dbe4f0",
                    }}
                  >
                    <span>Odds {pick.odds ?? "-"}</span>
                    <span>{t.edge} {pick.edgePct ?? "-"}%</span>
                    <span>{t.confidence} {pick.confidence ?? "-"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={cardStyle()}>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 900,
              color: "#ffffff",
              marginBottom: "8px",
            }}
          >
            {t.dataSourceStatus}
          </div>

          <div
            style={{
              color: "#94a3b8",
              fontSize: "15px",
              lineHeight: 1.6,
              marginBottom: "16px",
            }}
          >
            {t.dataSourceStatusDescription}
          </div>

          <SourceBadge
            source={oddsData?.source}
            cached={oddsData?.cached}
            status={oddsData?.cached ? "cache" : "fresh"}
            lang={lang}
          />

          <div
            style={{
              marginTop: "16px",
              display: "grid",
              gap: "10px",
            }}
          >
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                padding: "12px 14px",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "6px" }}>
                {t.oddsSource}
              </div>
              <div style={{ color: "#ffffff", fontWeight: 800 }}>
                {oddsData?.source || "unknown"}
              </div>
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                padding: "12px 14px",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "6px" }}>
                {t.cacheStatus}
              </div>
              <div style={{ color: "#ffffff", fontWeight: 800 }}>
                {oddsData?.cached ? "cached" : "fresh"}
              </div>
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                padding: "12px 14px",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "6px" }}>
                {t.matchesLoaded}
              </div>
              <div style={{ color: "#ffffff", fontWeight: 800 }}>
                {oddsData?.matches?.length || 0}
              </div>
            </div>

            {oddsData?.reason ? (
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "6px" }}>
                  {t.dataReason}
                </div>
                <div style={{ color: "#dbe4f0", lineHeight: 1.6 }}>
                  {oddsData.reason}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
          gap: "16px",
        }}
      >
        <div style={cardStyle()}>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 900,
              color: "#ffffff",
              marginBottom: "8px",
            }}
          >
            {t.simulatorPreview}
          </div>

          <div
            style={{
              color: "#94a3b8",
              fontSize: "15px",
              lineHeight: 1.6,
              marginBottom: "16px",
            }}
          >
            {t.simulatorPreviewDescription}
          </div>

          <div
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "14px",
              padding: "14px",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div
              style={{
                color: "#ffffff",
                fontWeight: 800,
                marginBottom: "8px",
              }}
            >
              {t.nextStep}
            </div>

            <div
              style={{
                color: "#dbe4f0",
                fontSize: "15px",
                lineHeight: 1.6,
              }}
            >
              {t.simulatorPreviewText}
            </div>

            <div
              style={{
                marginTop: "8px",
                color: "#94a3b8",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              {t.simulatorPreviewSubtext}
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <Link
              href="/simulator"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "46px",
                padding: "0 16px",
                borderRadius: "12px",
                textDecoration: "none",
                fontWeight: 800,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#ffffff",
              }}
            >
              {t.goToSimulator}
            </Link>
          </div>
        </div>

        <div style={cardStyle()}>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 900,
              color: "#ffffff",
              marginBottom: "8px",
            }}
          >
            {t.matchPreview}
          </div>

          <div
            style={{
              color: "#94a3b8",
              fontSize: "15px",
              lineHeight: 1.6,
              marginBottom: "16px",
            }}
          >
            {t.matchPreviewDescription}
          </div>

          {!previewMatch ? (
            <div style={{ color: "#94a3b8", fontSize: "14px" }}>{t.noMatchPreview}</div>
          ) : (
            <>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 900,
                  color: "#ffffff",
                  lineHeight: 1.2,
                }}
              >
                {previewMatch.home_team} vs {previewMatch.away_team}
              </div>

              <div
                style={{
                  marginTop: "8px",
                  color: "#94a3b8",
                  fontSize: "14px",
                }}
              >
                {previewMatch.sport_title}
              </div>

              <div
                style={{
                  marginTop: "14px",
                  color: "#dbe4f0",
                  fontSize: "15px",
                  lineHeight: 1.6,
                }}
              >
                Dashboard näyttää vain kevyen preview’n. Täysi analyysi löytyy betting-sivulta.
              </div>

              <div
                style={{
                  marginTop: "16px",
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                    padding: "12px",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "6px" }}>
                    {t.home}
                  </div>
                  <div style={{ color: "#ffffff", fontWeight: 800 }}>
                    {previewMatch.bestOdds?.home ?? "-"}
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                    padding: "12px",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "6px" }}>
                    {t.draw}
                  </div>
                  <div style={{ color: "#ffffff", fontWeight: 800 }}>
                    {previewMatch.bestOdds?.draw ?? "-"}
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                    padding: "12px",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "6px" }}>
                    {t.away}
                  </div>
                  <div style={{ color: "#ffffff", fontWeight: 800 }}>
                    {previewMatch.bestOdds?.away ?? "-"}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "16px" }}>
                <Link
                  href="/betting"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "46px",
                    padding: "0 16px",
                    borderRadius: "12px",
                    textDecoration: "none",
                    fontWeight: 800,
                    background: "rgba(34,197,94,0.14)",
                    border: "1px solid rgba(34,197,94,0.45)",
                    color: "#dcfce7",
                  }}
                >
                  {t.openAnalysis}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
