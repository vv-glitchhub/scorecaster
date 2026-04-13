"use client";

import { useEffect, useMemo, useState } from "react";
import PageSection from "@/app/components/PageSection";
import SourceBadge from "@/app/components/SourceBadge";
import MarketTabs from "@/app/components/MarketTabs";
import LivePulse from "@/app/components/LivePulse";
import { useBreakpoint } from "@/lib/useBreakpoint";
import {
  buildValueBetRows,
  getModelProbabilitiesForMatch,
} from "@/lib/model-engine-v1";
import { buildValueBetMetrics } from "@/lib/value-engine-v2";
import { kellyStake } from "@/lib/kelly";

const SPORT_KEY = "icehockey_liiga";
const REFRESH_MS = 15000;

function getCardStyle({ selected = false, positive = null, clickable = false } = {}) {
  let border = selected
    ? "1px solid rgba(16,185,129,0.7)"
    : "1px solid rgba(255,255,255,0.1)";
  let background = selected
    ? "rgba(16,185,129,0.12)"
    : "rgba(0,0,0,0.2)";

  if (positive === true) {
    border = "1px solid rgba(16,185,129,0.55)";
    background = "rgba(16,185,129,0.08)";
  }

  if (positive === false) {
    border = "1px solid rgba(239,68,68,0.28)";
    background = "rgba(239,68,68,0.05)";
  }

  return {
    border,
    background,
    borderRadius: "16px",
    padding: "16px",
    cursor: clickable ? "pointer" : "default",
    transition: "0.2s ease",
  };
}

