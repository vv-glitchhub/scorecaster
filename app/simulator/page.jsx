import { cookies } from "next/headers";
import PageSection from "@/app/components/PageSection";
import MatchSimulatorPanel from "@/app/components/MatchSimulatorPanel";
import { normalizeLang } from "@/lib/i18n";
import { getOddsData } from "@/lib/odds-service";

function BulletCard({ items = [] }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "20px",
        padding: "20px",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "12px",
        }}
      >
        {items.map((item) => (
          <div
            key={item}
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
              color: "#dbe4f0",
              fontSize: "16px",
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: "#86efac", fontWeight: 900 }}>•</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function SimulatorPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "fi");

  let matches = [];
  try {
    const oddsData = await getOddsData({ sport: "icehockey_liiga" });
    matches = Array.isArray(oddsData?.matches) ? oddsData.matches : [];
  } catch {
    matches = [];
  }

  const copy =
    lang === "fi"
      ? {
          eyebrow: "Simulaattori",
          title: "Testaa otteluiden todennäköisyysjakaumaa",
          subtitle:
            "Simulaattori käyttää markkinakertoimista johdettuja todennäköisyyksiä ja ajaa valitulle ottelulle suuren määrän satunnaistettuja iterointeja.",
          bullets: [
            "Valitse ottelu ja simulaation iterointimäärä.",
            "Näe koti-, tasa- ja vierasvoiton jakauma heti.",
            "Vertaa markkinan hinnoittelua omaan analyysiisi.",
            "Käytä simulaatiota value-bet-ajattelun tukena.",
          ],
        }
      : {
          eyebrow: "Simulator",
          title: "Test match outcome distributions",
          subtitle:
            "The simulator uses probabilities derived from market odds and runs a large number of randomized iterations for the selected match.",
          bullets: [
            "Choose a match and the simulation iteration count.",
            "See the home, draw and away outcome distribution instantly.",
            "Compare market pricing to your own analysis.",
            "Use the simulation to support value-bet thinking.",
          ],
        };

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <PageSection
        eyebrow={copy.eyebrow}
        title={copy.title}
        subtitle={copy.subtitle}
      >
        <BulletCard items={copy.bullets} />
      </PageSection>

      <MatchSimulatorPanel matches={matches} lang={lang} />
    </div>
  );
}
