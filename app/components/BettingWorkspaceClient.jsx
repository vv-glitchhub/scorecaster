"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageSection from "@/app/components/PageSection";
import SourceBadge from "@/app/components/SourceBadge";
import MarketTabs from "@/app/components/MarketTabs";
import FavoritesPanel from "@/app/components/FavoritesPanel";
import ConfidenceBreakdown from "@/app/components/ConfidenceBreakdown";
import RiskFlags from "@/app/components/RiskFlags";
import MarketMovementPanel from "@/app/components/MarketMovementPanel";
import {
  buildConfidenceBreakdown,
  buildRiskFlags,
} from "@/lib/confidence-engine";
import { useFavoritesStore } from "@/lib/favorites-store";
import {
  useOddsHistoryStore,
  useMatchOddsMovements,
} from "@/lib/odds-history-store";
import { getDictionary } from "@/lib/i18n";
import { useBetStore } from "@/lib/useBetStore";
import { kellyStake } from "@/lib/kelly";

function formatClock(timestamp, lang) {
  if (!timestamp) return "-";

  return new Date(timestamp).toLocaleTimeString(
    lang === "fi" ? "fi-FI" : "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }
  );
}

export default function BettingWorkspaceClient({
  initialOddsData,
  lang = "fi",
}) {
  const t = getDictionary(lang);
  const { addBet } = useBetStore();
  const { toggleFavorite, isFavorite } = useFavoritesStore();
  const { addSnapshot, getSnapshots } = useOddsHistoryStore();

  const [oddsData, setOddsData] = useState(initialOddsData);
  const [market, setMarket] = useState("h2h");
  const [selectedMatchId, setSelectedMatchId] = useState(
    initialOddsData?.matches?.[0]?.id || null
  );

  const [stakeMode, setStakeMode] = useState("manual");
  const [manualStake, setManualStake] = useState("10");
  const [bankroll, setBankroll] = useState("1000");
  const [kellyFraction, setKellyFraction] = useState("0.25");

  const [refreshInterval, setRefreshInterval] = useState(15);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(Date.now());

  const matches = oddsData?.matches || [];

  const selectedMatch = useMemo(() => {
    return matches.find((match) => match.id === selectedMatchId) || matches[0] || null;
  }, [matches, selectedMatchId]);

  useEffect(() => {
    if (!selectedMatch && matches.length > 0) {
      setSelectedMatchId(matches[0].id);
    }
  }, [matches, selectedMatch]);

  const refreshOdds = useCallback(async () => {
    try {
      setIsRefreshing(true);

      const response = await fetch("/api/odds?sport=icehockey_liiga", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh odds");
      }

      const nextData = await response.json();

      setOddsData(nextData);
      setLastUpdatedAt(Date.now());

      if (Array.isArray(nextData?.matches) && nextData.matches.length > 0) {
        addSnapshot({
          market,
          matches: nextData.matches,
        });
      }
    } catch (error) {
      console.error("Auto refresh failed", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [addSnapshot, market]);

  useEffect(() => {
    if (Array.isArray(matches) && matches.length > 0) {
      addSnapshot({
        market,
        matches,
      });
    }
  }, [market, matches, addSnapshot]);

  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return undefined;

    const timer = setInterval(() => {
      refreshOdds();
    }, refreshInterval * 1000);

    return () => clearInterval(timer);
  }, [refreshInterval, refreshOdds]);

  const snapshots = selectedMatch ? getSnapshots(market, selectedMatch.id) : [];
  const movements = useMatchOddsMovements({ snapshots, market });

  const confidenceBreakdown = useMemo(() => {
    if (!selectedMatch) return null;
    return buildConfidenceBreakdown(selectedMatch, market);
  }, [selectedMatch, market]);

  const riskFlags = useMemo(() => {
    if (!selectedMatch) return [];
    return buildRiskFlags(selectedMatch, market);
  }, [selectedMatch, market]);

  const marketRows = useMemo(() => {
    if (!selectedMatch) return [];

    if (market === "totals") {
      const point = selectedMatch.bestOdds?.point ?? "-";

      return [
        {
          key: "over",
          label: `Over ${point}`,
          odds: selectedMatch.bestOdds?.over ?? null,
          probability: 0.52,
        },
        {
          key: "under",
          label: `Under ${point}`,
          odds: selectedMatch.bestOdds?.under ?? null,
          probability: 0.48,
        },
      ].filter((row) => row.odds);
    }

    if (market === "spreads") {
      return [
        {
          key: "spread-home",
          label: `${selectedMatch.home_team} ${selectedMatch.bestOdds?.spreadPointHome ?? ""}`,
          odds: selectedMatch.bestOdds?.spreadHome ?? null,
          probability: 0.52,
        },
        {
          key: "spread-away",
          label: `${selectedMatch.away_team} ${selectedMatch.bestOdds?.spreadPointAway ?? ""}`,
          odds: selectedMatch.bestOdds?.spreadAway ?? null,
          probability: 0.48,
        },
      ].filter((row) => row.odds);
    }

    return [
      {
        key: "home",
        label: selectedMatch.home_team,
        odds: selectedMatch.bestOdds?.home ?? null,
        probability: 0.45,
      },
      {
        key: "draw",
        label: t.draw,
        odds: selectedMatch.bestOdds?.draw ?? null,
        probability: 0.23,
      },
      {
        key: "away",
        label: selectedMatch.away_team,
        odds: selectedMatch.bestOdds?.away ?? null,
        probability: 0.32,
      },
    ].filter((row) => row.odds);
  }, [selectedMatch, market, t.draw]);

  const currentMarketLabel =
    market === "h2h" ? t.h2h : market === "totals" ? t.totals : t.handicap;

  function getStakeForRow(row) {
    if (stakeMode === "kelly") {
      return kellyStake({
        probability: row.probability,
        odds: Number(row.odds),
        bankroll: Number(bankroll) || 0,
        fraction: Number(kellyFraction) || 0.25,
      });
    }

    return Number(manualStake) || 0;
  }

  function handleAddBet(row) {
    if (!selectedMatch || !row?.odds) return;

    const stake = getStakeForRow(row);
    if (!stake || stake <= 0) return;

    addBet({
      match: `${selectedMatch.home_team} vs ${selectedMatch.away_team}`,
      selection: `${currentMarketLabel} • ${row.label}`,
      odds: Number(row.odds),
      stake: Number(stake),
    });
  }

  function handleToggleFavorite(row) {
    if (!selectedMatch || !row?.odds) return;

    toggleFavorite({
      id: `${selectedMatch.id}-${market}-${row.key}`,
      match: `${selectedMatch.home_team} vs ${selectedMatch.away_team}`,
      selection: `${currentMarketLabel} • ${row.label}`,
      odds: Number(row.odds),
      market,
    });
  }

  const panelStyle = {
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "16px",
    padding: "16px",
    background: "rgba(0,0,0,0.2)",
  };

  const inputStyle = {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "14px",
    boxSizing: "border-box",
  };

  const smallButton = (active) => ({
    border: active
      ? "1px solid rgba(16,185,129,0.7)"
      : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(16,185,129,0.14)" : "rgba(255,255,255,0.06)",
    color: active ? "#6ee7b7" : "#fff",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <PageSection
        title={lang === "fi" ? "Vedonlyöntityötila" : "Betting Workspace"}
        subtitle={
          lang === "fi"
            ? "Live-oddsit, panoksenhallinta ja markkinaliikkeet yhdessä näkymässä."
            : "Live odds, staking controls and market movement in one workspace."
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gap: "16px",
          }}
        >
          <div
            style={{
              gridColumn: "span 12",
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <SourceBadge>
              {isRefreshing ? (lang === "fi" ? "PÄIVITTYY" : "UPDATING") : t.live}
            </SourceBadge>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                {t.updatedAt} {formatClock(lastUpdatedAt, lang)}
              </div>

              <div style={{ minWidth: "150px" }}>
                <label
                  style={{
                    display: "block",
                    color: "#94a3b8",
                    fontSize: "12px",
                    marginBottom: "6px",
                  }}
                >
                  {lang === "fi" ? "Päivitysväli" : "Refresh interval"}
                </label>

                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  style={inputStyle}
                >
                  {[5, 10, 15, 30, 60].map((value) => (
                    <option key={value} value={value}>
                      {value}s
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={refreshOdds}
                disabled={isRefreshing}
                style={{
                  border: "1px solid rgba(34,197,94,0.5)",
                  background: isRefreshing
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(34,197,94,0.14)",
                  color: "#fff",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  fontSize: "14px",
                  fontWeight: 800,
                  cursor: isRefreshing ? "default" : "pointer",
                  minWidth: "140px",
                }}
              >
                {t.refreshNow}
              </button>
            </div>
          </div>

          <div style={{ gridColumn: "span 12" }}>
            <MarketTabs market={market} onChange={setMarket} lang={lang} />
          </div>

          <div
            style={{
              gridColumn: "span 12",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
            }}
          >
            <div style={panelStyle}>
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: "12px",
                  fontSize: "16px",
                }}
              >
                {lang === "fi" ? "Panostus" : "Staking"}
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginBottom: "14px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setStakeMode("manual")}
                  style={smallButton(stakeMode === "manual")}
                >
                  {lang === "fi" ? "Manuaalinen panos" : "Manual Stake"}
                </button>

                <button
                  type="button"
                  onClick={() => setStakeMode("kelly")}
                  style={smallButton(stakeMode === "kelly")}
                >
                  Kelly
                </button>
              </div>

              {stakeMode === "manual" ? (
                <div>
                  <label
                    style={{
                      display: "block",
                      color: "#94a3b8",
                      fontSize: "12px",
                      marginBottom: "6px",
                    }}
                  >
                    {lang === "fi" ? "Panos (€)" : "Stake (€)"}
                  </label>
                  <input
                    value={manualStake}
                    onChange={(e) => setManualStake(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        color: "#94a3b8",
                        fontSize: "12px",
                        marginBottom: "6px",
                      }}
                    >
                      {lang === "fi" ? "Kassa (€)" : "Bankroll (€)"}
                    </label>
                    <input
                      value={bankroll}
                      onChange={(e) => setBankroll(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        color: "#94a3b8",
                        fontSize: "12px",
                        marginBottom: "6px",
                      }}
                    >
                      {lang === "fi" ? "Kelly-osuus" : "Kelly Fraction"}
                    </label>
                    <input
                      value={kellyFraction}
                      onChange={(e) => setKellyFraction(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
            </div>

            <FavoritesPanel lang={lang} />
          </div>

          <div
            style={{
              gridColumn: "span 12",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.4fr)",
              gap: "16px",
            }}
          >
            <div style={panelStyle}>
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: "12px",
                  fontSize: "16px",
                }}
              >
                {lang === "fi" ? "Ottelut" : "Matches"}
              </div>

              {matches.length === 0 ? (
                <div style={{ color: "#94a3b8" }}>
                  {lang === "fi" ? "Ei otteluita saatavilla." : "No matches available."}
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: "10px",
                  }}
                >
                  {matches.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => setSelectedMatchId(match.id)}
                      style={{
                        border:
                          selectedMatch?.id === match.id
                            ? "1px solid rgba(16,185,129,0.7)"
                            : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "16px",
                        padding: "16px",
                        background:
                          selectedMatch?.id === match.id
                            ? "rgba(16,185,129,0.10)"
                            : "rgba(0,0,0,0.2)",
                        color: "#fff",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: "15px" }}>
                        {match.home_team} vs {match.away_team}
                      </div>

                      <div
                        style={{
                          marginTop: "6px",
                          color: "#94a3b8",
                          fontSize: "13px",
                        }}
                      >
                        {match.sport_title}
                      </div>

                      <div
                        style={{
                          marginTop: "10px",
                          display: "grid",
                          gap: "4px",
                          fontSize: "13px",
                          color: "#dbe4f0",
                        }}
                      >
                        <div>
                          {t.home}: {match.bestOdds?.home ?? "-"}
                        </div>
                        <div>
                          {t.draw}: {match.bestOdds?.draw ?? "-"}
                        </div>
                        <div>
                          {t.away}: {match.bestOdds?.away ?? "-"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gap: "16px",
                alignContent: "start",
              }}
            >
              {!selectedMatch ? (
                <div style={panelStyle}>
                  <div style={{ color: "#94a3b8" }}>
                    {lang === "fi" ? "Valitse ensin ottelu." : "Select a match first."}
                  </div>
                </div>
              ) : (
                <>
                  <div style={panelStyle}>
                    <div style={{ fontWeight: 800, fontSize: "18px" }}>
                      {selectedMatch.home_team} vs {selectedMatch.away_team}
                    </div>

                    <div
                      style={{
                        marginTop: "8px",
                        color: "#94a3b8",
                        fontSize: "14px",
                      }}
                    >
                      {lang === "fi" ? "Markkina" : "Market"}: {currentMarketLabel}
                    </div>

                    <div
                      style={{
                        marginTop: "16px",
                        display: "grid",
                        gap: "12px",
                      }}
                    >
                      {marketRows.length === 0 ? (
                        <div style={{ color: "#94a3b8" }}>
                          {lang === "fi"
                            ? "Tälle markkinalle ei löytynyt rivejä."
                            : "No rows found for this market."}
                        </div>
                      ) : (
                        marketRows.map((row) => {
                          const recommendedStake = getStakeForRow(row);
                          const favoriteId = `${selectedMatch.id}-${market}-${row.key}`;
                          const favored = isFavorite(favoriteId);

                          return (
                            <div
                              key={row.key}
                              style={{
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: "14px",
                                padding: "14px",
                                background: "rgba(255,255,255,0.03)",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "12px",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: "15px" }}>
                                    {row.label}
                                  </div>
                                  <div
                                    style={{
                                      marginTop: "6px",
                                      color: "#dbe4f0",
                                      fontSize: "14px",
                                    }}
                                  >
                                    Odds {row.odds}
                                  </div>
                                  <div
                                    style={{
                                      marginTop: "6px",
                                      color: "#94a3b8",
                                      fontSize: "13px",
                                    }}
                                  >
                                    {stakeMode === "kelly"
                                      ? `${
                                          lang === "fi"
                                            ? "Kelly-ehdotus"
                                            : "Kelly Suggestion"
                                        }: €${recommendedStake.toFixed(2)}`
                                      : `${
                                          lang === "fi"
                                            ? "Valittu panos"
                                            : "Selected Stake"
                                        }: €${(Number(manualStake) || 0).toFixed(2)}`}
                                  </div>
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    gap: "8px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFavorite(row)}
                                    style={{
                                      border: favored
                                        ? "1px solid rgba(245,158,11,0.6)"
                                        : "1px solid rgba(255,255,255,0.12)",
                                      background: favored
                                        ? "rgba(245,158,11,0.14)"
                                        : "rgba(255,255,255,0.06)",
                                      color: favored ? "#fcd34d" : "#fff",
                                      borderRadius: "12px",
                                      padding: "10px 14px",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {favored
                                      ? lang === "fi"
                                        ? "Tallennettu"
                                        : "Saved"
                                      : lang === "fi"
                                      ? "Tallenna"
                                      : "Save"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleAddBet(row)}
                                    style={{
                                      border: "1px solid rgba(16,185,129,0.6)",
                                      background: "rgba(16,185,129,0.14)",
                                      color: "#6ee7b7",
                                      borderRadius: "12px",
                                      padding: "10px 14px",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {lang === "fi" ? "Lisää veto" : "Add Bet"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <ConfidenceBreakdown
                    breakdown={confidenceBreakdown}
                    lang={lang}
                  />

                  <RiskFlags flags={riskFlags} lang={lang} />

                  <MarketMovementPanel
                    market={market}
                    selectedMatch={selectedMatch}
                    movements={movements}
                    lang={lang}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </PageSection>
    </div>
  );
}