function Card({ children, selected = false, positive = null, onClick }) {
  const clickable = typeof onClick === "function";

  return (
    <div onClick={onClick} style={getCardStyle({ selected, positive, clickable })}>
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

function formatProbability(value) {
  if (value == null) return "-";
  return `${Number(value).toFixed(2)}%`;
}

function formatSignedPercent(value) {
  if (value == null) return "-";
  const num = Number(value);
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

function formatEuro(value) {
  if (!value || value <= 0) return "€0";
  return `€${Number(value).toFixed(2)}`;
}

function getProbabilityForRow(row, model, market) {
  if (!model) return null;

  if (market === "totals") {
    return row.side === "OVER" ? model.over : model.under;
  }

  if (market === "spreads") {
    return row.side === "SPREAD_HOME" ? model.spreadHome : model.spreadAway;
  }

  if (row.side === "HOME") return model.home;
  if (row.side === "DRAW") return model.draw;
  return model.away;
}

export default function BettingWorkspaceClient({
  initialMarketMatches,
  initialSelectedMatchId,
  initialSource,
  initialCached,
}) {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  const [market, setMarket] = useState("h2h");
  const [marketMatches, setMarketMatches] = useState(
    initialMarketMatches || { h2h: [], totals: [], spreads: [] }
  );
  const [selectedMatchId, setSelectedMatchId] = useState(
    initialSelectedMatchId || initialMarketMatches?.h2h?.[0]?.id || null
  );
  const [sourceByMarket, setSourceByMarket] = useState({
    h2h: initialSource || "unknown",
    totals: initialSource || "unknown",
    spreads: initialSource || "unknown",
  });
  const [cachedByMarket, setCachedByMarket] = useState({
    h2h: Boolean(initialCached),
    totals: Boolean(initialCached),
    spreads: Boolean(initialCached),
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(Date.now());
  const [onlyValue, setOnlyValue] = useState(false);

  const bankroll = 1000;
  const kellyFraction = 0.25;

  const matches = marketMatches?.[market] || [];
  const currentSource = sourceByMarket?.[market] || "unknown";
  const currentCached = Boolean(cachedByMarket?.[market]);

  const selectedMatch = useMemo(() => {
    return matches.find((match) => match.id === selectedMatchId) || matches[0] || null;
  }, [matches, selectedMatchId]);

  const model = useMemo(() => {
    if (!selectedMatch) return null;
    return getModelProbabilitiesForMatch(selectedMatch, market);
  }, [selectedMatch, market]);

  const rawValueBets = useMemo(() => {
    if (!selectedMatch || !model) return [];
    return buildValueBetRows(selectedMatch, model, market);
  }, [selectedMatch, model, market]);

  const valueBets = useMemo(() => {
    return rawValueBets.map((row) => {
      const probability = getProbabilityForRow(row, model, market);

      const metrics = buildValueBetMetrics({
        odds: row.odds,
        modelProbability: probability,
        bookmaker: row.bookmaker,
        side: row.side,
        team: row.team,
      });

      return {
        ...row,
        ...metrics,
        stake: kellyStake({
          probability,
          odds: row.odds,
          bankroll,
          fraction: kellyFraction,
        }),
      };
    });
  }, [rawValueBets, model, market]);

  const filteredValueBets = useMemo(() => {
    if (!onlyValue) return valueBets;
    return valueBets.filter((row) => row.expectedValue != null && row.expectedValue > 0);
  }, [onlyValue, valueBets]);

  const topPicks = useMemo(() => {
    return matches
      .flatMap((match) => {
        const matchModel = getModelProbabilitiesForMatch(match, market);
        const rows = buildValueBetRows(match, matchModel, market);

        return rows.map((row) => {
          const probability = getProbabilityForRow(row, matchModel, market);

          const metrics = buildValueBetMetrics({
            odds: row.odds,
            modelProbability: probability,
            bookmaker: row.bookmaker,
            side: row.side,
            team: row.team,
          });

          return {
            matchId: match.id,
            home_team: match.home_team,
            away_team: match.away_team,
            selection: row.side,
            team: row.team,
            confidence: matchModel.confidence,
            ...metrics,
          };
        });
      })
      .filter((pick) => pick.expectedValue != null)
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .slice(0, 8);
  }, [matches, market]);

  const visibleTopPicks = isMobile ? topPicks.slice(0, 4) : topPicks;

  const bestValueBet =
    filteredValueBets.find(
      (row) => row.expectedValue != null && row.expectedValue > 0
    ) || null;

  useEffect(() => {
    const nextMatches = marketMatches?.[market] || [];
    if (!nextMatches.length) {
      setSelectedMatchId(null);
      return;
    }

    const exists = nextMatches.some((match) => match.id === selectedMatchId);
    if (!exists) {
      setSelectedMatchId(nextMatches[0].id);
    }
  }, [market, marketMatches, selectedMatchId]);

  useEffect(() => {
    let active = true;

    async function refreshAllMarkets() {
      try {
        setIsRefreshing(true);

        const markets = ["h2h", "totals", "spreads"];
        const results = await Promise.all(
          markets.map(async (marketKey) => {
            const res = await fetch(
              `/api/odds?sport=${SPORT_KEY}&market=${marketKey}&refresh=1`,
              {
                method: "GET",
                cache: "no-store",
              }
            );

            if (!res.ok) {
              throw new Error(`Refresh failed for ${marketKey}`);
            }

            const json = await res.json();
            return { marketKey, json };
          })
        );

        if (!active) return;

        setMarketMatches((prev) => {
          const next = { ...prev };
          for (const item of results) {
            next[item.marketKey] = item.json?.matches || [];
          }
          return next;
        });

        setSourceByMarket((prev) => {
          const next = { ...prev };
          for (const item of results) {
            next[item.marketKey] = item.json?.source || "unknown";
          }
          return next;
        });

        setCachedByMarket((prev) => {
          const next = { ...prev };
          for (const item of results) {
            next[item.marketKey] = Boolean(item.json?.cached);
          }
          return next;
        });

        setLastUpdatedAt(Date.now());
      } catch (error) {
        console.error(error);
      } finally {
        if (active) {
          setIsRefreshing(false);
        }
      }
    }

    const timer = setInterval(refreshAllMarkets, REFRESH_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);

      const markets = ["h2h", "totals", "spreads"];
      const results = await Promise.all(
        markets.map(async (marketKey) => {
          const res = await fetch(
            `/api/odds?sport=${SPORT_KEY}&market=${marketKey}&refresh=1`,
            {
              method: "GET",
              cache: "no-store",
            }
          );

          if (!res.ok) {
            throw new Error(`Refresh failed for ${marketKey}`);
          }

          const json = await res.json();
          return { marketKey, json };
        })
      );

      setMarketMatches((prev) => {
        const next = { ...prev };
        for (const item of results) {
          next[item.marketKey] = item.json?.matches || [];
        }
        return next;
      });

      setSourceByMarket((prev) => {
        const next = { ...prev };
        for (const item of results) {
          next[item.marketKey] = item.json?.source || "unknown";
        }
        return next;
      });

      setCachedByMarket((prev) => {
        const next = { ...prev };
        for (const item of results) {
          next[item.marketKey] = Boolean(item.json?.cached);
        }
        return next;
      });

      setLastUpdatedAt(Date.now());
    } catch (error) {
      console.error(error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const mainColumns = isDesktop ? "1.1fr 1.5fr 1fr" : "1fr";
  const statColsTop = isMobile ? "1fr" : "repeat(3, 1fr)";
  const statColsBottom = isMobile ? "1fr 1fr" : "repeat(4, 1fr)";
  const mobileSectionGap = isMobile ? "16px" : "24px";

  const getOddsCards = () => {
    if (!selectedMatch) return null;

    if (market === "totals") {
      return (
        <div style={{ display: "grid", gap: "16px", gridTemplateColumns: statColsTop }}>
          <StatCard
            label={`Over ${selectedMatch.bestOdds?.point ?? "-"}`}
            value={selectedMatch.bestOdds?.over ?? "-"}
          />
          <StatCard
            label={`Under ${selectedMatch.bestOdds?.point ?? "-"}`}
            value={selectedMatch.bestOdds?.under ?? "-"}
          />
        </div>
      );
    }

    if (market === "spreads") {
      return (
        <div style={{ display: "grid", gap: "16px", gridTemplateColumns: statColsTop }}>
          <StatCard
            label={`${selectedMatch.home_team} ${selectedMatch.bestOdds?.spreadPointHome ?? ""}`}
            value={selectedMatch.bestOdds?.spreadHome ?? "-"}
          />
          <StatCard
            label={`${selectedMatch.away_team} ${selectedMatch.bestOdds?.spreadPointAway ?? ""}`}
            value={selectedMatch.bestOdds?.spreadAway ?? "-"}
          />
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: "16px", gridTemplateColumns: statColsTop }}>
        <StatCard label="Home odds" value={selectedMatch.bestOdds?.home ?? "-"} />
        <StatCard label="Draw odds" value={selectedMatch.bestOdds?.draw ?? "-"} />
        <StatCard label="Away odds" value={selectedMatch.bestOdds?.away ?? "-"} />
      </div>
    );
  };

  const getModelCards = () => {
    if (market === "totals") {
      return (
        <div
          style={{
            display: "grid",
            gap: "16px",
            gridTemplateColumns: isMobile ? "1fr 1fr 1fr" : "repeat(3, 1fr)",
          }}
        >
          <StatCard
            label="Model Over"
            value={model ? `${(model.over * 100).toFixed(1)}%` : "-"}
          />
          <StatCard
            label="Model Under"
            value={model ? `${(model.under * 100).toFixed(1)}%` : "-"}
          />
          <StatCard
            label="Confidence"
            value={model ? `${model.confidence}%` : "-"}
          />
        </div>
      );
    }

    if (market === "spreads") {
      return (
        <div
          style={{
            display: "grid",
            gap: "16px",
            gridTemplateColumns: isMobile ? "1fr 1fr 1fr" : "repeat(3, 1fr)",
          }}
        >
          <StatCard
            label="Spread Home"
            value={model ? `${(model.spreadHome * 100).toFixed(1)}%` : "-"}
          />
          <StatCard
            label="Spread Away"
            value={model ? `${(model.spreadAway * 100).toFixed(1)}%` : "-"}
          />
          <StatCard
            label="Confidence"
            value={model ? `${model.confidence}%` : "-"}
          />
        </div>
      );
    }

    return (
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
    );
  };

  const confidenceBar = (
    <div
      style={{
        height: "8px",
        background: "rgba(255,255,255,0.08)",
        borderRadius: "999px",
        overflow: "hidden",
        marginTop: "10px",
      }}
    >
      <div
        style={{
          width: `${model?.confidence || 0}%`,
          height: "100%",
          borderRadius: "999px",
          background: "linear-gradient(90deg, #10b981, #34d399)",
        }}
      />
    </div>
  );

  const FiltersBlock = (
    <PageSection
      title="Filters"
      description="Sport / league / market controls can expand here."
      rightSlot={<SourceBadge source={currentSource} cached={currentCached} />}
    >
      <div style={{ display: "grid", gap: "12px" }}>
        <Card>
          <LivePulse isRefreshing={isRefreshing} lastUpdatedAt={lastUpdatedAt} />
          <button
            type="button"
            onClick={handleManualRefresh}
            style={{
              marginTop: "12px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              borderRadius: "12px",
              padding: "10px 12px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Refresh now
          </button>
        </Card>

        <Card>
          <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Sport</p>
          <p style={{ margin: "8px 0 0", fontWeight: 700 }}>Ice Hockey</p>
        </Card>

        <Card>
          <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>League</p>
          <p style={{ margin: "8px 0 0", fontWeight: 700 }}>Liiga</p>
        </Card>

        <Card>
          <p style={{ margin: "0 0 10px", fontSize: "14px", color: "#94a3b8" }}>
            Market
          </p>
          <MarketTabs
            market={market}
            onChange={(nextMarket) => {
              setMarket(nextMarket);
              const nextMatches = marketMatches?.[nextMarket] || [];
              setSelectedMatchId(nextMatches?.[0]?.id || null);
            }}
          />
        </Card>

        <Card onClick={() => setOnlyValue((prev) => !prev)} selected={onlyValue}>
          <p style={{ margin: 0, fontWeight: 700 }}>Only Value Bets</p>
          <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#94a3b8" }}>
            {onlyValue ? "Showing positive EV only" : "Showing all rows"}
          </p>
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
              key={`${market}-${match.id}`}
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
      description="Main match view, market odds and model output."
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
            <p style={{ margin: 0, fontSize: isMobile ? "22px" : "24px", fontWeight: 700 }}>
              {selectedMatch.home_team} vs {selectedMatch.away_team}
            </p>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: "14px",
                color: "#94a3b8",
              }}
            >
              Market: {market.toUpperCase()}
            </p>
            {confidenceBar}
          </Card>

          {bestValueBet ? (
            <Card selected positive>
              <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>
                Best Bet Right Now
              </p>
              <p style={{ margin: "8px 0 0", fontSize: isMobile ? "18px" : "20px", fontWeight: 700 }}>
                {bestValueBet.side} • {bestValueBet.team}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#6ee7b7" }}>
                Odds {bestValueBet.odds} • EV {formatSignedPercent(bestValueBet.expectedValue)}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#cbd5e1" }}>
                Fair {bestValueBet.fairOdds} • Edge {formatSignedPercent(bestValueBet.edge)}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#fcd34d" }}>
                Stake {formatEuro(bestValueBet.stake)}
              </p>
            </Card>
          ) : null}

          {getOddsCards()}
          {getModelCards()}
        </div>
      )}
    </PageSection>
  );

  const ValueBetsBlock = (
    <PageSection
      title="Value Bets"
      description="Model edge versus current market odds."
    >
      <div style={{ display: "grid", gap: "12px" }}>
        {filteredValueBets.length === 0 ? (
          <Card>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
              No value bet rows available.
            </p>
          </Card>
        ) : (
          filteredValueBets.map((row, index) => (
            <Card
              key={`${market}-${row.side}-${row.team}`}
              selected={index === 0}
              positive={
                row.expectedValue > 0 ? true : row.expectedValue < 0 ? false : null
              }
            >
              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
                  alignItems: "start",
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
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "14px",
                      color: "#cbd5e1",
                    }}
                  >
                    Model {formatProbability(row.modelProbability)}
                  </p>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: "14px",
                      color: "#cbd5e1",
                    }}
                  >
                    Implied {formatProbability(row.impliedProbability)}
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
                      color: row.edge > 0 ? "#6ee7b7" : "#fda4af",
                      fontWeight: 700,
                    }}
                  >
                    Edge {formatSignedPercent(row.edge)}
                  </p>
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: row.expectedValue > 0 ? "#6ee7b7" : "#fda4af",
                      fontWeight: 700,
                    }}
                  >
                    EV {formatSignedPercent(row.expectedValue)}
                  </p>
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#fcd34d",
                      fontWeight: 700,
                    }}
                  >
                    Stake {formatEuro(row.stake)}
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
        {visibleTopPicks.length === 0 ? (
          <Card>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
              No backend picks available.
            </p>
          </Card>
        ) : (
          visibleTopPicks.map((pick) => (
            <Card
              key={`${market}-${pick.matchId}-${pick.selection}`}
              positive={
                pick.expectedValue > 0 ? true : pick.expectedValue < 0 ? false : null
              }
            >
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
                  color: pick.expectedValue > 0 ? "#6ee7b7" : "#fda4af",
                }}
              >
                EV {formatSignedPercent(pick.expectedValue)} • Confidence {pick.confidence}%
              </p>
            </Card>
          ))
        )}
      </div>
    </PageSection>
  );

  const BankrollBlock = (
    <PageSection title="Bankroll" description="Quarter Kelly stake preview.">
      <div style={{ display: "grid", gap: "12px" }}>
        <StatCard label="Bankroll" value="€1,000" />
        <StatCard label="Staking model" value="Quarter Kelly" />
        <StatCard label="Kelly fraction" value="25%" />
        <StatCard label="Refresh interval" value="15s" />
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
        {FiltersBlock}
        {ValueBetsBlock}
        <div
          style={{
            display: "grid",
            gap: mobileSectionGap,
            gridTemplateColumns: "1fr 1fr",
          }}
        >
          {BankrollBlock}
          <div />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: mobileSectionGap }}>
      {SelectedMatchBlock}
      {MatchesBlock}
      {FiltersBlock}
      {ValueBetsBlock}
      {TopPicksBlock}
      {BankrollBlock}
    </div>
  );
}
