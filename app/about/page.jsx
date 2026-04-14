import { cookies } from "next/headers";
import PageSection from "@/app/components/PageSection";
import { getDictionary, normalizeLang } from "@/lib/i18n";

function BulletList({ items }) {
  return (
    <div style={{ display: "grid", gap: "10px", color: "#cbd5e1" }}>
      {items.map((item, index) => (
        <div key={index} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <span style={{ color: "#6ee7b7", fontWeight: 700 }}>•</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function InfoBlock({ title, text }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.18)",
        borderRadius: "16px",
        padding: "16px",
      }}
    >
      <p style={{ margin: 0, fontWeight: 700, fontSize: "16px" }}>{title}</p>
      <p style={{ margin: "10px 0 0", color: "#cbd5e1", lineHeight: 1.6 }}>
        {text}
      </p>
    </div>
  );
}

export default async function AboutPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "en");
  const t = getDictionary(lang);

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
          {t.aboutEyebrow}
        </p>

        <h1 style={{ margin: 0, fontSize: "clamp(32px, 8vw, 56px)", lineHeight: 1.05 }}>
          {t.aboutTitle}
        </h1>

        <p
          style={{
            marginTop: "16px",
            color: "#cbd5e1",
            fontSize: "clamp(15px, 3.5vw, 18px)",
            lineHeight: 1.6,
            maxWidth: "900px",
          }}
        >
          {t.aboutDescription}
        </p>
      </section>

      <PageSection
        title={t.aboutWhatTitle}
        description={t.aboutWhatDescription}
      >
        <BulletList
          items={[
            t.aboutWhat1,
            t.aboutWhat2,
            t.aboutWhat3,
            t.aboutWhat4,
            t.aboutWhat5,
          ]}
        />
      </PageSection>

      <PageSection
        title={t.aboutCalcTitle}
        description={t.aboutCalcDescription}
      >
        <div
          style={{
            display: "grid",
            gap: "16px",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <InfoBlock title={t.aboutCalc1Title} text={t.aboutCalc1Text} />
          <InfoBlock title={t.aboutCalc2Title} text={t.aboutCalc2Text} />
          <InfoBlock title={t.aboutCalc3Title} text={t.aboutCalc3Text} />
          <InfoBlock title={t.aboutCalc4Title} text={t.aboutCalc4Text} />
          <InfoBlock title={t.aboutCalc5Title} text={t.aboutCalc5Text} />
          <InfoBlock title={t.aboutCalc6Title} text={t.aboutCalc6Text} />
        </div>
      </PageSection>

      <PageSection
        title={t.aboutStatusTitle}
        description={t.aboutStatusDescription}
      >
        <BulletList
          items={[
            t.aboutStatus1,
            t.aboutStatus2,
            t.aboutStatus3,
            t.aboutStatus4,
          ]}
        />
      </PageSection>

      <PageSection
        title={t.aboutLimitsTitle}
        description={t.aboutLimitsDescription}
      >
        <BulletList
          items={[
            t.aboutLimit1,
            t.aboutLimit2,
            t.aboutLimit3,
            t.aboutLimit4,
            t.aboutLimit5,
          ]}
        />
      </PageSection>

      <PageSection
        title={t.aboutUpdatesTitle}
        description={t.aboutUpdatesDescription}
      >
        <BulletList
          items={[
            t.aboutUpdate1,
            t.aboutUpdate2,
            t.aboutUpdate3,
            t.aboutUpdate4,
            t.aboutUpdate5,
          ]}
        />
      </PageSection>

      <PageSection
        title={t.aboutNextTitle}
        description={t.aboutNextDescription}
      >
        <BulletList
          items={[
            t.aboutNext1,
            t.aboutNext2,
            t.aboutNext3,
            t.aboutNext4,
          ]}
        />
      </PageSection>
    </div>
  );
}
