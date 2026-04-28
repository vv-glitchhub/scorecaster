"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import PageSection from "@/app/components/PageSection";
import SourceBadge from "@/app/components/SourceBadge";
import MarketTabs from "@/app/components/MarketTabs";
import FavoritesPanel from "@/app/components/FavoritesPanel";
import ConfidenceBreakdown from "@/app/components/ConfidenceBreakdown";
import RiskFlags from "@/app/components/RiskFlags";
import MarketMovementPanel from "@/app/components/MarketMovementPanel";
import DataTrustPanel from "@/app/components/DataTrustPanel";
import PickExplanation from "@/app/components/PickExplanation";
import TrustWarning from "@/app/components/TrustWarning";

import {
  buildConfidenceBreakdown,
  buildRiskFlags,
} from "@/lib/confidence-engine";

import {
  useOddsHistoryStore,
  useMatchOddsMovements,
} from "@/lib/odds-history-store";

import { assessDataQuality } from "@/lib/data-quality";
import { getDictionary } from "@/lib/i18n";
import { useFavoritesStore } from "@/lib/favorites-store";
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
    source: data?.source || "unknown",
    status: data?.status || "fresh",
    provider: data?.provider || "",
    reason: data?.reason || "",
    cached: Boolean(data?.cached),
    cacheAgeSeconds: data?.cacheAgeSeconds ?? null,
    quota: data?.quota || null,
    matches: matches.map((match) => ({
      ...match,
      id:
        match?.id ||
        `${match?.sport_key || "sport"}:${match?.home_team || "home"}:${
          match?.away_team || "away"
        }:${match?.commence_time || "time"}`,
      sport_title: match?.sport_title || match?.sport_key || "Unknown",
      home_team: match?.home_team || "Home",
      away_team: match?.away_team || "Away",
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

function impliedProb(odds) {
  const n = Number(odds);
  if (!Number.isFinite(n) || n <= 1) return null;
  return 1 / n;
}

function buttonStyle(variant = "default", disabled = false) {
  const green = variant === "green";

  return {
    border: green
      ? "1px solid rgba(34,197,94,0.55)"
      : "1px solid rgba(255,255,255,0.14)",
    background: green ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)",
    color: green ? "#bbf7d0" : "#ffffff",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "15px",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [refreshError, setRefreshError] = useState("");

  const matches = oddsData.matches || [];

  const [selectedMatchId, setSelectedMatchId] = useState(
    matches[0]?.id || null
  );

  const selectedMatch = useMemo(() => {
    if (!matches.length) return null;

    return (
      matches.find((match) => match.id === selectedMatchId) ||
      matches[0] ||
      null
    );
  }, [matches, selectedMatchId]);

  useEffect(() => {
    if (!selectedMatch && matches.length > 0) {
      setSelectedMatchId(matches[0].id);
    }
  }, [matches, selectedMatch]);

  const loadLiveGames = useCallback(
    async ({ force = false, backup = false } = {}) => {
      try {
        setIsRefreshing(true);
        setRefreshError("");

        const params = new URLSearchParams();
        if (force) params.set("force", "1");
        if (backup) params.set("backup", "1");

        const query = params.toString();
        const endpoint = query ? `/api/odds?${query}` : "/api/odds";

        const response = await fetch(endpoint, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`API error ${response.status}`);
        }

        const raw = await response.json();
        const nextData = normalizeOddsData(raw);

        setOddsData(nextData);
        setLastUpdatedAt(Date.now());

        if (nextData.matches.length > 0) {
          addSnapshot({
            market,
            matches: nextData.matches,
            source: nextData.source,
          });
        }
      } catch (error) {
        setRefreshError(
          lang === "fi"
            ? `Datan haku epäonnistui: ${error.message}`
            : `Data fetch failed: ${error.message}`
        );
      } finally {
        setIsRefreshing(false);
      }
    },
    [addSnapshot, market, lang]
  );

  useEffect(() => {
    if (matches.length > 0) {
      addSnapshot({
        market,
        matches,
        source: oddsData.source,
      });
    }
  }, [market, matches, oddsData.source, addSnapshot]);

  const snapshots = selectedMatch ? getSnapshots(market, selectedMatch.id) : [];

  const movements = useMatchOddsMovements({
    snapshots,
    market,
  });

  const trust = useMemo(() => {
    return assessDataQuality({
      oddsData,
      selectedMatch,
      snapshots,
      market,
    });
  }, [oddsData, selectedMatch, snapshots, market]);

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
          odds: selectedMatch.bestOdds?.over,
          probability: 0.52,
        },
        {
          key: "under",
          label: `Under ${point}`,
          odds: selectedMatch.bestOdds?.under,
          probability: 0.48,
        },
      ].filter((row) => row.odds);
    }

    if (market === "spreads") {
      return [
        {
          key: "spread-home",
          label: `${selectedMatch.home_team} ${
            selectedMatch.bestOdds?.spreadPointHome || ""
          }`,
          odds: selectedMatch.bestOdds?.spreadHome,
          probability: 0.52,
        },
        {
          key: "spread-away",
          label: `${selectedMatch.away_team} ${
            selectedMatch.bestOdds?.spreadPointAway || ""
          }`,
          odds: selectedMatch.bestOdds?.spreadAway,
          probability: 0.48,
        },
      ].filter((row) => row.odds);
    }

    return [
      {
        key: "home",
        label: selectedMatch.home_team,
        odds: selectedMatch.bestOdds?.home,
        probability: 0.45,
      },
      {
        key: "draw",
        label: t.draw || (lang === "fi" ? "Tasapeli" : "Draw"),
        odds: selectedMatch.bestOdds?.draw,
        probability: 0.23,
      },
      {
        key: "away",
        label: selectedMatch.away_team,
        odds: selectedMatch.bestOdds?.away,
        probability: 0.32,
      },
    ].filter((row) => row.odds);
  }, [selectedMatch, market, t.draw, lang]);

  function getStake(row) {
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

    const stake = getStake(row);
    if (!stake || stake <= 0) return;

    addBet({
      match: `${selectedMatch.home_team} vs ${selectedMatch.away_team}`,
      selection: row.label,
      odds: Number(row.odds),
      stake: Number(stake),
    });
  }

  function handleToggleFavorite(row) {
    if (!selectedMatch || !row?.odds) return;

    toggleFavorite({
      id: `${selectedMatch.id}-${market}-${row.key}`,
      match: `${selectedMatch.home_team} vs ${selectedMatch.away_team}`,
      selection: row.label,
      odds: Number(row.odds),
      market,
    });
  }

  const panelStyle = {
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "18px",
    padding: "18px",
    background: "rgba(0,0,0,0.2)",
  };

  const inputStyle = {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "15px",
    boxSizing: "border-box",
  };

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <PageSection
        title={lang === "fi" ? "Vedonlyöntityötila" : "Betting Workspace"}
        subtitle={
          lang === "fi"
            ? "Live-pelit haetaan vain napista, jotta API-krediittejä ei kulu automaattisesti."
            : "Live games load only from the button, so API credits are not used automatically."
        }
      >
        <DataTrustPanel trust={trust} lang={lang} />
        <TrustWarning trust={trust} lang={lang} />

        {oddsData.reason ? (
          <div
            style={{
              border: "1px solid rgba(245,158,11,0.25)",
              background: "rgba(245,158,11,0.08)",
              color: "#fde68a",
              borderRadius: "16px",
              padding: "14px 16px",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            {oddsData.reason}
          </div>
        ) : null}

        {refreshError ? (
          <div
            style={{
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.08)",
              color: "#fecaca",
              borderRadius: "16px",
              padding: "14px 16px",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            {refreshError}
          </div>
        ) : null}

        <div style={panelStyle}>
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <SourceBadge>
              {String(oddsData.source || "unknown").toUpperCase()}
            </SourceBadge>

            <SourceBadge>
              {isRefreshing
                ? lang === "fi"
                  ? "HAETAAN"
                  : "LOADING"
                : oddsData.cached
                ? "CACHE"
                : String(oddsData.status || "WAITING").toUpperCase()}
            </SourceBadge>

            {oddsData.provider ? (
              <SourceBadge>{String(oddsData.provider).toUpperCase()}</SourceBadge>
            ) : null}
          </div>

          <div
            style={{
              marginTop: "14px",
              color: "#94a3b8",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            {lang === "fi" ? "Päivitetty" : "Updated"}{" "}
            {formatClock(lastUpdatedAt, lang)}
          </div>

          {oddsData.cached ? (
            <div
              style={{
                marginTop: "8px",
                color: "#94a3b8",
                fontSize: "13px",
              }}
            >
              {lang === "fi"
                ? `Näytetään välimuistista. Ikä ${oddsData.cacheAgeSeconds}s.`
                : `Showing cached data. Age ${oddsData.cacheAgeSeconds}s.`}
            </div>
          ) : null}

          {oddsData.quota ? (
            <div
              style={{
                marginTop: "10px",
                color: "#94a3b8",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              API quota: remaining {oddsData.quota.requestsRemaining ?? "-"} / used{" "}
              {oddsData.quota.requestsUsed ?? "-"} / last{" "}
              {oddsData.quota.requestsLast ?? "-"}
            </div>
          ) : null}

          <div
            style={{
              marginTop: "14px",
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => loadLiveGames({ force: false })}
              disabled={isRefreshing}
              style={buttonStyle("green", isRefreshing)}
            >
              {isRefreshing
                ? lang === "fi"
                  ? "Haetaan..."
                  : "Loading..."
                : lang === "fi"
                ? "Hae live-pelit"
                : "Load live games"}
            </button>

            <button
              type="button"
              onClick={() => loadLiveGames({ force: true })}
              disabled={isRefreshing}
              style={buttonStyle("default", isRefreshing)}
            >
              {lang === "fi" ? "Pakota uusi haku" : "Force new fetch"}
            </button>

            <button
              type="button"
              onClick={() => loadLiveGames({ force: true, backup: true })}
              disabled={isRefreshing}
              style={buttonStyle("default", isRefreshing)}
            >
              {lang === "fi" ? "Kokeile backup API:a" : "Try backup API"}
            </button>

            <button type="button" onClick={clearHistory} style={buttonStyle()}>
              {lang === "fi" ? "Tyhjennä historia" : "Clear history"}
            </button>
          </div>
        </div>

        <MarketTabs market={market} onChange={setMarket} lang={lang} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          <div style={panelStyle}>
            <div
              style={{
                fontWeight: 900,
                color: "#ffffff",
                fontSize: "22px",
                marginBottom: "12px",
              }}
            >
              {lang === "fi" ? "Ottelut" : "Matches"}
            </div>

            {matches.length === 0 ? (
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "15px",
                  lineHeight: 1.5,
                }}
              >
                {lang === "fi"
                  ? "Pelejä ei ole vielä ladattu. Paina Hae live-pelit."
                  : "Games have not been loaded yet. Press Load live games."}
              </div>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {matches.map((match) => {
                  const active = selectedMatch?.id === match.id;

                  return (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => setSelectedMatchId(match.id)}
                      style={{
                        width: "100%",
                        border: active
                          ? "1px solid rgba(34,197,94,0.6)"
                          : "1px solid rgba(255,255,255,0.1)",
                        background: active
                          ? "rgba(34,197,94,0.12)"
                          : "rgba(255,255,255,0.04)",
                        color: "#ffffff",
                        borderRadius: "16px",
                        padding: "14px",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: "16px",
                          lineHeight: 1.25,
                        }}
                      >
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
                          color: "#dbe4f0",
                          fontSize: "13px",
                          display: "flex",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span>
                          {lang === "fi" ? "Koti" : "Home"}{" "}
                          {match.bestOdds?.home ?? "-"}
                        </span>
                        <span>
                          {lang === "fi" ? "Tasapeli" : "Draw"}{" "}
                          {match.bestOdds?.draw ?? "-"}
                        </span>
                        <span>
                          {lang === "fi" ? "Vieras" : "Away"}{" "}
                          {match.bestOdds?.away ?? "-"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: "16px", alignContent: "start" }}>
            <div style={panelStyle}>
              <div
                style={{
                  fontWeight: 900,
                  color: "#ffffff",
                  fontSize: "22px",
                  marginBottom: "12px",
                }}
              >
                {selectedMatch
                  ? `${selectedMatch.home_team} vs ${selectedMatch.away_team}`
                  : lang === "fi"
                  ? "Valitse ottelu"
                  : "Select match"}
              </div>

              {marketRows.length === 0 ? (
                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: "15px",
                    lineHeight: 1.5,
                  }}
                >
                  {lang === "fi"
                    ? "Tälle markkinalle ei löytynyt pelattavia rivejä."
                    : "No playable rows found for this market."}
                </div>
              ) : (
                <div style={{ display: "grid", gap: "14px" }}>
                  {marketRows.map((row) => {
                    const implied = impliedProb(row.odds);
                    const edge =
                      implied != null ? row.probability - implied : null;
                    const stake = getStake(row);
                    const favId = selectedMatch
                      ? `${selectedMatch.id}-${market}-${row.key}`
                      : row.key;
                    const saved = isFavorite(favId);

                    return (
                      <div
                        key={row.key}
                        style={{
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.035)",
                          borderRadius: "16px",
                          padding: "14px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                color: "#ffffff",
                                fontSize: "18px",
                                fontWeight: 900,
                              }}
                            >
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
                                color:
                                  edge != null && edge > 0
                                    ? "#86efac"
                                    : "#fca5a5",
                                fontSize: "14px",
                                fontWeight: 800,
                              }}
                            >
                              Edge{" "}
                              {edge != null
                                ? `${(edge * 100).toFixed(1)}%`
                                : "-"}
                            </div>

                            <div
                              style={{
                                marginTop: "6px",
                                color: "#94a3b8",
                                fontSize: "13px",
                              }}
                            >
                              {stakeMode === "kelly"
                                ? `Kelly €${stake.toFixed(2)}`
                                : `Panos €${(Number(manualStake) || 0).toFixed(
                                    2
                                  )}`}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                              alignItems: "flex-start",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleAddBet(row)}
                              style={buttonStyle("green")}
                            >
                              {lang === "fi" ? "Lisää veto" : "Add bet"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleFavorite(row)}
                              style={buttonStyle()}
                            >
                              {saved
                                ? lang === "fi"
                                  ? "Tallennettu"
                                  : "Saved"
                                : lang === "fi"
                                ? "Tallenna"
                                : "Save"}
                            </button>
                          </div>
                        </div>

                        <PickExplanation row={row} trust={trust} lang={lang} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <ConfidenceBreakdown breakdown={confidenceBreakdown} lang={lang} />
            <RiskFlags flags={riskFlags} lang={lang} />

            <MarketMovementPanel
              market={market}
              selectedMatch={selectedMatch}
              movements={movements}
              lang={lang}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          <div style={panelStyle}>
            <div
              style={{
                fontWeight: 900,
                color: "#ffffff",
                fontSize: "22px",
                marginBottom: "12px",
              }}
            >
              {lang === "fi" ? "Panostus" : "Staking"}
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                marginBottom: "14px",
              }}
            >
              <button
                type="button"
                onClick={() => setStakeMode("manual")}
                style={buttonStyle(stakeMode === "manual" ? "green" : "default")}
              >
                {lang === "fi" ? "Manuaalinen" : "Manual"}
              </button>

              <button
                type="button"
                onClick={() => setStakeMode("kelly")}
                style={buttonStyle(stakeMode === "kelly" ? "green" : "default")}
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
                    fontSize: "13px",
                    fontWeight: 700,
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
                      fontSize: "13px",
                      fontWeight: 700,
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
                      fontSize: "13px",
                      fontWeight: 700,
                      marginBottom: "6px",
                    }}
                  >
                    Kelly fraction
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
      </PageSection>
    </div>
  );
}
