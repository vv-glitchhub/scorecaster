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
import { buildConfidenceBreakdown, buildRiskFlags } from "@/lib/confidence-engine";
import { useOddsHistoryStore, useMatchOddsMovements } from "@/lib/odds-history-store";
import { assessDataQuality } from "@/lib/data-quality";
import { getDictionary } from "@/lib/i18n";
import { useFavoritesStore } from "@/lib/favorites-store";
import { useBetStore } from "@/lib/useBetStore";
import { kellyStake } from "@/lib/kelly";
import { SPORT_OPTIONS, getLeaguesForSport } from "@/lib/league-options";

function formatClock(timestamp, lang) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleTimeString(lang === "fi" ? "fi-FI" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
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
    debug: data?.debug || null,
    filters: data?.filters || null,
    matches: matches.map((match) => ({
      ...match,
      id:
        match?.id ||
        `${match?.sport_key || "sport"}:${match?.home_team || "home"}:${match?.away_team || "away"}:${match?.commence_time || "time"}`,
      sport_title: match?.sport_title || match?.sport_key || "Unknown",
      home_team: match?.home_team || "Home",
      away_team: match?.away_team || "Away",
      fixturesOnly: Boolean(match?.fixturesOnly),
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
    width: "100%",
    maxWidth: "100%",
    border: green
      ? "1px solid rgba(34,197,94,0.55)"
      : "1px solid rgba(255,255,255,0.14)",
    background: green ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)",
    color: green ? "#bbf7d0" : "#ffffff",
    borderRadius: "14px",
    padding: "13px 16px",
    fontSize: "15px",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  };
}

function sliderButton(active) {
  return {
    flex: "0 0 auto",
    border: active
      ? "1px solid rgba(34,197,94,0.65)"
      : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(34,197,94,0.16)" : "rgba(255,255,255,0.06)",
    color: active ? "#bbf7d0" : "#ffffff",
    borderRadius: "999px",
    padding: "10px 14px",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export default function BettingWorkspaceClient({ initialOddsData, lang = "fi" }) {
  const t = getDictionary(lang);
  const { addBet } = useBetStore();
  const { toggleFavorite, isFavorite } = useFavoritesStore();
  const { addSnapshot, getSnapshots, clearHistory } = useOddsHistoryStore();

  const [oddsData, setOddsData] = useState(() => normalizeOddsData(initialOddsData || {}));
  const [market, setMarket] = useState("h2h");
  const [sportFilter, setSportFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("upcoming");
  const [oddsOnly, setOddsOnly] = useState(true);
  const [stakeMode, setStakeMode] = useState("manual");
  const [manualStake, setManualStake] = useState("10");
  const [bankroll, setBankroll] = useState("1000");
  const [kellyFraction, setKellyFraction] = useState("0.25");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [refreshError, setRefreshError] = useState("");

  const leagueOptions = useMemo(() => getLeaguesForSport(sportFilter), [sportFilter]);
  const matches = oddsData.matches || [];
  const [selectedMatchId, setSelectedMatchId] = useState(matches[0]?.id || null);

  const selectedMatch = useMemo(() => {
    if (!matches.length) return null;
    return matches.find((match) => match.id === selectedMatchId) || matches[0] || null;
  }, [matches, selectedMatchId]);

  useEffect(() => {
    if (!selectedMatch && matches.length > 0) {
      setSelectedMatchId(matches[0].id);
    }
  }, [matches, selectedMatch]);

  const loadLiveGames = useCallback(
    async ({ force = false } = {}) => {
      try {
        setIsRefreshing(true);
        setRefreshError("");

        const params = new URLSearchParams();
        params.set("sport", sportFilter);
        params.set("league", leagueFilter);
        params.set("status", statusFilter);
        params.set("oddsOnly", oddsOnly ? "1" : "0");
        if (force) params.set("force", "1");

        const response = await fetch(`/api/odds?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) throw new Error(`API error ${response.status}`);

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
    [addSnapshot, market, lang, sportFilter, leagueFilter, statusFilter, oddsOnly]
  );

  useEffect(() => {
    if (matches.length > 0) {
      addSnapshot({ market, matches, source: oddsData.source });
    }
  }, [market, matches, oddsData.source, addSnapshot]);

  const snapshots = selectedMatch ? getSnapshots(market, selectedMatch.id) : [];
  const movements = useMatchOddsMovements({ snapshots, market });

  const trust = useMemo(() => {
    return assessDataQuality({ oddsData, selectedMatch, snapshots, market });
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
    if (!selectedMatch || selectedMatch.fixturesOnly) return [];

    if (market === "totals") {
      const point = selectedMatch.bestOdds?.point ?? "-";
      return [
        { key: "over", label: `Over ${point}`, odds: selectedMatch.bestOdds?.over, probability: 0.52 },
        { key: "under", label: `Under ${point}`, odds: selectedMatch.bestOdds?.under, probability: 0.48 },
      ].filter((row) => row.odds);
    }

    if (market === "spreads") {
      return [
        {
          key: "spread-home",
          label: `${selectedMatch.home_team} ${selectedMatch.bestOdds?.spreadPointHome || ""}`,
          odds: selectedMatch.bestOdds?.spreadHome,
          probability: 0.52,
        },
        {
          key: "spread-away",
          label: `${selectedMatch.away_team} ${selectedMatch.bestOdds?.spreadPointAway || ""}`,
          odds: selectedMatch.bestOdds?.spreadAway,
          probability: 0.48,
        },
      ].filter((row) => row.odds);
    }

    return [
      { key: "home", label: selectedMatch.home_team, odds: selectedMatch.bestOdds?.home, probability: 0.45 },
      { key: "draw", label: t.draw || "Draw", odds: selectedMatch.bestOdds?.draw, probability: 0.23 },
      { key: "away", label: selectedMatch.away_team, odds: selectedMatch.bestOdds?.away, probability: 0.32 },
    ].filter((row) => row.odds);
  }, [selectedMatch, market, t.draw]);

  const dailyPicks = useMemo(() => {
    return matches
      .filter((match) => !match.fixturesOnly && (match.bestOdds?.home || match.bestOdds?.away))
      .flatMap((match) => [
        { match, key: "home", label: match.home_team, odds: match.bestOdds.home, probability: 0.45 },
        { match, key: "away", label: match.away_team, odds: match.bestOdds.away, probability: 0.32 },
      ])
      .filter((pick) => pick.odds)
      .map((pick) => {
        const implied = impliedProb(pick.odds);
        const edge = implied != null ? pick.probability - implied : null;
        const ev = pick.odds ? pick.odds * pick.probability - 1 : null;
        return { ...pick, edge, ev };
      })
      .filter((pick) => pick.edge != null)
      .sort((a, b) => b.edge - a.edge)
      .slice(0, 5);
  }, [matches]);

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
    maxWidth: "100%",
    overflow: "hidden",
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

  const scrollRowStyle = {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    maxWidth: "100%",
    paddingBottom: "8px",
    WebkitOverflowScrolling: "touch",
  };

  const safeTextStyle = {
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  };

  return (
    <div style={{ display: "grid", gap: "18px", maxWidth: "100%", overflow: "hidden" }}>
      <PageSection
        title={lang === "fi" ? "Vedonlyöntityötila" : "Betting Workspace"}
        subtitle={
          lang === "fi"
            ? "Valitse laji ja liiga. Data haetaan vain napista."
            : "Choose sport and league. Data loads only from the button."
        }
      >
        <DataTrustPanel trust={trust} lang={lang} />
        <TrustWarning trust={trust} lang={lang} />

        {oddsData.reason ? (
          <div style={{ border: "1px solid rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.08)", color: "#fde68a", borderRadius: "16px", padding: "14px 16px", fontSize: "14px", lineHeight: 1.5, ...safeTextStyle }}>
            {oddsData.reason}
          </div>
        ) : null}

        {refreshError ? (
          <div style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#fecaca", borderRadius: "16px", padding: "14px 16px", fontSize: "14px", lineHeight: 1.5, ...safeTextStyle }}>
            {refreshError}
          </div>
        ) : null}

        <div style={panelStyle}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <SourceBadge>{String(oddsData.source || "manual").toUpperCase()}</SourceBadge>
            <SourceBadge>{isRefreshing ? "HAETAAN" : oddsData.cached ? "CACHE" : String(oddsData.status || "WAITING").toUpperCase()}</SourceBadge>
            {oddsData.provider ? <SourceBadge>{String(oddsData.provider).toUpperCase()}</SourceBadge> : null}
          </div>

          <div style={{ marginTop: "14px", color: "#94a3b8", fontSize: "14px", fontWeight: 700 }}>
            {lang === "fi" ? "Päivitetty" : "Updated"} {formatClock(lastUpdatedAt, lang)}
          </div>

          <div style={{ marginTop: "18px" }}>
            <div style={{ color: "#94a3b8", fontSize: "13px", fontWeight: 900, marginBottom: "8px" }}>
              {lang === "fi" ? "Laji" : "Sport"}
            </div>

            <div style={scrollRowStyle}>
              {SPORT_OPTIONS.map((sport) => (
                <button
                  key={sport.id}
                  type="button"
                  onClick={() => {
                    setSportFilter(sport.id);
                    setLeagueFilter("ALL");
                  }}
                  style={sliderButton(sportFilter === sport.id)}
                >
                  {lang === "fi" ? sport.labelFi : sport.labelEn}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <div style={{ color: "#94a3b8", fontSize: "13px", fontWeight: 900, marginBottom: "8px" }}>
              {lang === "fi" ? "Liiga" : "League"}
            </div>

            <div style={scrollRowStyle}>
              <button type="button" onClick={() => setLeagueFilter("ALL")} style={sliderButton(leagueFilter === "ALL")}>
                {lang === "fi" ? "Kaikki" : "All"}
              </button>

              {leagueOptions.map((league) => (
                <button
                  key={league.id}
                  type="button"
                  onClick={() => setLeagueFilter(league.id)}
                  style={sliderButton(leagueFilter === league.id)}
                >
                  {lang === "fi" ? league.labelFi : league.labelEn}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
            <div>
              <label style={{ color: "#94a3b8", fontSize: "13px", fontWeight: 800 }}>
                {lang === "fi" ? "Tila" : "Status"}
              </label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
                <option value="all">{lang === "fi" ? "Kaikki" : "All"}</option>
                <option value="upcoming">{lang === "fi" ? "Tulevat" : "Upcoming"}</option>
                <option value="live">Live</option>
              </select>
            </div>

            <div>
              <label style={{ color: "#94a3b8", fontSize: "13px", fontWeight: 800 }}>
                Odds
              </label>
              <select value={oddsOnly ? "1" : "0"} onChange={(e) => setOddsOnly(e.target.value === "1")} style={inputStyle}>
                <option value="1">{lang === "fi" ? "Vain oddsit" : "Odds only"}</option>
                <option value="0">{lang === "fi" ? "Näytä myös ottelulistat" : "Show fixtures too"}</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
            <button type="button" onClick={() => loadLiveGames({ force: false })} disabled={isRefreshing} style={buttonStyle("green", isRefreshing)}>
              {isRefreshing ? "Haetaan..." : lang === "fi" ? "Hae pelit" : "Load games"}
            </button>

            <button type="button" onClick={() => loadLiveGames({ force: true })} disabled={isRefreshing} style={buttonStyle("default", isRefreshing)}>
              {lang === "fi" ? "Pakota uusi haku" : "Force new fetch"}
            </button>

            <button type="button" onClick={clearHistory} style={buttonStyle()}>
              {lang === "fi" ? "Tyhjennä historia" : "Clear history"}
            </button>
          </div>
        </div>

        {dailyPicks.length > 0 ? (
          <div style={panelStyle}>
            <div style={{ fontWeight: 900, color: "#ffffff", fontSize: "22px", marginBottom: "12px" }}>
              {lang === "fi" ? "Päivän pickit" : "Daily Picks"}
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              {dailyPicks.map((pick) => (
                <div key={`${pick.match.id}-${pick.key}`} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px", background: "rgba(255,255,255,0.035)" }}>
                  <div style={{ fontWeight: 900, ...safeTextStyle }}>
                    {pick.match.home_team} vs {pick.match.away_team}
                  </div>
                  <div style={{ color: "#94a3b8", marginTop: "4px" }}>
                    {pick.label} • Odds {pick.odds}
                  </div>
                  <div style={{ color: pick.edge > 0 ? "#86efac" : "#fca5a5", fontWeight: 900, marginTop: "6px" }}>
                    Edge {(pick.edge * 100).toFixed(1)}% • EV {pick.ev?.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <MarketTabs market={market} onChange={setMarket} lang={lang} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", maxWidth: "100%" }}>
          <div style={panelStyle}>
            <div style={{ fontWeight: 900, color: "#ffffff", fontSize: "22px", marginBottom: "12px" }}>
              {lang === "fi" ? "Ottelut" : "Matches"}
            </div>

            {matches.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: "15px", lineHeight: 1.5, ...safeTextStyle }}>
                {lang === "fi" ? "Pelejä ei ole vielä ladattu. Valitse laji/liiga ja paina Hae pelit." : "No games loaded yet."}
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
                        maxWidth: "100%",
                        border: active ? "1px solid rgba(34,197,94,0.6)" : "1px solid rgba(255,255,255,0.1)",
                        background: active ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
                        color: "#ffffff",
                        borderRadius: "16px",
                        padding: "14px",
                        textAlign: "left",
                        cursor: "pointer",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ fontWeight: 900, fontSize: "16px", lineHeight: 1.25, ...safeTextStyle }}>
                        {match.home_team} vs {match.away_team}
                      </div>

                      <div style={{ marginTop: "6px", color: "#94a3b8", fontSize: "13px" }}>
                        {match.sport_title} {match.fixturesOnly ? "• Fixtures only" : ""}
                      </div>

                      <div style={{ marginTop: "10px", color: "#dbe4f0", fontSize: "13px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <span>Koti {match.bestOdds?.home ?? "-"}</span>
                        <span>Tasapeli {match.bestOdds?.draw ?? "-"}</span>
                        <span>Vieras {match.bestOdds?.away ?? "-"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: "16px", alignContent: "start", maxWidth: "100%" }}>
            <div style={panelStyle}>
              <div style={{ fontWeight: 900, color: "#ffffff", fontSize: "22px", marginBottom: "12px", ...safeTextStyle }}>
                {selectedMatch ? `${selectedMatch.home_team} vs ${selectedMatch.away_team}` : lang === "fi" ? "Valitse ottelu" : "Select match"}
              </div>

              {selectedMatch?.fixturesOnly ? (
                <div style={{ color: "#fde68a", fontSize: "15px", lineHeight: 1.5, ...safeTextStyle }}>
                  Tämä ottelu tulee TheSportsDB:stä ottelulistana. Odds-dataa ei ole saatavilla tästä lähteestä.
                </div>
              ) : marketRows.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: "15px", lineHeight: 1.5, ...safeTextStyle }}>
                  {lang === "fi" ? "Tälle markkinalle ei löytynyt pelattavia rivejä." : "No playable rows found."}
                </div>
              ) : (
                <div style={{ display: "grid", gap: "14px" }}>
                  {marketRows.map((row) => {
                    const implied = impliedProb(row.odds);
                    const edge = implied != null ? row.probability - implied : null;
                    const stake = getStake(row);
                    const favId = selectedMatch ? `${selectedMatch.id}-${market}-${row.key}` : row.key;
                    const saved = isFavorite(favId);

                    return (
                      <div key={row.key} style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.035)", borderRadius: "16px", padding: "14px", overflow: "hidden" }}>
                        <div style={{ display: "grid", gap: "12px" }}>
                          <div>
                            <div style={{ color: "#ffffff", fontSize: "18px", fontWeight: 900, ...safeTextStyle }}>{row.label}</div>
                            <div style={{ marginTop: "6px", color: "#dbe4f0", fontSize: "14px" }}>Odds {row.odds}</div>
                            <div style={{ marginTop: "6px", color: edge != null && edge > 0 ? "#86efac" : "#fca5a5", fontSize: "14px", fontWeight: 800 }}>
                              Edge {edge != null ? `${(edge * 100).toFixed(1)}%` : "-"}
                            </div>
                            <div style={{ marginTop: "6px", color: "#94a3b8", fontSize: "13px" }}>
                              {stakeMode === "kelly" ? `Kelly €${stake.toFixed(2)}` : `Panos €${(Number(manualStake) || 0).toFixed(2)}`}
                            </div>
                          </div>

                          <div style={{ display: "grid", gap: "10px" }}>
                            <button type="button" onClick={() => handleAddBet(row)} style={buttonStyle("green")}>
                              {lang === "fi" ? "Lisää veto" : "Add bet"}
                            </button>

                            <button type="button" onClick={() => handleToggleFavorite(row)} style={buttonStyle()}>
                              {saved ? "Tallennettu" : "Tallenna"}
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
            <MarketMovementPanel market={market} selectedMatch={selectedMatch} movements={movements} lang={lang} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", maxWidth: "100%" }}>
          <div style={panelStyle}>
            <div style={{ fontWeight: 900, color: "#ffffff", fontSize: "22px", marginBottom: "12px" }}>
              {lang === "fi" ? "Panostus" : "Staking"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
              <button type="button" onClick={() => setStakeMode("manual")} style={buttonStyle(stakeMode === "manual" ? "green" : "default")}>
                Manuaalinen
              </button>

              <button type="button" onClick={() => setStakeMode("kelly")} style={buttonStyle(stakeMode === "kelly" ? "green" : "default")}>
                Kelly
              </button>
            </div>

            {stakeMode === "manual" ? (
              <input value={manualStake} onChange={(e) => setManualStake(e.target.value)} style={inputStyle} />
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                <input value={bankroll} onChange={(e) => setBankroll(e.target.value)} style={inputStyle} />
                <input value={kellyFraction} onChange={(e) => setKellyFraction(e.target.value)} style={inputStyle} />
              </div>
            )}
          </div>

          <FavoritesPanel lang={lang} />
        </div>
      </PageSection>
    </div>
  );
}
