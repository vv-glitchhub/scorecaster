"use client";

import PageSection from "@/app/components/PageSection";
import { useBreakpoint } from "@/lib/useBreakpoint";

function Card({ children, selected = false }) {
  return (
    <div
      style={{
        border: selected
          ? "1px solid rgba(16,185,129,0.7)"
          : "1px solid rgba(255,255,255,0.1)",
        background: selected
          ? "rgba(16,185,129,0.12)"
          : "rgba(0,0,0,0.2)",
        borderRadius: "16px",
        padding: "16px",
      }}
    >
      {children}
    </div>
  );
}

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

export default function BettingWorkspaceClient({
  matches,
  selectedMatch,
  model,
  valueBets,
  topPicks,
}) {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  const mainColumns = isDesktop ? "1.1fr 1.5fr 1fr" : "1fr";
  const statColsTop = isMobile ? "1fr" : "repeat(3, 1fr)";
  const statColsBottom = isMobile ? "1fr 1fr" : "repeat(4, 1fr)";
  const mobileSectionGap = isMobile ? "16px" : "24px";

  const FiltersBlock = (
    <PageSection
      title="Filters"
      description="Sport / league / market controls can expand here."
    >
      <div style={{ display: "grid", gap: "12px" }}>
        <Card>
          <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Sport</p>
          <p style={{ margin: "8px 0 0", fontWeight: 700 }}>Ice Hockey</p>
        </Card>

        <Card>
          <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>League</p>
          <p style={{ margin: "8px 0 0", fontWeight: 700 }}>Liiga</p>
        </Card>

        <Card>
          <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Market</p>
          <p style={{ margin: "8px 0 0", fontWeight: 700 }}>H2H</p>
        </Card>
      </div>
    </PageSection>
  );

  const MatchesBlock = (
    <PageSection
      title="Matches"
      description="Available matches for the selected sport."
    >
      <div style={{ display: "grid", gap: "12px" }}>
        {matches.length === 0 ? (
          <Card>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
              No matches found.
            </p>
          </Card>
        ) : (
          matches.map((match) => (
            <Card key={match.id} selected={selectedMatch?.id === match.id}>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {match.home_team} vs {match.away_team}
              </p>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#94a3b8",
                }}
              >
                {match.sport_title}
              </p>
            </Card>
          ))
        )}
      </div>
    </PageSection>
  );

  const SelectedMatchBlock = (
    <PageSection
      title="Selected Match Analysis"
      description="Main match view, best odds and model output."
    >
      {!selectedMatch ? (
        <Card>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
            No selected match.
          </p>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          <Card>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>
              {selectedMatch.home_team} vs {selectedMatch.away_team}
            </p>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: "14px",
                color: "#94a3b8",
              }}
            >
              {selectedMatch.sport_title}
            </p>
          </Card>

          <div
            style={{
              display: "grid",
              gap: "16px",
              gridTemplateColumns: statColsTop,
            }}
          >
            <StatCard label="Home odds" value={selectedMatch.bestOdds?.home ?? "-"} />
            <StatCard label="Draw odds" value={selectedMatch.bestOdds?.draw ?? "-"} />
            <StatCard label="Away odds" value={selectedMatch.bestOdds?.away ?? "-"} />
          </div>

          <div
            style={{
              display: "grid",
              gap: "16px",
              gridTemplateColumns: statColsBottom,
            }}
          >
            <StatCard
              label="Model Home"
              value={model ? `${(model.home * 100).toFixed(1)}%` : "-"}
            />
            <StatCard
              label="Model Draw"
              value={model ? `${(model.draw * 100).toFixed(1)}%` : "-"}
            />
            <StatCard
              label="Model Away"
              value={model ? `${(model.away * 100).toFixed(1)}%` : "-"}
            />
            <StatCard
              label="Confidence"
              value={model ? `${model.confidence}%` : "-"}
            />
          </div>
        </div>
      )}
    </PageSection>
  );

  const ValueBetsBlock = (
    <PageSection
      title="Value Bets"
      description="Model edge versus current best odds."
    >
      <div style={{ display: "grid", gap: "12px" }}>
        {valueBets.length === 0 ? (
          <Card>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
              No value bet rows available.
            </p>
          </Card>
        ) : (
          valueBets.map((row) => (
            <Card key={`${row.side}-${row.team}`}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  flexDirection: isMobile ? "column" : "row",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>
                    {row.side} • {row.team}
                  </p>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "14px",
                      color: "#94a3b8",
                    }}
                  >
                    Bookmaker: {row.bookmaker || "-"}
                  </p>
                </div>

                <div
                  style={{
                    textAlign: isMobile ? "left" : "right",
                    fontSize: "14px",
                  }}
                >
                  <p style={{ margin: 0 }}>Odds {row.odds}</p>
                  <p style={{ margin: "6px 0 0", color: "#cbd5e1" }}>
                    Fair {row.fairOdds}
                  </p>
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: row.edgePct > 0 ? "#6ee7b7" : "#fda4af",
                    }}
                  >
                    EV {row.edgePct}%
                  </p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </PageSection>
  );

  const TopPicksBlock = (
    <PageSection
      title="Backend Top Picks"
      description="Ranked value opportunities."
    >
      <div style={{ display: "grid", gap: "12px" }}>
        {topPicks.length === 0 ? (
          <Card>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
              No backend picks available.
            </p>
          </Card>
        ) : (
          topPicks.map((pick) => (
            <Card key={`${pick.matchId}-${pick.selection}`}>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {pick.selection} @ {pick.odds}
              </p>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#94a3b8",
                }}
              >
                {pick.home_team} vs {pick.away_team}
              </p>
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: "14px",
                  color: "#6ee7b7",
                }}
              >
                EV {pick.edgePct}% • Confidence {pick.confidence}%
              </p>
            </Card>
          ))
        )}
      </div>
    </PageSection>
  );

  const BankrollBlock = (
    <PageSection
      title="Bankroll"
      description="Placeholder for staking and Kelly logic."
    >
      <div style={{ display: "grid", gap: "12px" }}>
        <StatCard label="Bankroll" value="€1,000" />
        <StatCard label="Staking model" value="Quarter Kelly" />
      </div>
    </PageSection>
  );

  if (isDesktop) {
    return (
      <div
        style={{
          display: "grid",
          gap: "24px",
          gridTemplateColumns: mainColumns,
        }}
      >
        <div style={{ display: "grid", gap: "24px" }}>
          {FiltersBlock}
          {MatchesBlock}
        </div>

        <div style={{ display: "grid", gap: "24px" }}>
          {SelectedMatchBlock}
          {ValueBetsBlock}
        </div>

        <div style={{ display: "grid", gap: "24px" }}>
          {TopPicksBlock}
          {BankrollBlock}
        </div>
      </div>
    );
  }

  if (isTablet) {
    return (
      <div style={{ display: "grid", gap: mobileSectionGap }}>
        {SelectedMatchBlock}
        <div
          style={{
            display: "grid",
            gap: mobileSectionGap,
            gridTemplateColumns: "1fr 1fr",
          }}
        >
          {MatchesBlock}
          {TopPicksBlock}
        </div>
        {ValueBetsBlock}
        <div
          style={{
            display: "grid",
            gap: mobileSectionGap,
            gridTemplateColumns: "1fr 1fr",
          }}
        >
          {FiltersBlock}
          {BankrollBlock}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: mobileSectionGap }}>
      {SelectedMatchBlock}
      {MatchesBlock}
      {ValueBetsBlock}
      {TopPicksBlock}
      {BankrollBlock}
      {FiltersBlock}
    </div>
  );
}
