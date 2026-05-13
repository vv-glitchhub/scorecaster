"use client";

import { useMemo, useState } from "react";

import { SPORT_OPTIONS, getLeaguesForSport } from "@/lib/league-options";

import {
  analyzeRows,
  getBestBets,
} from "@/lib/betting-engine";

import {
  getMatchDataStatus,
  isBettableMatch,
} from "@/lib/data-status";

import BetSlipPanel from "@/app/components/BetSlipPanel";
import LineMovementPanel from "@/app/components/LineMovementPanel";
import AIReasoningPanel from "@/app/components/AIReasoningPanel";

import {
  addOddsSnapshots,
  clearOddsHistory,
  getOddsMovement,
} from "@/lib/odds-history-store";

import {
  BOOKMAKER_OPTIONS,
  DEFAULT_USER_BOOKMAKERS,
} from "@/lib/bookmaker-options";

function card(extra = {}) {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 18,
    background: "rgba(2,6,23,0.72)",
    maxWidth: "100%",
    overflow: "hidden",
    ...extra,
  };
}

function pill(active) {
  return {
    flex: "0 0 auto",
    border: active
      ? "1px solid rgba(34,197,94,0.75)"
      : "1px solid rgba(255,255,255,0.12)",
    background: active
      ? "rgba(34,197,94,0.18)"
      : "rgba(255,255,255,0.07)",
    color: active ? "#bbf7d0" : "#fff",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function button(primary = false, disabled = false) {
  return {
    width: "100%",
    border: primary
      ? "1px solid rgba(34,197,94,0.65)"
      : "1px solid rgba(255,255,255,0.14)",
    background: primary
      ? "rgba(34,197,94,0.18)"
      : "rgba(255,255,255,0.08)",
    color: primary ? "#bbf7d0" : "#fff",
    borderRadius: 16,
    padding: "14px 16px",
    fontSize: 16,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

function input() {
  return {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.07)",
    color: "#fff",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontWeight: 800,
  };
}

function rowScroll() {
  return {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    maxWidth: "100%",
    paddingBottom: 8,
    WebkitOverflowScrolling: "touch",
  };
}

function normalizeData(data) {
  return {
    source: data?.source || "manual",
    status: data?.status || "waiting",
    provider: data?.provider || "",
    reason: data?.reason || "",
    cached: Boolean(data?.cached),
    debug: data?.debug || null,
    matches: Array.isArray(data?.matches)
      ? data.matches
      : [],
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

function pct(value) {
  if (value == null || Number.isNaN(Number(value)))
    return "-";

  return `${(Number(value) * 100).toFixed(1)}%`;
}

function MiniStat({
  label,
  value,
  good = false,
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 12,
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: good ? "#86efac" : "#fff",
          fontWeight: 900,
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PickStats({ pick }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginTop: 12,
      }}
    >
      <MiniStat
        label="Markkina"
        value={pick.market || "-"}
      />

      <MiniStat
        label="Kerroin"
        value={pick.odds}
      />

      <MiniStat
        label="Yhtiö"
        value={pick.bookmaker || "Unknown"}
        good
      />

      <MiniStat
        label="Edge"
        value={pct(pick.edge)}
        good
      />

      <MiniStat
        label="EV"
        value={pick.ev?.toFixed(2) ?? "-"}
        good={pick.ev > 0}
      />

      <MiniStat
        label="Market %"
        value={pct(pick.marketProb)}
      />

      <MiniStat
        label="Malli %"
        value={pct(pick.modelProb)}
        good
      />

      <MiniStat
        label="Riski"
        value={pick.risk?.level || "-"}
        good={pick.shouldBet}
      />
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
  const [status, setStatus] =
    useState("upcoming");

  const [loading, setLoading] =
    useState(false);

  const [selectedId, setSelectedId] =
    useState(null);

  const [market, setMarket] =
    useState("h2h");

  const [bankroll] = useState("1000");

  const [selectedBookmakers, setSelectedBookmakers] =
    useState(DEFAULT_USER_BOOKMAKERS);

  const [betSlip, setBetSlip] =
    useState([]);

  const matches = oddsData.matches || [];

  const bettableMatches = useMemo(
    () => matches.filter(isBettableMatch),
    [matches]
  );

  const leagues = useMemo(
    () => getLeaguesForSport(sport),
    [sport]
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
      params.set("status", status);

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

      const firstBettable =
        normalized.matches?.find(
          isBettableMatch
        );

      setSelectedId(
        firstBettable?.id || null
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

  function toggleBookmaker(id) {
    setSelectedBookmakers((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
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
        prev.some((x) => x.id === item.id)
      ) {
        return prev;
      }

      return [item, ...prev];
    });
  }

  function removeFromBetSlip(id) {
    setBetSlip((prev) =>
      prev.filter((p) => p.id !== id)
    );
  }

  function clearBetSlip() {
    setBetSlip([]);
  }

  function updateBetSlipStake(id, value) {
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
      <section style={card()}>
        <h1 style={{ marginTop: 0 }}>
          Scorecaster
        </h1>

        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              color: "#94a3b8",
              marginBottom: 8,
            }}
          >
            Laji
          </div>

          <div style={rowScroll()}>
            {SPORT_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSport(item.id);
                  setLeague("ALL");
                }}
                style={pill(
                  sport === item.id
                )}
              >
                {item.labelFi}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              color: "#94a3b8",
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
        </div>

        <div style={{ marginBottom: 12 }}>
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
        </div>

        <button
          type="button"
          onClick={() =>
            loadGames(false)
          }
          disabled={loading}
          style={button(
            true,
            loading
          )}
        >
          {loading
            ? "Haetaan..."
            : "Hae pelit"}
        </button>

        <button
          type="button"
          onClick={() =>
            loadGames(true)
          }
          style={{
            ...button(false),
            marginTop: 10,
          }}
        >
          Pakota uusi haku
        </button>

        <button
          type="button"
          onClick={clearOddsHistory}
          style={{
            ...button(false),
            marginTop: 10,
          }}
        >
          Tyhjennä odds-historia
        </button>
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0 }}>
          Top vedot
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
              <h3 style={{ margin: 0 }}>
                {pick.label}
              </h3>

              <div
                style={{
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

              <PickStats pick={pick} />

              <button
                type="button"
                onClick={() =>
                  addToBetSlip(
                    pick,
                    pick.match
                  )
                }
                style={{
                  ...button(true),
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
        <h2 style={{ marginTop: 0 }}>
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
                        : "1px solid rgba(255,255,255,0.1)",
                    background:
                      selectedMatch?.id ===
                      match.id
                        ? "rgba(34,197,94,0.14)"
                        : "rgba(255,255,255,0.04)",
                    color: "#fff",
                    borderRadius: 16,
                    padding: 14,
                    textAlign: "left",
                    cursor: "pointer",
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
                    {status.label}
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
          pick={selectedRows[0]}
          match={selectedMatch}
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
        onClear={clearBetSlip}
        onStakeChange={
          updateBetSlipStake
        }
      />
    </div>
  );
}
