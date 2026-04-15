import Link from "next/link";
import { cookies } from "next/headers";
import PageSection from "@/app/components/PageSection";
import SourceBadge from "@/app/components/SourceBadge";
import PendingBetsPreview from "@/app/components/PendingBetsPreview";
import { getOddsData } from "@/lib/odds-service";
import {
  buildValueBetRows,
  getModelProbabilitiesForMatch,
} from "@/lib/model-engine-v1";
import { getDictionary, normalizeLang } from "@/lib/i18n";

async function getDashboardData() {
  try {
    const oddsData = await getOddsData({ sport: "icehockey_liiga" });
    const matches = oddsData?.matches || [];

    const picks = matches
      .flatMap((match) => {
        const model = getModelProbabilitiesForMatch(match);
        return buildValueBetRows(match, model).map((row) => ({
          matchId: match.id,
          home_team: match.home_team,
          away_team: match.away_team,
          selection: row.side,
          team: row.team,
          odds: row.odds,
          edgePct: row.edgePct,
          expectedValue: row.expectedValue,
        }));
      })
      .filter((pick) => pick.expectedValue > 0)
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .slice(0, 3);

    return {
      oddsData,
      picks,
    };
  } catch {
    return {
      oddsData: { matches: [], source: "unknown", cached: false },
      picks: [],
    };
  }
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "en");
  const t = getDictionary(lang);

  const { oddsData, picks } = await getDashboardData();
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
            {t.dashboardEyebrow}
          </p>

          <h1 style={{ margin: 0, fontSize: "42px", lineHeight: 1.1 }}>
            {t.dashboardTitle}
          </h1>

          <p style={{ marginTop: "16px", color: "#cbd5e1", fontSize: "16px" }}>
            {t.dashboardDescription}
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
                textDecoration: "none",
              }}
            >
              {t.openBettingWorkspace}
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
                textDecoration: "none",
              }}
            >
              {t.openSimulator}
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
        <PageSection title={t.topPicks} description={t.topPicksDescription}>
          <div style={{ display: "grid", gap: "12px" }}>
            {picks.length === 0 ? (
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
                {t.noTopPicks}
              </div>
            ) : (
              picks.map((pick) => (
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
                        {t.ev} {pick.edgePct}%
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
          title={t.dataSourceStatus}
          description={t.dataSourceStatusDescription}
          rightSlot={
            <SourceBadge
              source={oddsData?.source}
              cached={oddsData?.cached}
              lang={lang}
            />
          }
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
                {t.oddsSource}
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
                {t.cacheStatus}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                {oddsData?.cached
                  ? t.statusCache.toLowerCase()
                  : t.statusFresh.toLowerCase()}
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
                {t.matchesLoaded}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                {oddsData?.matches?.length || 0}
              </p>
            </div>
          </div>
        </PageSection>

        <PageSection
          title={lang === "fi" ? "Avoimet vedot" : "Pending Bets"}
          description={
            lang === "fi"
              ? "Nopea esikatselu avoimista vedoista."
              : "Quick preview of open bets."
          }
        >
          <PendingBetsPreview lang={lang} />
        </PageSection>

        <PageSection
          title={t.simulatorPreview}
          description={t.simulatorPreviewDescription}
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
              {t.nextStep}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
              {t.simulatorPreviewText}
            </p>
            <p style={{ marginTop: "12px", fontSize: "14px", color: "#cbd5e1" }}>
              {t.simulatorPreviewSubtext}
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
                color: "#fff",
                textDecoration: "none",
              }}
            >
              {t.goToSimulator}
            </Link>
          </div>
        </PageSection>
      </div>

      <PageSection title={t.matchPreview} description={t.matchPreviewDescription}>
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
            {t.noMatchPreview}
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
                {t.bestOdds}
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
                  <span style={{ color: "#cbd5e1" }}>{t.home}</span>
                  <span>{previewMatch.bestOdds?.home ?? "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#cbd5e1" }}>{t.draw}</span>
                  <span>{previewMatch.bestOdds?.draw ?? "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#cbd5e1" }}>{t.away}</span>
                  <span>{previewMatch.bestOdds?.away ?? "-"}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageSection>
    </div>
  );
}
