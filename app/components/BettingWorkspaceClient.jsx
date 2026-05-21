"use client";

import { useEffect, useMemo, useState } from "react";

import { SPORT_OPTIONS, getLeaguesForSport } from "@/lib/league-options";
import { analyzeRows, getBestBets } from "@/lib/betting-engine";
import { isBettableMatch } from "@/lib/data-status";
import { addOddsSnapshots, getOddsMovement } from "@/lib/odds-history-store";
import { DEFAULT_USER_BOOKMAKERS } from "@/lib/bookmaker-options";
import { addBetToHistory, getBetHistory } from "@/lib/bet-history-store";

import BetSlipPanel from "@/app/components/BetSlipPanel";
import BetHistoryPanel from "@/app/components/BetHistoryPanel";
import PerformancePanel from "@/app/components/PerformancePanel";
import LineMovementPanel from "@/app/components/LineMovementPanel";
import AIReasoningPanel from "@/app/components/AIReasoningPanel";
import RiskManagerPanel from "@/app/components/RiskManagerPanel";

import LiveMomentumPanel from "@/app/components/LiveMomentumPanel";
import SharpMoneyPanel from "@/app/components/SharpMoneyPanel";
import CashoutAnalyzer from "@/app/components/CashoutAnalyzer";

import ParlayBuilderPanel from "@/app/components/ParlayBuilderPanel";
import ParlayAnalysisPanel from "@/app/components/ParlayAnalysisPanel";
import ParlayRiskPanel from "@/app/components/ParlayRiskPanel";

import StickyLiveControls from "@/app/components/StickyLiveControls";
import FloatingBetSlip from "@/app/components/FloatingBetSlip";
import SteamMovePanel from "@/app/components/SteamMovePanel";

function card(extra = {}) {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: "clamp(14px, 4vw, 22px)",
    background: "rgba(2,6,23,0.72)",
    ...extra,
  };
}

