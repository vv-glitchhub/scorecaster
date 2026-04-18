import { cookies } from "next/headers";
import { getOddsData } from "@/lib/odds-service";
import { getDictionary, normalizeLang } from "@/lib/i18n";
import BettingWorkspaceClient from "@/app/components/BettingWorkspaceClient";

export default async function BettingPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "fi");
  const t = getDictionary(lang);

  let oddsData = {
    matches: [],
    source: "unknown",
    cached: false,
  };

  try {
    oddsData = await getOddsData({ sport: "icehockey_liiga" });
  } catch {
    oddsData = {
      matches: [],
      source: "unknown",
      cached: false,
    };
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section
        style={{
          border: "1px solid rgba(16,185,129,0.25)",
          borderRadius: "24px",
          padding: "32px 24px",
          background:
            "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(34,211,238,0.10))",
          overflow: "hidden",
        }}
      >
        <div style={{ maxWidth: "820px" }}>
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
            {lang === "fi" ? "Vedonlyönti" : "Betting"}
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(34px, 9vw, 56px)",
              lineHeight: 1.04,
              wordBreak: "break-word",
            }}
          >
            {lang === "fi"
              ? "Analysoi ottelut, löydä value-kohteita, hallitse panostusta ja seuraa markkinaliikkeitä."
              : "Analyze matches, find value spots, manage staking and follow market movement."}
          </h1>

          <p
            style={{
              marginTop: "16px",
              color: "#cbd5e1",
              fontSize: "clamp(16px, 4vw, 20px)",
              lineHeight: 1.6,
            }}
          >
            {lang === "fi"
              ? "Vedonlyöntityöpöytä päivittyy automaattisesti, tallentaa markkinasnapshoteja ja näyttää muutokset käytön aikana."
              : "The betting workspace refreshes automatically, stores market snapshots and shows movement during use."}
          </p>
        </div>
      </section>

      <BettingWorkspaceClient initialOddsData={oddsData} lang={lang} />
    </div>
  );
}
