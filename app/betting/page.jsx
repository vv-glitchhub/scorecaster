import { cookies } from "next/headers";
import { normalizeLang, getDictionary } from "@/lib/i18n";
import { getOddsData } from "@/lib/odds-service";
import BettingWorkspaceClient from "@/app/components/BettingWorkspaceClient";

export default async function BettingPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "en");
  const t = getDictionary(lang);

  const oddsData = await getOddsData({ sport: "icehockey_liiga" });

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* HERO */}
      <section
        style={{
          border: "1px solid rgba(16,185,129,0.25)",
          borderRadius: "24px",
          padding: "28px",
          background:
            "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(34,211,238,0.10))",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "32px" }}>
          {t.navBetting}
        </h1>

        <p style={{ marginTop: "12px", color: "#cbd5e1" }}>
          {lang === "fi"
            ? "Analysoi ottelut, löydä value betit ja hallitse pelikassa."
            : "Analyze matches, find value bets and manage bankroll."}
        </p>
      </section>

      {/* WORKSPACE */}
      <BettingWorkspaceClient
        oddsData={oddsData}
        lang={lang}
      />
    </div>
  );
}
