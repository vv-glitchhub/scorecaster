"use client";

import { useEffect, useMemo, useState } from "react";

import { SPORT_OPTIONS, getLeaguesForSport } from "@/lib/league-options";

import {
  analyzeRows,
  getBestBets,
} from "@/lib/betting-engine";

import {
  isBettableMatch,
} from "@/lib/data-status";

import {
  addOddsSnapshots,
  getOddsMovement,
} from "@/lib/odds-history-store";

import {
  DEFAULT_USER_BOOKMAKERS,
} from "@/lib/bookmaker-options";

import {
  addBetToHistory,
  getBetHistory,
} from "@/lib/bet-history-store";

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

function card(extra = {}) {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 18,
    background: "rgba(2,6,23,0.72)",
    ...extra,
  };
}

function button(primary = false) {
  return {
    width: "100%",
    border: primary
      ? "1px solid rgba(34,197,94,0.55)"
      : "1px solid rgba(255,255,255,0.14)",
    background: primary
      ? "rgba(34,197,94,0.15)"
      : "rgba(255,255,255,0.06)",
    color: "#fff",
    borderRadius: 14,
    padding: 14,
    fontWeight: 900,
    cursor: "pointer",
  };
}

function pill(active) {
  return {
    border: active
      ? "1px solid rgba(34,197,94,0.65)"
      : "1px solid rgba(255,255,255,0.12)",
    background: active
      ? "rgba(34,197,94,0.16)"
      : "rgba(255,255,255,0.06)",
    color: "#fff",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function rowScroll() {
  return {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 6,
  };
}

function normalizeData(data) {
  return {
    matches: Array.isArray(data?.matches)
      ? data.matches
      : [],
    source: data?.source || "",
    status: data?.status || "",
    provider: data?.provider || "",
    reason: data?.reason || "",
  };
}

function LiveBadge() {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        background: "rgba(239,68,68,0.15)",
        border: "1px solid rgba(239,68,68,0.35)",
        color: "#fca5a5",
        fontWeight: 900,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: "#ef4444",
        }}
      />
      LIVE
    </div>
  );
}

