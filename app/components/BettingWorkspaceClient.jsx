"use client";

import { useEffect, useMemo, useState } from "react";

import {
  SPORT_OPTIONS,
  getLeaguesForSport,
} from "@/lib/league-options";

import {
  analyzeRows,
  getBestBets,
} from "@/lib/betting-engine";

import {
  getMatchDataStatus,
  isBettableMatch,
} from "@/lib/data-status";

import {
  addOddsSnapshots,
  clearOddsHistory,
  getOddsMovement,
} from "@/lib/odds-history-store";

import {
  BOOKMAKER_OPTIONS,
  DEFAULT_USER_BOOKMAKERS,
} from "@/lib/bookmaker-options";

import BetSlipPanel from "@/app/components/BetSlipPanel";
import LineMovementPanel from "@/app/components/LineMovementPanel";
import AIReasoningPanel from "@/app/components/AIReasoningPanel";

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
    flex: "0 0 auto",
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

function formatTime(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("fi-FI", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function normalizeData(data) {
  return {
    source: data?.source || "",
    status: data?.status || "",
    provider: data?.provider || "",
    reason: data?.reason || "",
    cached: Boolean(data?.cached),
    debug: data?.debug || {},
    matches: Array.isArray(data?.matches)
      ? data.matches
      : [],
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
        fontSize: 13,
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
  const [oddsData, setOddsData] = useState(() =>
    normalizeData(initialOddsData)
  );

  const [sport, setSport] = useState("all");
  const [league, setLeague] = useState("ALL");

  const [market, setMarket] =
    useState("h2h");

  const [selectedId, setSelectedId] =
    useState(null);

  const [selectedBookmakers, setSelectedBookmakers] =
    useState(DEFAULT_USER_BOOKMAKERS);

  const [betSlip, setBetSlip] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [isLiveMode, setIsLiveMode] =
    useState(false);

  const [autoRefresh, setAutoRefresh] =
    useState(false);

  const matches = oddsData.matches || [];

  const leagues = useMemo(
    () => getLeaguesForSport(sport),
    [sport]
  );

  const bettableMatches = useMemo(
    () => matches.filter(isBettableMatch),
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
        1000,
        selectedBookmakers
      ),
    [
      selectedMatch,
      market,
      selectedBookmakers,
    ]
  );

  const topPicks = useMemo(
    () =>
      getBestBets(
        bettableMatches,
        1000,
        selectedBookmakers
      ),
    [
      bettableMatches,
      selectedBookmakers,
    ]
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

      if (normalized.matches?.length) {
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
      setOddsData({
        source: "error",
        status: "error",
        reason: error.message,
        matches: [],
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
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

  function toggleBookmaker(id) {
    setSelectedBookmakers((prev) =>
      prev.includes(id)
        ? prev.filter(
            (x) => x !== id
          )
        : [...prev, id]
    );
  }

  function addToBetSlip(
    pick,
    match = selectedMatch
  ) {
    if (!pick || !match) return;

    const item = {
      id: `${match.id}-${pick.market}-${pick.key}-${pick.bookmaker}`,
      match,
      ...pick,
      addedOdds: pick.odds,
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

  function removeFromBetSlip(id) {
    setBetSlip((prev) =>
      prev.filter(
        (p) => p.id !== id
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
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              userStake: value,
            }
          : p
      )
    );
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
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
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
            style={button(
              isLiveMode
            )}
          >
            {isLiveMode
              ? "LIVE MODE AKTIIVINEN"
              : "Vaihda LIVE modeen"}
          </button>

          <button
            type="button"
            onClick={() =>
              setAutoRefresh(
                (v) => !v
              )
            }
            style={button(
              autoRefresh
            )}
          >
            {autoRefresh
              ? "Auto refresh ON"
              : "Auto refresh OFF"}
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
              : "Hae ottelut"}
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
                  sport === item.id
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
              league === "ALL"
            )}
          >
            Kaikki
          </button>

          {leagues.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                setLeague(item.id)
              }
              style={pill(
                league === item.id
              )}
            >
              {item.labelFi}
            </button>
          ))}
        </div>
      </section>

      <section style={card()}>
        <div
          style={{
            color: "#94a3b8",
            marginBottom: 8,
          }}
        >
          Bookmakerit
        </div>

        <div style={rowScroll()}>
          {BOOKMAKER_OPTIONS.map(
            (item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  toggleBookmaker(
                    item.id
                  )
                }
                style={pill(
                  selectedBookmakers.includes(
                    item.id
                  )
                )}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      </section>

      <section style={card()}>
        <h2
          style={{
            marginTop: 0,
          }}
        >
          {isLiveMode
            ? "Live Top Picks"
            : "Top Picks"}
        </h2>

        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          {topPicks.map((pick) => (
            <div
              key={pick.id}
              style={card({
                background:
                  "rgba(255,255,255,0.04)",
              })}
            >
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap: 10,
                  flexWrap:
                    "wrap",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                  }}
                >
                  {pick.label}
                </h3>

                {isLiveMode ? (
                  <LiveBadge />
                ) : null}
              </div>

              <div
                style={{
                  color:
                    "#94a3b8",
                  marginTop: 6,
                }}
              >
                {
                  pick.match
                    .home_team
                }{" "}
                vs{" "}
                {
                  pick.match
                    .away_team
                }
              </div>

              <div
                style={{
                  marginTop: 10,
                  lineHeight: 1.7,
                }}
              >
                Odds:{" "}
                {
                  pick.odds
                }{" "}
                · Edge:{" "}
                {(
                  pick.edge *
                  100
                ).toFixed(
                  1
                )}
                %
                <br />
                Bookmaker:{" "}
                {
                  pick.bookmaker
                }
                <br />
                EV:{" "}
                {pick.ev.toFixed(
                  2
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  addToBetSlip(
                    pick,
                    pick.match
                  )
                }
                style={{
                  ...button(
                    true
                  ),
                  marginTop: 12,
                }}
              >
                Lisää kuponkiin
              </button>
            </div>
          ))}
        </div>
      </section>

      <section style={card()}>
        <h2
          style={{
            marginTop: 0,
          }}
        >
          Ottelut
        </h2>

        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {bettableMatches.map(
            (match) => {
              const status =
                getMatchDataStatus(
                  match
                );

              return (
                <button
                  key={match.id}
                  type="button"
                  onClick={() =>
                    setSelectedId(
                      match.id
                    )
                  }
                  style={{
                    width: "100%",
                    border:
                      selectedMatch?.id ===
                      match.id
                        ? "1px solid rgba(34,197,94,0.65)"
                        : "1px solid rgba(255,255,255,0.10)",
                    background:
                      selectedMatch?.id ===
                      match.id
                        ? "rgba(34,197,94,0.14)"
                        : "rgba(255,255,255,0.04)",
                    color: "#fff",
                    borderRadius: 16,
                    padding: 14,
                    textAlign:
                      "left",
                    cursor:
                      "pointer",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      gap: 10,
                    }}
                  >
                    <b>
                      {
                        match.home_team
                      }{" "}
                      vs{" "}
                      {
                        match.away_team
                      }
                    </b>

                    {isLiveMode ? (
                      <LiveBadge />
                    ) : null}
                  </div>

                  <div
                    style={{
                      color:
                        "#94a3b8",
                      marginTop: 6,
                    }}
                  >
                    {
                      match.sport_title
                    }{" "}
                    ·{" "}
                    {formatTime(
                      match.commence_time
                    )}
                  </div>

                  <div
                    style={{
                      color:
                        status.color,
                      fontWeight: 900,
                      marginTop: 8,
                    }}
                  >
                    {
                      status.label
                    }
                  </div>
                </button>
              );
            }
          )}
        </div>
      </section>

      <LineMovementPanel
        match={selectedMatch}
      />

      {selectedRows?.[0] ? (
        <AIReasoningPanel
          pick={
            selectedRows[0]
          }
          match={
            selectedMatch
          }
          movement={
            selectedMovement
          }
        />
      ) : null}

      <BetSlipPanel
        picks={betSlip}
        matches={
          bettableMatches
        }
        onRemove={
          removeFromBetSlip
        }
        onClear={
          clearBetSlip
        }
        onStakeChange={
          updateBetSlipStake
        }
      />

      <section style={card()}>
        <button
          type="button"
          onClick={
            clearOddsHistory
          }
          style={button()}
        >
          Tyhjennä odds
          history
        </button>
      </section>
    </div>
  );
}
