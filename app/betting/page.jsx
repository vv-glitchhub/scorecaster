import { cookies } from "next/headers";
import { normalizeLang, getDictionary } from "@/lib/i18n";
import { getOddsData } from "@/lib/odds-service";
import BettingWorkspaceClient from "@/app/components/BettingWorkspaceClient";
import PageSection from "@/app/components/PageSection";
import BetHistory from "@/app/components/BetHistory";

export default async function BettingPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "en");
  const t = getDictionary(lang);

  const oddsData = await getOddsData({ sport: "icehockey_liiga" });

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section
        style={{
          border: "1px solid rgba(16,185,129,0.25)",
          borderRadius: "24px",
          padding: "28px",
          background:
            "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(34,211,238,0.10))",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "32px" }}>{t.navBetting}</h1>

        <p style={{ marginTop: "12px", color: "#cbd5e1" }}>
          {lang === "fi"
            ? "Analysoi ottelut, löydä value betit, hallitse panoksia ja seuraa tuloksia."
            : "Analyze matches, find value bets, manage stakes and track results."}
        </p>
      </section>

      <BettingWorkspaceClient oddsData={oddsData} lang={lang} />

      <PageSection
        title={lang === "fi" ? "Omat vedot" : "My Bets"}
        description={
          lang === "fi"
            ? "Seuraa vetoja, tuloksia, voittoa, ROI:ta ja profit-käyrää."
            : "Track bets, results, profit, ROI and the profit curve."
        }
      >
        <BetHistory />
      </PageSection>
    </div>
  );
}
