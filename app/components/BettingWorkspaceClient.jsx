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

function normalizeOddsData(data) {
  const matches = Array.isArray(data?.matches) ? data.matches : [];

  return {
    source: data?.source || data?.status || "unknown",
    status: data?.status || "fresh",
    reason: data?.reason || "",
    matches: matches.map((match) => ({
      ...match,
      id:
        match?.id ||
        `${match?.sport_key || "sport"}:${match?.home_team || "home"}:${
          match?.away_team || "away"
        }:${match?.commence_time || "time"}`,
      home_team: match?.home_team || "Home",
      away_team: match?.away_team || "Away",
      sport_title: match?.sport_title || match?.sport_key || "-",
      bestOdds: {
        home: match?.bestOdds?.home ?? null,
        draw: match?.bestOdds?.draw ?? null,
        away: match?.bestOdds?.away ?? null,
        point: match?.bestOdds?.point ?? null,
        over: match?.bestOdds?.over ?? null,
        under: match?.bestOdds?.under ?? null,
        spreadPointHome: match?.bestOdds?.spreadPointHome ?? null,
        spreadPointAway: match?.bestOdds?.spreadPointAway ?? null,
        spreadHome: match?.bestOdds?.spreadHome ?? null,
        spreadAway: match?.bestOdds?.spreadAway ?? null,
      },
    })),
  };
}

function computeImpliedProbability(odds) {
  const n = Number(odds);
  if (!Number.isFinite(n) || n <= 1) return null;
  return 1 / n;
}

function buildTopPickMeta(row) {
  const implied = computeImpliedProbability(row?.odds);
  const model = row?.probability ?? null;
  const edge =
    implied != null && model != null ? Number((model - implied).toFixed(3)) : null;
  const ev =
    row?.odds && model != null
      ? Number((Number(row.odds) * Number(model) - 1).toFixed(3))
      : null;

  return {
    implied,
    model,
    edge,
    ev,
  };
}