export default function BettingWorkspaceClient({
  initialOddsData,
}) {
  const [oddsData, setOddsData] =
    useState(() =>
      normalizeData(initialOddsData)
    );

  const [sport, setSport] =
    useState("all");

  const [league, setLeague] =
    useState("ALL");

  const [market, setMarket] =
    useState("h2h");

  const [selectedId, setSelectedId] =
    useState(null);

  const [bankroll, setBankroll] =
    useState("1000");

  const [selectedBookmakers] =
    useState(DEFAULT_USER_BOOKMAKERS);

  const [betSlip, setBetSlip] =
    useState([]);

  const [betHistory, setBetHistory] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [isLiveMode, setIsLiveMode] =
    useState(false);

  const [autoRefresh, setAutoRefresh] =
    useState(false);

  const matches = oddsData.matches || [];

  useEffect(() => {
    setBetHistory(getBetHistory());
  }, []);

  const leagues = useMemo(
    () => getLeaguesForSport(sport),
    [sport]
  );

  const bettableMatches = useMemo(
    () =>
      matches.filter(isBettableMatch),
    [matches]
  );

  const selectedMatch =
    bettableMatches.find(
      (m) => m.id === selectedId
    ) ||
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
    [
      selectedMatch,
      market,
      bankroll,
      selectedBookmakers,
    ]
  );

  const topPicks = useMemo(
    () =>
      getBestBets(
        bettableMatches,
        Number(bankroll) || 1000,
        selectedBookmakers
      ),
    [
      bettableMatches,
      bankroll,
      selectedBookmakers,
    ]
  );

  const selectedMovement =
    selectedMatch
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
      const params =
        new URLSearchParams();

      params.set("sport", sport);
      params.set("league", league);

      params.set(
        "status",
        isLiveMode
          ? "live"
          : "upcoming"
      );

      if (force) {
        params.set("force", "1");
      }

      const res = await fetch(
        `/api/odds?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      const normalized =
        normalizeData(data);

      setOddsData(normalized);

      if (
        normalized.matches?.length
      ) {
        addOddsSnapshots(
          normalized.matches
        );
      }

      const first =
        normalized.matches?.find(
          isBettableMatch
        );

      setSelectedId(
        first?.id || null
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoRefresh) return;

    const interval =
      setInterval(() => {
        loadGames(false);
      }, isLiveMode ? 30000 : 120000);

    return () =>
      clearInterval(interval);
  }, [
    autoRefresh,
    isLiveMode,
    sport,
    league,
  ]);

  function addToBetSlip(
    pick,
    match = selectedMatch
  ) {
    if (!pick || !match) return;

    const item = {
      id: `${match.id}-${pick.market}-${pick.key}`,
      match,
      ...pick,
      addedAt: Date.now(),
      userStake: pick.stake || 0,
    };

    setBetSlip((prev) => {
      if (
        prev.some(
          (x) => x.id === item.id
        )
      ) {
        return prev;
      }

      return [item, ...prev];
    });
  }

  function addManyToBetSlip(
    picks = []
  ) {
    for (const pick of picks) {
      addToBetSlip(
        pick,
        pick.match ||
          selectedMatch
      );
    }
  }

  function removeFromBetSlip(id) {
    setBetSlip((prev) =>
      prev.filter(
        (pick) => pick.id !== id
      )
    );
  }

  function clearBetSlip() {
    setBetSlip([]);
  }

  function updateBetSlipStake(
    id,
    value
  ) {
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
    const updated =
      addBetToHistory(pick);

    setBetHistory(updated);
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 18,
      }}
    >
      <section
        style={card({
          background:
            isLiveMode
              ? "rgba(127,29,29,0.25)"
              : "rgba(2,6,23,0.72)",
        })}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                color: "#fff",
              }}
            >
              Scorecaster
            </h1>

            <div
              style={{
                color: "#94a3b8",
                marginTop: 6,
              }}
            >
              Betting Intelligence
              Platform
            </div>
          </div>

          {isLiveMode ? (
            <LiveBadge />
          ) : null}
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() =>
              setIsLiveMode(
                (v) => !v
              )
            }
            style={button(isLiveMode)}
          >
            {isLiveMode
              ? "LIVE MODE AKTIIVINEN"
              : "LIVE MODE"}
          </button>

          <button
            type="button"
            onClick={() =>
              setAutoRefresh(
                (v) => !v
              )
            }
            style={button(autoRefresh)}
          >
            {autoRefresh
              ? "AUTO REFRESH ON"
              : "AUTO REFRESH OFF"}
          </button>

          <button
            type="button"
            onClick={() =>
              loadGames(true)
            }
            disabled={loading}
            style={button(true)}
          >
            {loading
              ? "Haetaan..."
              : "Päivitä ottelut"}
          </button>
        </div>
      </section>

      <section style={card()}>
        <div
          style={{
            color: "#94a3b8",
            marginBottom: 8,
          }}
        >
          Laji
        </div>

        <div style={rowScroll()}>
          {SPORT_OPTIONS.map(
            (item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSport(
                    item.id
                  );
                  setLeague(
                    "ALL"
                  );
                }}
                style={pill(
                  sport ===
                    item.id
                )}
              >
                {item.labelFi}
              </button>
            )
          )}
        </div>

        <div
          style={{
            color: "#94a3b8",
            marginTop: 18,
            marginBottom: 8,
          }}
        >
          Liiga
        </div>

        <div style={rowScroll()}>
          <button
            type="button"
            onClick={() =>
              setLeague("ALL")
            }
            style={pill(
              league ===
                "ALL"
            )}
          >
            Kaikki
          </button>

          {leagues.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                setLeague(
                  item.id
                )
              }
              style={pill(
                league ===
                  item.id
              )}
            >
              {item.labelFi}
            </button>
          ))}
        </div>
      </section>

      <ParlayBuilderPanel
        picks={topPicks}
        bankroll={
          Number(bankroll) ||
          1000
        }
        onAddMany={
          addManyToBetSlip
        }
      />

      <ParlayAnalysisPanel
        picks={betSlip}
        bankroll={
          Number(bankroll) ||
          1000
        }
      />

      <ParlayRiskPanel
        picks={betSlip}
        bankroll={
          Number(bankroll) ||
          1000
        }
      />

      <LiveMomentumPanel
        match={selectedMatch}
      />

      <SharpMoneyPanel
        match={selectedMatch}
      />

      <CashoutAnalyzer
        bet={betSlip?.[0]}
      />

      <AIReasoningPanel
        pick={
          selectedRows?.[0]
        }
        movement={
          selectedMovement
        }
      />

      <LineMovementPanel
        match={selectedMatch}
      />

      <RiskManagerPanel
        betSlip={betSlip}
        bankroll={
          Number(bankroll) ||
          1000
        }
      />

      <BetSlipPanel
        betSlip={betSlip}
        onRemove={
          removeFromBetSlip
        }
        onClear={
          clearBetSlip
        }
        onStakeChange={
          updateBetSlipStake
        }
        onSave={
          saveToHistory
        }
      />

      <PerformancePanel
        history={betHistory}
      />

      <BetHistoryPanel
        history={betHistory}
      />
    </div>
  );
}
