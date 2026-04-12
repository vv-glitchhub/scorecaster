import BettingWorkspaceClient from "@/app/components/BettingWorkspaceClient";
import { getOddsData } from "@/lib/odds-service";

async function getBettingPageData() {
  try {
    const oddsData = await getOddsData({ sport: "icehockey_liiga" });
    const matches = oddsData?.matches || [];
    const selectedMatch = matches[0] || null;

    return {
      matches,
      initialSelectedMatchId: selectedMatch?.id || null,
      source: oddsData?.source || "unknown",
      cached: Boolean(oddsData?.cached),
    };
  } catch {
    return {
      matches: [],
      initialSelectedMatchId: null,
      source: "unknown",
      cached: false,
    };
  }
}

export default async function BettingPage() {
  const { matches, initialSelectedMatchId, source, cached } =
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
          Valitse ottelu vasemmalta ja analyysi päivittyy heti ilman uutta latausta.
        </p>
      </section>

      <BettingWorkspaceClient
        matches={matches}
        initialSelectedMatchId={initialSelectedMatchId}
        source={source}
        cached={cached}
      />
    </div>
  );
}