export default function BettingWorkspaceClient({
  initialOddsData,
  lang = "fi",
}) {
  const t = getDictionary(lang);
  const { addBet } = useBetStore();
  const { toggleFavorite, isFavorite } = useFavoritesStore();
  const { addSnapshot, getSnapshots, clearHistory } = useOddsHistoryStore();

  const [oddsData, setOddsData] = useState(() =>
    normalizeOddsData(initialOddsData || {})
  );
  const [market, setMarket] = useState("h2h");
  const [stakeMode, setStakeMode] = useState("manual");
  const [manualStake, setManualStake] = useState("10");
  const [bankroll, setBankroll] = useState("1000");
  const [kellyFraction, setKellyFraction] = useState("0.25");
  const [refreshInterval, setRefreshInterval] = useState(15);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(Date.now());
  const [refreshError, setRefreshError] = useState("");

  const matches = oddsData.matches || [];

  const [selectedMatchId, setSelectedMatchId] = useState(matches[0]?.id || null);

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
      setRefreshError("");

      const response = await fetch("/api/odds?sport=icehockey_liiga", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Refresh failed with status ${response.status}`);
      }

      const raw = await response.json();
      const nextData = normalizeOddsData(raw);

      setOddsData(nextData);
      setLastUpdatedAt(Date.now());

      if (Array.isArray(nextData?.matches) && nextData.matches.length > 0) {
        addSnapshot({
          market,
          matches: nextData.matches,
          source: nextData.source,
        });
      }
    } catch (error) {
      console.error("Auto refresh failed", error);
      setRefreshError(
        lang === "fi"
          ? "Datan päivitys epäonnistui."
          : "Data refresh failed."
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [addSnapshot, market, lang]);

  useEffect(() => {
    if (matches.length > 0) {
      addSnapshot({
        market,
        matches,
        source: oddsData.source,
      });
    }
  }, [market, matches, addSnapshot, oddsData.source]);

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

  const topPickRows = useMemo(() => {
    if (!matches.length) return [];

    const rows = [];

    for (const match of matches.slice(0, 12)) {
      const candidates = [
        {
          matchId: match.id,
          matchLabel: `${match.home_team} vs ${match.away_team}`,
          market: "h2h",
          key: "home",
          label: match.home_team,
          odds: match?.bestOdds?.home ?? null,
          probability: 0.45,
        },
        {
          matchId: match.id,
          matchLabel: `${match.home_team} vs ${match.away_team}`,
          market: "h2h",
          key: "draw",
          label: t.draw || (lang === "fi" ? "Tasapeli" : "Draw"),
          odds: match?.bestOdds?.draw ?? null,
          probability: 0.23,
        },
        {
          matchId: match.id,
          matchLabel: `${match.home_team} vs ${match.away_team}`,
          market: "h2h",
          key: "away",
          label: match.away_team,
          odds: match?.bestOdds?.away ?? null,
          probability: 0.32,
        },
      ].filter((row) => row.odds);

      for (const row of candidates) {
        const meta = buildTopPickMeta(row);
        rows.push({
          ...row,
          ...meta,
        });
      }
    }

    return rows
      .filter((row) => row.edge != null && row.ev != null)
      .sort((a, b) => {
        if (b.edge !== a.edge) return b.edge - a.edge;
        return b.ev - a.ev;
      })
      .slice(0, 5);
  }, [matches, t.draw, lang]);

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
      match: `${selectedMatch?.home_team || "Home"} vs ${
        selectedMatch?.away_team || "Away"
      }`,
      selection: `${currentMarketLabel} • ${row.label || "-"}`,
      odds: Number(row.odds),
      stake: Number(stake),
    });
  }

  function handleToggleFavorite(row) {
    if (!selectedMatch || !row?.odds) return;

    toggleFavorite({
      id: `${selectedMatch.id}-${market}-${row.key}`,
      match: `${selectedMatch?.home_team || "Home"} vs ${
        selectedMatch?.away_team || "Away"
      }`,
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
            ? "Live-oddsit, panoksenhallinta, top pickit ja markkinaliikkeet yhdessä näkymässä."
            : "Live odds, staking controls, top picks and market movement in one workspace."
        }
      >
        <div style={{ display: "grid", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <SourceBadge>
                {String(oddsData?.source || "unknown").toUpperCase()}
              </SourceBadge>

              <SourceBadge>
                {isRefreshing
                  ? lang === "fi"
                    ? "PÄIVITTYY"
                    : "UPDATING"
                  : String(oddsData?.status || "fresh").toUpperCase()}
              </SourceBadge>
            </div>

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

              <button
                type="button"
                onClick={clearHistory}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {lang === "fi" ? "Tyhjennä historia" : "Clear history"}
              </button>
            </div>
          </div>

          {oddsData?.reason ? (
            <div
              style={{
                ...panelStyle,
                color: "#94a3b8",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              {oddsData.reason}
            </div>
          ) : null}

          {refreshError ? (
            <div
              style={{
                ...panelStyle,
                color: "#fca5a5",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              {refreshError}
            </div>
          ) : null}

          <MarketTabs market={market} onChange={setMarket} lang={lang} />

          {topPickRows.length > 0 ? (
            <div style={panelStyle}>
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: "12px",
                  fontSize: "16px",
                }}
              >
                {lang === "fi" ? "Parhaat poiminnat" : "Top Picks"}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "10px",
                }}
              >
                {topPickRows.map((row) => (
                  <div
                    key={`${row.matchId}-${row.key}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1.4fr) repeat(4, minmax(70px, auto))",
                      gap: "12px",
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: "14px", color: "#fff" }}>
                        {row.matchLabel}
                      </div>
                      <div
                        style={{
                          marginTop: "4px",
                          color: "#94a3b8",
                          fontSize: "13px",
                        }}
                      >
                        {row.label}
                      </div>
                    </div>

                    <div style={{ color: "#dbe4f0", fontSize: "13px" }}>
                      <strong>Odds</strong>
                      <div>{row.odds}</div>
                    </div>

                    <div style={{ color: "#dbe4f0", fontSize: "13px" }}>
                      <strong>EV</strong>
                      <div>{row.ev != null ? row.ev : "-"}</div>
                    </div>

                    <div style={{ color: "#dbe4f0", fontSize: "13px" }}>
                      <strong>Edge</strong>
                      <div>{row.edge != null ? row.edge : "-"}</div>
                    </div>

                    <div style={{ color: "#dbe4f0", fontSize: "13px" }}>
                      <strong>Model</strong>
                      <div>
                        {row.model != null ? `${(row.model * 100).toFixed(1)}%` : "-"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div
            style={{
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
                <div style={{ display: "grid", gap: "12px" }}>
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
                      {lang === "fi" ? "Kelly-osuus" : "Kelly fraction"}
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
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1.35fr)",
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
                        {`${match.home_team} vs ${match.away_team}`}
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
                          {(t.home || (lang === "fi" ? "Koti" : "Home")) +
                            ": " +
                            (match.bestOdds?.home ?? "-")}
                        </div>
                        <div>
                          {(t.draw || (lang === "fi" ? "Tasapeli" : "Draw")) +
                            ": " +
                            (match.bestOdds?.draw ?? "-")}
                        </div>
                        <div>
                          {(t.away || (lang === "fi" ? "Vieras" : "Away")) +
                            ": " +
                            (match.bestOdds?.away ?? "-")}
                        </div>
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
                      {`${selectedMatch.home_team} vs ${selectedMatch.away_team}`}
                    </div>

                    <div
                      style={{
                        marginTop: "8px",
                        color: "#94a3b8",
                        fontSize: "14px",
                      }}
                    >
                      {(lang === "fi" ? "Markkina" : "Market") +
                        ": " +
                        currentMarketLabel}
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
                          const implied = computeImpliedProbability(row.odds);
                          const edge =
                            implied != null
                              ? Number((row.probability - implied).toFixed(3))
                              : null;
                          const ev =
                            row.odds != null
                              ? Number((Number(row.odds) * row.probability - 1).toFixed(3))
                              : null;

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
                                      display: "flex",
                                      gap: "12px",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <span>
                                      EV {ev != null ? ev : "-"}
                                    </span>
                                    <span>
                                      Edge {edge != null ? edge : "-"}
                                    </span>
                                    <span>
                                      Model {(row.probability * 100).toFixed(1)}%
                                    </span>
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
