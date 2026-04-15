import PageSection from "@/app/components/PageSection";
import MatchSimulatorPanel from "@/app/components/MatchSimulatorPanel";
import { cookies } from "next/headers";
import { getDictionary, normalizeLang } from "@/lib/i18n";
import { getOddsData } from "@/lib/odds-service";

function StatCard({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(0,0,0,0.2)",
        borderRadius: "16px",
        padding: "16px",
      }}
    >
      <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>{label}</p>
      <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
        {value}
      </p>
    </div>
  );
}

export default async function SimulatorPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "en");
  const t = getDictionary(lang);

  let matches = [];
  try {
    const oddsData = await getOddsData({ sport: "icehockey_liiga" });
    matches = oddsData?.matches || [];
  } catch {
    matches = [];
  }

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
            color: "#67e8f9",
            fontWeight: 700,
          }}
        >
          {t.simulatorEyebrow}
        </p>
        <h1 style={{ margin: 0, fontSize: "36px", lineHeight: 1.1 }}>
          {t.simulatorTitle}
        </h1>
        <p style={{ marginTop: "16px", color: "#cbd5e1" }}>
          {t.simulatorDescription}
        </p>
      </section>

      <PageSection
        title={lang === "fi" ? "Ottelusimulaatio" : "Match Simulation"}
        description={
          lang === "fi"
            ? "Aja yksittäisen ottelun simulaatio markkinatodennäköisyyksien pohjalta."
            : "Run a single match simulation based on market probabilities."
        }
      >
        <MatchSimulatorPanel matches={matches} lang={lang} />
      </PageSection>

      <div
        style={{
          display: "grid",
          gap: "24px",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <PageSection
          title={t.simulationSetup}
          description={t.simulationSetupDescription}
        >
          <div style={{ display: "grid", gap: "12px" }}>
            <StatCard label={t.competition} value={t.worldCupLeague} />
            <StatCard label={t.iterations} value="10,000" />
            <StatCard label={t.mode} value={t.monteCarlo} />
          </div>
        </PageSection>

        <PageSection
          title={t.outcomePreview}
          description={t.outcomePreviewDescription}
        >
          <div style={{ display: "grid", gap: "12px" }}>
            <StatCard label="Team A" value={`${t.winTitle}: 24.5%`} />
            <StatCard label="Team B" value={`${t.reachFinal}: 38.2%`} />
            <StatCard label="Team C" value={`${t.top4}: 51.7%`} />
          </div>
        </PageSection>

        <PageSection
          title={t.plannedExtensions}
          description={t.plannedExtensionsDescription}
        >
          <div style={{ color: "#cbd5e1", lineHeight: 1.8 }}>
            <div>• {t.ext1}</div>
            <div>• {t.ext2}</div>
            <div>• {t.ext3}</div>
            <div>• {t.ext4}</div>
            <div>• {t.ext5}</div>
          </div>
        </PageSection>
      </div>
    </div>
  );
}
