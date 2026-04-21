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

  const [oddsData, setOddsData] = useState(initialOddsData || {});
  const [market, setMarket] = useState("h2h");
  const [stakeMode, setStakeMode] = useState("manual");
  const [manualStake, setManualStake] = useState("10");
  const [bankroll, setBankroll] = useState("1000");
  const [kellyFraction, setKellyFraction] = useState("0.25");
  const [refreshInterval, setRefreshInterval] = useState(15);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(Date.now());

  const matches = Array.isArray(oddsData?.matches) ? oddsData.matches : [];

  const [selectedMatchId, setSelectedMatchId] = useState(
    matches[0]?.id || null
  );

  const selectedMatch = useMemo(() => {
    if (!matches.length) return null;
    return matches.find((match) => match?.id === selectedMatchId) || matches[0] || null;
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
      setOddsData(nextData || {});
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
    if (matches.length > 0) {
      addSnapshot({ market, matches });
    }
  }, [market, matches, addSnapshot]);

  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;
    const timer = setInterval(refreshOdds, refreshInterval * 1000);
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
      const point = selectedMatch?.bestOdds?.point ?? "-";
      return [
        {
          key: "over",
          label: `Over ${point}`,
          odds: selectedMatch?.bestOdds?.over ?? null,
          probability: 0.52,
        },
        {
          key: "under",
          label: `Under ${point}`,
          odds: selectedMatch?.bestOdds?.under ?? null,
          probability: 0.48,
        },
      ].filter((row) => row.odds);
    }

    if (market === "spreads") {
      return [
        {
          key: "spread-home",
          label: `${selectedMatch?.home_team || "Home"} ${
            selectedMatch?.bestOdds?.spreadPointHome ?? ""
          }`,
          odds: selectedMatch?.bestOdds?.spreadHome ?? null,
          probability: 0.52,
        },
        {
          key: "spread-away",
          label: `${selectedMatch?.away_team || "Away"} ${
            selectedMatch?.bestOdds?.spreadPointAway ?? ""
          }`,
          odds: selectedMatch?.bestOdds?.spreadAway ?? null,
          probability: 0.48,
        },
      ].filter((row) => row.odds);
    }

    return [
      {
        key: "home",
        label: selectedMatch?.home_team || "Home",
        odds: selectedMatch?.bestOdds?.home ?? null,
        probability: 0.45,
      },
      {
        key: "draw",
        label: t.draw || (lang === "fi" ? "Tasapeli" : "Draw"),
        odds: selectedMatch?.bestOdds?.draw ?? null,
        probability: 0.23,
      },
      {
        key: "away",
        label: selectedMatch?.away_team || "Away",
        odds: selectedMatch?.bestOdds?.away ?? null,
        probability: 0.32,
      },
    ].filter((row) => row.odds);
  }, [selectedMatch, market, t.draw, lang]);

  const currentMarketLabel =
    market === "h2h"
      ? t.h2h || "H2H"
      : market === "totals"
      ? t.totals || "Totals"
      : t.handicap || "Handicap";

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
      match: `${selectedMatch?.home_team || "Home"} vs ${selectedMatch?.away_team || "Away"}`,
      selection: `${currentMarketLabel} • ${row.label || "-"}`,
      odds: Number(row.odds),
      stake: Number(stake),
    });
  }

  function handleToggleFavorite(row) {
    if (!selectedMatch || !row?.odds) return;

    toggleFavorite({
      id: `${selectedMatch.id}-${market}-${row.key}`,
      match: `${selectedMatch?.home_team || "Home"} vs ${selectedMatch?.away_team || "Away"}`,
      selection: `${currentMarketLabel} • ${row.label || "-"}`,
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
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <SourceBadge>
              {String(oddsData?.source || "unknown").toUpperCase()}
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
                {(t.updatedAt || (lang === "fi" ? "Päivitetty" : "Updated")) +
                  " " +
                  formatClock(lastUpdatedAt, lang)}
              </div>

              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                style={{ ...inputStyle, width: "140px" }}
              >
                {[5, 10, 15, 30, 60].map((value) => (
                  <option key={value} value={value}>
                    {value}s
                  </option>
                ))}
              </select>

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
                }}
              >
                {t.refreshNow || (lang === "fi" ? "Päivitä nyt" : "Refresh now")}
              </button>
            </div>
          </div>

          <MarketTabs market={market} onChange={setMarket} lang={lang} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
            }}
          >
            <div style={panelStyle}>
              <div style={{ fontWeight: 800, marginBottom: "12px", fontSize: "16px" }}>
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
                  {lang === "fi" ? "Manuaalinen panos" : "Manual stake"}
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
                <input
                  value={manualStake}
                  onChange={(e) => setManualStake(e.target.value)}
                  style={inputStyle}
                />
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
                  <input
                    value={bankroll}
                    onChange={(e) => setBankroll(e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    value={kellyFraction}
                    onChange={(e) => setKellyFraction(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              )}
            </div>

            <FavoritesPanel lang={lang} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1.35fr)",
              gap: "16px",
            }}
          >
            <div style={panelStyle}>
              <div style={{ fontWeight: 800, marginBottom: "12px", fontSize: "16px" }}>
                {lang === "fi" ? "Ottelut" : "Matches"}
              </div>

              {matches.length === 0 ? (
                <div style={{ color: "#94a3b8" }}>
                  {lang === "fi" ? "Ei otteluita saatavilla." : "No matches available."}
                </div>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
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
                        {(match?.home_team || "Home") + " vs " + (match?.away_team || "Away")}
                      </div>

                      <div
                        style={{
                          marginTop: "6px",
                          color: "#94a3b8",
                          fontSize: "13px",
                        }}
                      >
                        {match?.sport_title || "-"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: "16px", alignContent: "start" }}>
              {!selectedMatch ? (
                <div style={panelStyle}>
                  <div style={{ color: "#94a3b8" }}>
                    {lang === "fi"
                      ? "Ei dataa saatavilla vielä."
                      : "No data available yet."}
                  </div>
                </div>
              ) : (
                <>
                  <div style={panelStyle}>
                    <div style={{ fontWeight: 800, fontSize: "18px" }}>
                      {(selectedMatch?.home_team || "Home") +
                        " vs " +
                        (selectedMatch?.away_team || "Away")}
                    </div>

                    <div
                      style={{
                        marginTop: "8px",
                        color: "#94a3b8",
                        fontSize: "14px",
                      }}
                    >
                      {(lang === "fi" ? "Markkina" : "Market") + ": " + currentMarketLabel}
                    </div>

                    <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
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
                                    {row.label || "-"}
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
                                          lang === "fi" ? "Kelly-ehdotus" : "Kelly suggestion"
                                        }: €${recommendedStake.toFixed(2)}`
                                      : `${
                                          lang === "fi" ? "Valittu panos" : "Selected stake"
                                        }: €${(Number(manualStake) || 0).toFixed(2)}`}
                                  </div>
                                </div>

                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
                                    {lang === "fi" ? "Lisää veto" : "Add bet"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <ConfidenceBreakdown breakdown={confidenceBreakdown} lang={lang} />
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
