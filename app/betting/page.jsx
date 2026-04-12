import BettingWorkspaceClient from "@/app/components/BettingWorkspaceClient";
import { getOddsData } from "@/lib/odds-service";
import {
  buildValueBetRows,
  getModelProbabilitiesForMatch,
} from "@/lib/model-engine-v1";

async function getBettingPageData() {
  try {
    const oddsData = await getOddsData({ sport: "icehockey_liiga" });
    const matches = oddsData?.matches || [];
    const selectedMatch = matches[0] || null;

    let model = null;
    let valueBets = [];
    let topPicks = [];

    if (selectedMatch) {
      model = getModelProbabilitiesForMatch(selectedMatch);
      valueBets = buildValueBetRows(selectedMatch, model);
    }

    topPicks = matches
      .flatMap((match) => {
        const matchModel = getModelProbabilitiesForMatch(match);
        return buildValueBetRows(match, matchModel).map((row) => ({
          matchId: match.id,
          home_team: match.home_team,
          away_team: match.away_team,
          selection: row.side,
          team: row.team,
          odds: row.odds,
          edgePct: row.edgePct,
          expectedValue: row.expectedValue,
          confidence: matchModel.confidence,
        }));
      })
      .filter((pick) => pick.expectedValue > 0)
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .slice(0, 8);

    return {
      matches,
      selectedMatch,
      model,
      valueBets,
      topPicks,
    };
  } catch {
    return {
      matches: [],
      selectedMatch: null,
      model: null,
      valueBets: [],
      topPicks: [],
    };
  }
}

export default async function BettingPage() {
  const { matches, selectedMatch, model, valueBets, topPicks } =
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
          Tälle sivulle jää kaikki raskas analyysi. Mobile-näkymässä layout
          pinoutuu automaattisesti käytettävämpään järjestykseen.
        </p>
      </section>

      <BettingWorkspaceClient
        matches={matches}
        selectedMatch={selectedMatch}
        model={model}
        valueBets={valueBets}
        topPicks={topPicks}
      />
    </div>
  );
}
