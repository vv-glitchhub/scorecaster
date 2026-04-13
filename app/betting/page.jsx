import BettingWorkspaceClient from "@/app/components/BettingWorkspaceClient";
import { getOddsData } from "@/lib/odds-service";
import { cookies } from "next/headers";
import { getDictionary, normalizeLang } from "@/lib/i18n";

async function getBettingPageData() {
  try {
    const [h2hData, totalsData, spreadsData] = await Promise.all([
      getOddsData({ sport: "icehockey_liiga", market: "h2h" }),
      getOddsData({ sport: "icehockey_liiga", market: "totals" }),
      getOddsData({ sport: "icehockey_liiga", market: "spreads" }),
    ]);

    const h2hMatches = h2hData?.matches || [];
    const totalsMatches = totalsData?.matches || [];
    const spreadsMatches = spreadsData?.matches || [];

    return {
      initialMarketMatches: {
        h2h: h2hMatches,
        totals: totalsMatches,
        spreads: spreadsMatches,
      },
      initialSelectedMatchId: h2hMatches?.[0]?.id || null,
      initialSource: h2hData?.source || "unknown",
      initialCached: Boolean(h2hData?.cached),
    };
  } catch {
    return {
      initialMarketMatches: {
        h2h: [],
        totals: [],
        spreads: [],
      },
      initialSelectedMatchId: null,
      initialSource: "unknown",
      initialCached: false,
    };
  }
}

export default async function BettingPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "en");
  const t = getDictionary(lang);

  const {
    initialMarketMatches,
    initialSelectedMatchId,
    initialSource,
    initialCached,
  } = await getBettingPageData();

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <section
        style={{
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "24px",
          padding: "24px",
        }}
      >
        <p
          style={{
            margin: "0 0 10px",
            fontSize: "12px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#6ee7b7",
            fontWeight: 700,
          }}
        >
          {t.bettingEyebrow}
        </p>

        <h1
          style={{
            margin: 0,
            fontSize: "clamp(32px, 8vw, 56px)",
            lineHeight: 1.05,
          }}
        >
          {t.bettingTitle}
        </h1>

        <p
          style={{
            marginTop: "14px",
            color: "#cbd5e1",
            fontSize: "clamp(15px, 3.8vw, 18px)",
            lineHeight: 1.5,
            maxWidth: "900px",
          }}
        >
          {t.bettingDescription}
        </p>
      </section>

      <BettingWorkspaceClient
        initialMarketMatches={initialMarketMatches}
        initialSelectedMatchId={initialSelectedMatchId}
        initialSource={initialSource}
        initialCached={initialCached}
        lang={lang}
      />
    </div>
  );
}
