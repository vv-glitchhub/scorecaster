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

  return new Date(timestamp).toLocaleTimeString(lang === "fi" ? "fi-FI" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
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

      if (Array.isArray(nextData?.matches)) {
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
    background: active
      ? "rgba(16,185,129,0.14)"
      : "rgba(255,255,255,0.06)",
    color: active ? "#6ee7b7" : "#fff",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <PageSection
        title={lang === "fi" ? "Datan tila" : "Data Status"}
        description={
          lang === "fi"
            ? "Lähde, välimuisti ja automaattinen päivitys."
            : "Source, cache and automatic refresh."
        }
        rightSlot={
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <SourceBadge
              source={oddsData?.source}
              cached={oddsData?.cached}
              lang={lang}
            />
          </div>
        }
      >
        <div style={{ display: "grid", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div
              style={{
                border: "1px solid rgba(16,185,129,0.35)",
                background: "rgba(16,185,129,0.10)",
                color: "#6ee7b7",
                borderRadius: "999px",
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: 800,
              }}
            >
              {isRefreshing ? (lang === "fi" ? "PÄIVITTYY" : "UPDATING") : t.live}
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "#dbe4f0",
                borderRadius: "999px",
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: 800,
              }}
            >
              {t.updatedAt} {formatClock(lastUpdatedAt, lang)}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "16px",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <div>
              <p style={{ margin: "0 0 8px", color: "#94a3b8", fontSize: "14px" }}>
                {lang === "fi" ? "Päivitysväli" : "Refresh interval"}
              </p>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                style={inputStyle}
              >
                {[5, 10, 15, 30, 60].map((value) => (
                  <option key={value} value={value} style={{ color: "#000" }}>
                    {value}s
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                onClick={refreshOdds}
                disabled={isRefreshing}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: isRefreshing ? "not-allowed" : "pointer",
                  opacity: isRefreshing ? 0.7 : 1,
                }}
              >
                {t.refreshNow}
              </button>
            </div>
          </div>
        </div>
      </PageSection>

      <PageSection
        title={lang === "fi" ? "Markkinan valinta" : "Market Selection"}
        description={
          lang === "fi"
            ? "Valitse markkina analyysiä varten."
            : "Select the market for analysis."
        }
      >
        <MarketTabs market={market} onChange={setMarket} lang={lang} />
      </PageSection>

      <PageSection
        title={lang === "fi" ? "Panostus" : "Staking"}
        description={
          lang === "fi"
            ? "Valitse käsin panos tai käytä Kelly-ehdotusta."
            : "Choose a manual stake or use Kelly suggestion."
        }
      >
        <div style={{ display: "grid", gap: "16px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
            <div style={{ maxWidth: "260px" }}>
              <p style={{ margin: "0 0 8px", color: "#94a3b8", fontSize: "14px" }}>
                {lang === "fi" ? "Panos (€)" : "Stake (€)"}
              </p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualStake}
                onChange={(e) => setManualStake(e.target.value)}
                style={inputStyle}
              />
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "16px",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <div>
                <p style={{ margin: "0 0 8px", color: "#94a3b8", fontSize: "14px" }}>
                  {lang === "fi" ? "Kassa (€)" : "Bankroll (€)"}
                </p>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bankroll}
                  onChange={(e) => setBankroll(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <p style={{ margin: "0 0 8px", color: "#94a3b8", fontSize: "14px" }}>
                  {lang === "fi" ? "Kelly-osuus" : "Kelly Fraction"}
                </p>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={kellyFraction}
                  onChange={(e) => setKellyFraction(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          )}
        </div>
      </PageSection>

      <PageSection
        title={lang === "fi" ? "Ottelut" : "Matches"}
        description={
          lang === "fi"
            ? "Kaikki saatavilla olevat ottelut."
            : "All available matches."
        }
      >
        <div style={{ display: "grid", gap: "12px" }}>
          {matches.length === 0 ? (
            <div
              style={{
                padding: "16px",
                borderRadius: "16px",
                background: "rgba(0,0,0,0.2)",
                color: "#94a3b8",
              }}
            >
              {lang === "fi" ? "Ei otteluita saatavilla." : "No matches available."}
            </div>
          ) : (
            matches.map((match) => (
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>
                      {match.home_team} vs {match.away_team}
                    </p>
                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: "13px",
                        color: "#94a3b8",
                      }}
                    >
                      {match.sport_title}
                    </p>
                  </div>

                  <div style={{ fontSize: "14px" }}>
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
                </div>
              </button>
            ))
          )}
        </div>
      </PageSection>

      <PageSection
        title={lang === "fi" ? "Ottelun markkinat" : "Match Markets"}
        description={
          lang === "fi"
            ? "Valitun ottelun markkinat ja vedon tallennus."
            : "Selected match markets and bet actions."
        }
      >
        {!selectedMatch ? (
          <div style={panelStyle}>
            {lang === "fi" ? "Valitse ensin ottelu." : "Select a match first."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            <div style={panelStyle}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "18px" }}>
                {selectedMatch.home_team} vs {selectedMatch.away_team}
              </p>
              <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: "14px" }}>
                {lang === "fi" ? "Markkina" : "Market"}: {currentMarketLabel}
              </p>
            </div>

            {marketRows.length === 0 ? (
              <div style={panelStyle}>
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
                      ...panelStyle,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "16px",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 700 }}>{row.label}</p>
                      <p style={{ margin: "8px 0 0", color: "#cbd5e1", fontSize: "14px" }}>
                        Odds {row.odds}
                      </p>
                      <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: "13px" }}>
                        {stakeMode === "kelly"
                          ? `${lang === "fi" ? "Kelly-ehdotus" : "Kelly Suggestion"}: €${recommendedStake.toFixed(2)}`
                          : `${lang === "fi" ? "Valittu panos" : "Selected Stake"}: €${(Number(manualStake) || 0).toFixed(2)}`}
                      </p>
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
                        {lang === "fi" ? "Lisää veto" : "Add Bet"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </PageSection>

      <PageSection
        title={lang === "fi" ? "Analyysin tarkennus" : "Analysis Detail"}
        description={
          lang === "fi"
            ? "Confidence breakdown, riskiliput, tallennetut kohteet ja markkinaliike."
            : "Confidence breakdown, risk flags, saved picks and market movement."
        }
      >
        <div
          style={{
            display: "grid",
            gap: "16px",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <ConfidenceBreakdown breakdown={confidenceBreakdown} lang={lang} />
          <RiskFlags flags={riskFlags} lang={lang} />
          <FavoritesPanel lang={lang} />
          <MarketMovementPanel
            market={market}
            selectedMatch={selectedMatch}
            movements={movements}
            lang={lang}
          />
        </div>
      </PageSection>
    </div>
  );
}