function pill(active) {
  return {
    border: active
      ? "1px solid rgba(34,197,94,0.65)"
      : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(34,197,94,0.16)" : "rgba(255,255,255,0.06)",
    color: "#fff",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function normalizeData(data) {
  return {
    matches: Array.isArray(data?.matches) ? data.matches : [],
    source: data?.source || "",
    status: data?.status || "",
    provider: data?.provider || "",
    reason: data?.reason || "",
  };
}

function formatTime(value) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString("fi-FI", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function pct(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0.0%";
  return `${(n * 100).toFixed(1)}%`;
}

function edgePct(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0.0%";
  return `${(Math.abs(n) <= 1 ? n * 100 : n).toFixed(1)}%`;
}

export default function BettingWorkspaceClient({ initialOddsData }) {
  const [oddsData, setOddsData] = useState(() => normalizeData(initialOddsData));
  const [sport, setSport] = useState("all");
  const [league, setLeague] = useState("ALL");
  const [market, setMarket] = useState("h2h");
  const [selectedId, setSelectedId] = useState(null);
  const [bankroll] = useState("1000");
  const [selectedBookmakers] = useState(DEFAULT_USER_BOOKMAKERS);
  const [betSlip, setBetSlip] = useState([]);
  const [betHistory, setBetHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const matches = oddsData.matches || [];

  useEffect(() => {
    setBetHistory(getBetHistory());
  }, []);

  const leagues = useMemo(() => getLeaguesForSport(sport), [sport]);

  const bettableMatches = useMemo(
    () => matches.filter(isBettableMatch),
    [matches]
  );

  const selectedMatch =
    bettableMatches.find((m) => m.id === selectedId) ||
    bettableMatches[0] ||
    null;

  const selectedRows = useMemo(
    () =>
      analyzeRows(
        selectedMatch,
        market,
        Number(bankroll) || 1000,
        selectedBookmakers
      ),
    [selectedMatch, market, bankroll, selectedBookmakers]
  );

  const topPicks = useMemo(
    () =>
      getBestBets(
        bettableMatches,
        Number(bankroll) || 1000,
        selectedBookmakers
      ),
    [bettableMatches, bankroll, selectedBookmakers]
  );

  const selectedMovement = selectedMatch
    ? getOddsMovement(
        selectedMatch,
        market === "totals"
          ? "over"
          : market === "spreads"
          ? "spreadHome"
          : "home"
      )
    : null;

  async function loadGames(force = false) {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      params.set("sport", sport);
      params.set("league", league);
      params.set("status", isLiveMode ? "live" : "upcoming");

      if (force) params.set("force", "1");

      const res = await fetch(`/api/odds?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await res.json();
      const normalized = normalizeData(data);

      setOddsData(normalized);

      if (normalized.matches?.length) {
        addOddsSnapshots(normalized.matches);
      }

      const first = normalized.matches?.find(isBettableMatch);
      setSelectedId(first?.id || null);
    } catch (error) {
      console.error("Odds loading failed:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadGames(false);
    }, isLiveMode ? 30000 : 120000);

    return () => clearInterval(interval);
  }, [autoRefresh, isLiveMode, sport, league]);

  function addToBetSlip(pick, match = selectedMatch) {
    if (!pick || !match) return;

    const item = {
      id: `${match.id}-${pick.market || "market"}-${pick.key || pick.label}-${
        pick.bookmaker || "book"
      }`,
      match,
      ...pick,
      addedAt: Date.now(),
      userStake: pick.stake || 0,
    };

    setBetSlip((prev) => {
      if (prev.some((x) => x.id === item.id)) return prev;
      return [item, ...prev];
    });
  }

  function addManyToBetSlip(picks = []) {
    for (const pick of picks) {
      addToBetSlip(pick, pick.match || selectedMatch);
    }
  }

  function removeFromBetSlip(id) {
    setBetSlip((prev) => prev.filter((pick) => pick.id !== id));
  }

  function clearBetSlip() {
    setBetSlip([]);
  }

  function updateBetSlipStake(id, value) {
    setBetSlip((prev) =>
      prev.map((pick) =>
        pick.id === id
          ? {
              ...pick,
              userStake: value,
            }
          : pick
      )
    );
  }

  function saveToHistory(pick) {
    const updated = addBetToHistory(pick);
    setBetHistory(updated);
  }

  return (
    <div className="mobile-container" style={{ display: "grid", gap: 14 }}>
      <StickyLiveControls
        isLiveMode={isLiveMode}
        autoRefresh={autoRefresh}
        loading={loading}
        onToggleLive={() => setIsLiveMode((v) => !v)}
        onToggleRefresh={() => setAutoRefresh((v) => !v)}
        onRefresh={() => loadGames(true)}
      />

      <section style={card()}>
        <h1
          style={{
            margin: 0,
            color: "#fff",
            fontSize: "clamp(30px, 9vw, 52px)",
            lineHeight: 1,
          }}
        >
          Scorecaster
        </h1>

        <div style={{ color: "#94a3b8", marginTop: 8 }}>
          Betting Intelligence Platform
        </div>

        <div style={{ color: "#64748b", marginTop: 10, lineHeight: 1.5 }}>
          Valitse laji ja liiga, päivitä ottelut ja appi nostaa esiin parhaat
          value-kohteet.
        </div>
      </section>

      <section style={card()}>
        <div style={{ color: "#94a3b8", marginBottom: 8 }}>Laji</div>

        <div className="responsive-row">
          {SPORT_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSport(item.id);
                setLeague("ALL");
              }}
              style={pill(sport === item.id)}
            >
              {item.labelFi}
            </button>
          ))}
        </div>

        <div style={{ color: "#94a3b8", marginTop: 18, marginBottom: 8 }}>
          Liiga
        </div>

        <div className="responsive-row">
          <button
            type="button"
            onClick={() => setLeague("ALL")}
            style={pill(league === "ALL")}
          >
            Kaikki
          </button>

          {leagues.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLeague(item.id)}
              style={pill(league === item.id)}
            >
              {item.labelFi}
            </button>
          ))}
        </div>
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0 }}>Päivän parhaat vedot</h2>

        {!topPicks.length ? (
          <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>
            Ei value-kohteita nykyisillä filttereillä. Päivitä ottelut tai
            kokeile toista liigaa.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {topPicks.slice(0, 5).map((pick, index) => (
              <div
                key={pick.id || index}
                className="pick-card"
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 18,
                  padding: 14,
                  background: "rgba(255,255,255,0.045)",
                }}
              >
                <h3 style={{ marginTop: 0 }}>{pick.label || "Value pick"}</h3>

                <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>
                  {pick.match?.event_type === "outright"
                    ? pick.match?.home_team
                    : `${pick.match?.home_team || ""} vs ${
                        pick.match?.away_team || ""
                      }`}
                </div>

                <div style={{ marginTop: 10, fontWeight: 900 }}>
                  Kerroin {pick.odds || "-"} · Edge {edgePct(pick.edge)} · EV{" "}
                  {Number(pick.ev || pick.expectedValue || 0).toFixed(2)}
                </div>

                <div style={{ color: "#94a3b8", marginTop: 6 }}>
                  {pick.market || "Market"} · {pick.bookmaker || "Bookmaker"}
                </div>

                <button
                  type="button"
                  onClick={() => addToBetSlip(pick, pick.match)}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    border: "1px solid rgba(34,197,94,0.55)",
                    background: "rgba(34,197,94,0.15)",
                    color: "#fff",
                    borderRadius: 14,
                    padding: 12,
                    fontWeight: 900,
                  }}
                >
                  Lisää kuponkiin
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0 }}>Ottelut</h2>

        {bettableMatches.length === 0 ? (
          <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>
            Ei pelejä ladattuna. Valitse laji/liiga ja paina Päivitä.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {bettableMatches.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => setSelectedId(match.id)}
                className={
                  selectedMatch?.id === match.id
                    ? "match-card active"
                    : "match-card"
                }
              >
                <b>
                  {match.event_type === "outright"
                    ? match.home_team
                    : `${match.home_team} vs ${match.away_team}`}
                </b>

                <div style={{ color: "#94a3b8", marginTop: 6 }}>
                  {match.sport_title || match.sport_key} ·{" "}
                  {formatTime(match.commence_time)}
                </div>

                <div style={{ color: "#86efac", marginTop: 8, fontWeight: 900 }}>
                  Kertoimet saatavilla
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0 }}>
          {selectedMatch
            ? selectedMatch.event_type === "outright"
              ? selectedMatch.home_team
              : `${selectedMatch.home_team} vs ${selectedMatch.away_team}`
            : "Valitse ottelu"}
        </h2>

        <div className="responsive-row" style={{ marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setMarket("h2h")}
            style={pill(market === "h2h")}
          >
            1X2 / ML
          </button>

          <button
            type="button"
            onClick={() => setMarket("totals")}
            style={pill(market === "totals")}
          >
            Over / Under
          </button>

          <button
            type="button"
            onClick={() => setMarket("spreads")}
            style={pill(market === "spreads")}
          >
            Handicap
          </button>
        </div>

        {selectedRows.length === 0 ? (
          <div style={{ color: "#94a3b8" }}>
            Ei vetomarkkinoita tälle ottelulle.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {selectedRows.map((pick) => (
              <div
                key={`${pick.key || pick.label}-${pick.bookmaker || "book"}`}
                className="pick-card"
              >
                <h3 style={{ marginTop: 0 }}>{pick.label || "Pick"}</h3>

                <div style={{ color: "#94a3b8" }}>
                  {pick.market || "Market"} · {pick.bookmaker || "Bookmaker"}
                </div>

                <div style={{ marginTop: 10, fontWeight: 900 }}>
                  Kerroin {pick.odds || "-"} · Edge {edgePct(pick.edge)} · Malli{" "}
                  {pct(pick.modelProb || pick.modelProbability)}
                </div>

                <button
                  type="button"
                  onClick={() => addToBetSlip(pick, selectedMatch)}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    border: "1px solid rgba(34,197,94,0.55)",
                    background: "rgba(34,197,94,0.15)",
                    color: "#fff",
                    borderRadius: 14,
                    padding: 12,
                    fontWeight: 900,
                  }}
                >
                  Lisää kuponkiin
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <ParlayBuilderPanel
        picks={topPicks}
        bankroll={Number(bankroll) || 1000}
        onAddMany={addManyToBetSlip}
      />

      <ParlayAnalysisPanel
        picks={betSlip}
        bankroll={Number(bankroll) || 1000}
      />

      <ParlayRiskPanel
        picks={betSlip}
        bankroll={Number(bankroll) || 1000}
      />

      <LiveMomentumPanel match={selectedMatch} />

      <SteamMovePanel match={selectedMatch} />

      <SharpMoneyPanel match={selectedMatch} />

      <CashoutAnalyzer bet={betSlip?.[0]} />

      <AIReasoningPanel pick={selectedRows?.[0]} movement={selectedMovement} />

      <LineMovementPanel match={selectedMatch} />

      <RiskManagerPanel betSlip={betSlip} bankroll={Number(bankroll) || 1000} />

      <div id="betslip">
        <BetSlipPanel
          betSlip={betSlip}
          onRemove={removeFromBetSlip}
          onClear={clearBetSlip}
          onStakeChange={updateBetSlipStake}
          onSave={saveToHistory}
        />
      </div>

      <PerformancePanel history={betHistory} />

      <BetHistoryPanel history={betHistory} />

      <FloatingBetSlip
        betSlip={betSlip}
        onClick={() => {
          document.querySelector("#betslip")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }}
      />
    </div>
  );
}
