import { cookies } from "next/headers";
import PageSection from "@/app/components/PageSection";
import { normalizeLang } from "@/lib/i18n";

function InfoBlock({ title, text }) {
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
          fontSize: "22px",
          fontWeight: 900,
          color: "#ffffff",
          marginBottom: "10px",
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: "#94a3b8",
          fontSize: "16px",
          lineHeight: 1.7,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function BulletList({ items }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "20px",
        padding: "20px",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ display: "grid", gap: "12px" }}>
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

function FormulaBlock({ items }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "20px",
        padding: "20px",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ display: "grid", gap: "12px" }}>
        {items.map((item) => (
          <div
            key={item}
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
              fontSize: "15px",
              color: "#e2e8f0",
              padding: "14px 16px",
              borderRadius: "14px",
              background: "rgba(0,0,0,0.18)",
              border: "1px solid rgba(255,255,255,0.06)",
              overflowX: "auto",
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function AboutPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "fi");

  const copy =
    lang === "fi"
      ? {
          eyebrow: "Tietoa",
          title: "Mitä Scorecaster tekee",
          subtitle:
            "Scorecaster on vedonlyönnin analyysi- ja simulaatiosovellus, joka kokoaa markkinadataa, näyttää parhaat kertoimet ja auttaa vertaamaan markkinanäkemystä omaan arvioon.",
          blocks: [
            {
              title: "Mitä sovellus tekee",
              text:
                "Sovellus näyttää otteluita, eri markkinoita, parhaat saatavilla olevat kertoimet, yksinkertaisen confidence-näkymän, riskiliput sekä markkinaliikkeen historian.",
            },
            {
              title: "Miten laskenta toimii",
              text:
                "Laskenta perustuu markkinan implied probability -ajatteluun, kertoimien vertailuun ja yksinkertaiseen stake-logiikkaan. Simulaattori normalisoi markkinakertoimet todennäköisyyksiksi ja ajaa iterointeja niiden pohjalta.",
            },
            {
              title: "Data ja avoimuus",
              text:
                "Sovellus käyttää odds-dataa API:n kautta. Jos live-dataa ei ole saatavilla, sovellus voi näyttää fallback-dataa kehityksen ja käyttöliittymän jatkuvuuden varmistamiseksi.",
            },
            {
              title: "Rajoitteet",
              text:
                "Sovellus ei takaa voitollisuutta eikä korvaa omaa harkintaa. Markkinat muuttuvat nopeasti, data voi viivästyä, ja mallin nykyinen logiikka on vielä kehitysvaiheessa.",
            },
          ],
          formulas: [
            "impliedProbability = 1 / odds",
            "edge = modelProbability - impliedProbability",
            "kellyFraction = ((odds * probability) - 1) / (odds - 1)",
          ],
          bullets: [
            "Erota vedonlyönti ja simulointi omille sivuilleen.",
            "Paranna live refresh -toimintaa betting-sivulla.",
            "Kehitä market movement -historiaa snapshot-pohjaisesti.",
            "Lisää vahvempi mallikerros value-kohteiden priorisointiin.",
          ],
        }
      : {
          eyebrow: "About",
          title: "What Scorecaster does",
          subtitle:
            "Scorecaster is a betting analysis and simulation app that aggregates market data, shows the best odds and helps compare market pricing with your own view.",
          blocks: [
            {
              title: "What the app does",
              text:
                "The app shows matches, markets, best available odds, a simple confidence view, risk flags and market-movement history.",
            },
            {
              title: "How the calculations work",
              text:
                "The calculations are based on implied probability logic, odds comparison and simple stake logic. The simulator normalizes market odds into probabilities and runs iterations on that basis.",
            },
            {
              title: "Data and transparency",
              text:
                "The app uses odds data via an API. If live data is unavailable, the app may show fallback data to preserve development flow and UI continuity.",
            },
            {
              title: "Limitations",
              text:
                "The app does not guarantee profitability and does not replace your own judgment. Markets move quickly, data may lag, and the current model logic is still under development.",
            },
          ],
          formulas: [
            "impliedProbability = 1 / odds",
            "edge = modelProbability - impliedProbability",
            "kellyFraction = ((odds * probability) - 1) / (odds - 1)",
          ],
          bullets: [
            "Keep betting and simulation on separate pages.",
            "Improve live refresh on the betting page.",
            "Build snapshot-based market-movement history.",
            "Add a stronger model layer for value prioritization.",
          ],
        };

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <PageSection
        eyebrow={copy.eyebrow}
        title={copy.title}
        subtitle={copy.subtitle}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        {copy.blocks.map((block) => (
          <InfoBlock key={block.title} title={block.title} text={block.text} />
        ))}
      </div>

      <PageSection
        title={lang === "fi" ? "Kaavat" : "Formulas"}
        subtitle={
          lang === "fi"
            ? "Keskeiset laskennan osat nykyisessä versiossa."
            : "Core calculation pieces in the current version."
        }
      >
        <FormulaBlock items={copy.formulas} />
      </PageSection>

      <PageSection
        title={lang === "fi" ? "Seuraavat kehitysaskeleet" : "Next development steps"}
        subtitle={
          lang === "fi"
            ? "Nämä ovat luontevimmat seuraavat parannukset."
            : "These are the most natural next improvements."
        }
      >
        <BulletList items={copy.bullets} />
      </PageSection>
    </div>
  );
}
