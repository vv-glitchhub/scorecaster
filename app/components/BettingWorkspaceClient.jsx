"use client";

import { useMemo, useState } from "react";
import PageSection from "@/app/components/PageSection";
import SourceBadge from "@/app/components/SourceBadge";
import { useBreakpoint } from "@/lib/useBreakpoint";
import {
  buildValueBetRows,
  getModelProbabilitiesForMatch,
} from "@/lib/model-engine-v1";

function Card({ children, selected = false, onClick }) {
  const isClickable = typeof onClick === "function";

  return (
    <div
      onClick={onClick}
      style={{
        border: selected
          ? "1px solid rgba(16,185,129,0.7)"
          : "1px solid rgba(255,255,255,0.1)",
        background: selected
          ? "rgba(16,185,129,0.12)"
          : "rgba(0,0,0,0.2)",
        borderRadius: "16px",
        padding: "16px",
        cursor: isClickable ? "pointer" : "default",
        transition: "0.2s ease",
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
  initialSelectedMatchId,
  source,
  cached,
}) {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  const [selectedMatchId, setSelectedMatchId] = useState(
    initialSelectedMatchId || matches?.[0]?.id || null
  );

  const selectedMatch = useMemo(() => {
    return matches.find((match) => match.id === selectedMatchId) || matches[0] || null;
  }, [matches, selectedMatchId]);

  const model = useMemo(() => {
    if (!selectedMatch) return null;
    return getModelProbabilitiesForMatch(selectedMatch);
  }, [selectedMatch]);

  const valueBets = useMemo(() => {
    if (!selectedMatch || !model) return [];
    return buildValueBetRows(selectedMatch, model);
  }, [selectedMatch, model]);

  const topPicks = useMemo(() => {
    return matches
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
  }, [matches]);

  const bestValueBet = valueBets[0] || null;

  const mainColumns = isDesktop ? "1.1fr 1.5fr 1fr" : "1fr";
  const statColsTop = isMobile ? "1fr" : "repeat(3, 1fr)";
  const statColsBottom = isMobile ? "1fr 1fr" : "repeat(4, 1fr)";
  const mobileSectionGap = isMobile ? "16px" : "24px";

  const FiltersBlock = (
    <PageSection
      title="Filters"
      description="Sport / league / market controls can expand here."
      rightSlot={<SourceBadge source={source} cached={cached} />}
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
      description="Tap a match to update the analysis instantly."
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
            <Card
              key={match.id}
              selected={selectedMatch?.id === match.id}
              onClick={() => setSelectedMatchId(match.id)}
            >
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
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: "13px",
                  color:
                    selectedMatch?.id === match.id ? "#6ee7b7" : "#cbd5e1",
                  fontWeight: 600,
                }}
              >
                {selectedMatch?.id === match.id ? "Selected" : "Open analysis"}
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
          <Card selected>
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

          {bestValueBet ? (
            <Card selected>
              <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>
                Best current angle
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "20px", fontWeight: 700 }}>
                {bestValueBet.side} • {bestValueBet.team}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#6ee7b7" }}>
                Odds {bestValueBet.odds} • EV {bestValueBet.edgePct}%
              </p>
            </Card>
          ) : null}

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
          valueBets.map((row, index) => (
            <Card key={`${row.side}-${row.team}`} selected={index === 0}>
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
                      fontWeight: 700,
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
      description="Ranked value opportunities across loaded matches."
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
