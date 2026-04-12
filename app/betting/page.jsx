import BettingWorkspaceClient from "@/app/components/BettingWorkspaceClient";
import { getOddsData } from "@/lib/odds-service";

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
      marketMatches: {
        h2h: h2hMatches,
        totals: totalsMatches,
        spreads: spreadsMatches,
      },
      initialSelectedMatchId: h2hMatches?.[0]?.id || null,
      source: h2hData?.source || "unknown",
      cached: Boolean(h2hData?.cached),
    };
  } catch {
    return {
      marketMatches: {
        h2h: [],
        totals: [],
        spreads: [],
      },
      initialSelectedMatchId: null,
      source: "unknown",
      cached: false,
    };
  }
}

export default async function BettingPage() {
  const { marketMatches, initialSelectedMatchId, source, cached } =
    await getBettingPageData();

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
            color: "#6ee7b7",
            fontWeight: 700,
          }}
        >
          Betting Workspace
        </p>
        <h1 style={{ margin: 0, fontSize: "36px", lineHeight: 1.1 }}>
          Full betting analysis, odds comparison and value bet workflow.
        </h1>
        <p style={{ marginTop: "16px", color: "#cbd5e1" }}>
          Vaihda markettia H2H-, Totals- ja Handicap-tabien välillä.
        </p>
      </section>

      <BettingWorkspaceClient
        marketMatches={marketMatches}
        initialSelectedMatchId={initialSelectedMatchId}
        source={source}
        cached={cached}
      />
    </div>
  );
}
