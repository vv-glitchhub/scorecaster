"use client";

import { useMemo, useState } from "react";
import { SPORT_OPTIONS, getLeaguesForSport } from "@/lib/league-options";
import {
  MARKET_TYPES,
  decimalToProbability,
  expectedValue,
  getPickGrade,
  kellyStake,
} from "@/lib/betting-market-types";

function cardStyle(extra = {}) {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 18,
    background: "rgba(2,6,23,0.70)",
    maxWidth: "100%",
    overflow: "hidden",
    ...extra,
  };
}

function buttonStyle(active = false) {
  return {
    border: active ? "1px solid rgba(34,197,94,0.7)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.07)",
    color: active ? "#bbf7d0" : "#ffffff",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function actionButton(primary = false) {
  return {
    width: "100%",
    border: primary ? "1px solid rgba(34,197,94,0.65)" : "1px solid rgba(255,255,255,0.14)",
    background: primary ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.08)",
    color: primary ? "#bbf7d0" : "#ffffff",
    borderRadius: 16,
    padding: "14px 16px",
    fontSize: 16,
    fontWeight: 900,
    cursor: "pointer",
  };
}

function scrollRowStyle() {
  return {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    maxWidth: "100%",
    paddingBottom: 8,
    WebkitOverflowScrolling: "touch",
  };
}

function safeText() {
  return {
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  };
}

function normalizeOddsData(data) {
  return {
    source: data?.source || "manual",
    status: data?.status || "waiting",
    provider: data?.provider || "",
    reason: data?.reason || "",
    cached: Boolean(data?.cached),
    matches: Array.isArray(data?.matches) ? data.matches : [],
  };
}

function modelProbabilityForPick(match, side) {
  const homeMarket = decimalToProbability(match?.bestOdds?.home) || 0.45;
  const drawMarket = decimalToProbability(match?.bestOdds?.draw) || 0.23;
  const awayMarket = decimalToProbability(match?.bestOdds?.away) || 0.32;

  const total = homeMarket + drawMarket + awayMarket || 1;

  const base = {
    home: homeMarket / total,
    draw: drawMarket / total,
    away: awayMarket / total,
  };

  const smallModelAdjustment = {
    home: 0.015,
    draw: -0.005,
    away: 0.015,
  };

  return Math.max(0.01, Math.min(0.95, base[side] + (smallModelAdjustment[side] || 0)));
}

function buildRows(match, market) {
  if (!match || match.fixturesOnly) return [];

  if (market === "totals") {
    const point = match.bestOdds?.point ?? "-";

    return [
      {
        key: "over",
        label: `Over ${point}`,
        odds: match.bestOdds?.over,
        probability: 0.52,
      },
      {
        key: "under",
        label: `Under ${point}`,
        odds: match.bestOdds?.under,
        probability: 0.48,
      },
    ].filter((x) => x.odds);
  }

  if (market === "spreads") {
    return [
      {
        key: "spread-home",
        label: `${match.home_team} ${match.bestOdds?.spreadPointHome || ""}`,
        odds: match.bestOdds?.spreadHome,
        probability: 0.52,
      },
      {
        key: "spread-away",
        label: `${match.away_team} ${match.bestOdds?.spreadPointAway || ""}`,
        odds: match.bestOdds?.spreadAway,
        probability: 0.48,
      },
    ].filter((x) => x.odds);
  }

  return [
    {
      key: "home",
      label: match.home_team,
      odds: match.bestOdds?.home,
      probability: modelProbabilityForPick(match, "home"),
    },
    {
      key: "draw",
      label: "Tasapeli",
      odds: match.bestOdds?.draw,
      probability: modelProbabilityForPick(match, "draw"),
    },
    {
      key: "away",
      label: match.away_team,
      odds: match.bestOdds?.away,
      probability: modelProbabilityForPick(match, "away"),
    },
  ].filter((x) => x.odds);
}

export default function BettingWorkspaceClient({ initialOddsData, lang = "fi" }) {
  const [oddsData, setOddsData] = useState(() => normalizeOddsData(initialOddsData));
  const [sportFilter, setSportFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("upcoming");
  const [oddsOnly, setOddsOnly] = useState(true);
  const [market, setMarket] = useState("h2h");
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bankroll, setBankroll] = useState("1000");
  const [manualStake, setManualStake] = useState("10");
  const [stakeMode, setStakeMode] = useState("kelly");
  const [savedPicks, setSavedPicks] = useState([]);

  const leagueOptions = useMemo(() => getLeaguesForSport(sportFilter), [sportFilter]);
  const matches = oddsData.matches || [];
  const selectedMatch = matches.find((m) => m.id === selectedMatchId) || matches[0] || null;

  const allPicks = useMemo(() => {
    return matches
      .flatMap((match) =>
        buildRows(match, "h2h").map((row) => {
          const implied = decimalToProbability(row.odds);
          const ev = expectedValue({ odds: row.odds, probability: row.probability });
          const edge = implied != null ? row.probability - implied : null;
          const stake = kellyStake({
            odds: row.odds,
            probability: row.probability,
            bankroll: Number(bankroll) || 1000,
            fraction: 0.25,
          });

          return {
            id: `${match.id}-${row.key}`,
            match,
            ...row,
            implied,
            ev,
            edge,
            stake,
            grade: getPickGrade(edge || 0),
          };
        })
      )
      .filter((p) => p.edge != null)
      .sort((a, b) => b.edge - a.edge);
  }, [matches, bankroll]);

  const topPicks = allPicks.filter((p) => p.edge > 0).slice(0, 5);
  const safestPick = allPicks.filter((p) => p.edge > 0 && p.odds < 2.2)[0] || null;
  const highOddsPick = allPicks.filter((p) => p.edge > 0 && p.odds >= 2.5)[0] || null;

  const marketRows = useMemo(() => buildRows(selectedMatch, market), [selectedMatch, market]);

  async function loadGames(force = false) {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("sport", sportFilter);
      params.set("league", leagueFilter);
      params.set("status", statusFilter);
      params.set("oddsOnly", oddsOnly ? "1" : "0");
      if (force) params.set("force", "1");

      const res = await fetch(`/api/odds?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();

      const normalized = normalizeOddsData(data);
      setOddsData(normalized);
      setSelectedMatchId(normalized.matches?.[0]?.id || null);
    } finally {
      setLoading(false);
    }
  }

  function savePick(pick) {
    setSavedPicks((prev) => {
      if (prev.some((x) => x.id === pick.id)) return prev;
      return [pick, ...prev].slice(0, 20);
    });
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: "100%", overflow: "hidden" }}>
      <section style={cardStyle()}>
        <div style={{ color: "#86efac", fontWeight: 900, letterSpacing: 4, fontSize: 13 }}>
          SCORECASTER ALPHA
        </div>
        <h1 style={{ margin: "10px 0 8px", fontSize: "clamp(32px, 9vw, 58px)", lineHeight: 1.02 }}>
          Vedonlyöntiavustaja
        </h1>
        <p style={{ color: "#94a3b8", fontWeight: 700, fontSize: 17, lineHeight: 1.45, ...safeText() }}>
          Etsi value-kohteita, vertaile markkinoita ja hallitse panostusta. Ei automaattista API-kulutusta.
        </p>
      </section>

      <section style={cardStyle({ borderColor: "rgba(34,197,94,0.35)", background: "rgba(6,78,59,0.18)" })}>
        <h2 style={{ margin: 0, fontSize: 30 }}>Päivän pickit</h2>
        <p style={{ color: "#a7f3d0", fontWeight: 700 }}>
          Parhaat signaalit nykyisestä haetusta datasta.
        </p>

        {topPicks.length === 0 ? (
          <div style={{ color: "#fde68a", lineHeight: 1.5, fontWeight: 800 }}>
            Ei vielä pickejä. Valitse laji/liiga ja paina Hae pelit.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {topPicks.map((pick, index) => (
              <div key={pick.id} style={cardStyle({ background: "rgba(15,23,42,0.75)" })}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#86efac", fontWeight: 900 }}>#{index + 1} Grade {pick.grade.label}</div>
                    <h3 style={{ margin: "6px 0", fontSize: 22, ...safeText() }}>{pick.label}</h3>
                    <div style={{ color: "#cbd5e1", fontWeight: 800, ...safeText() }}>
                      {pick.match.home_team} vs {pick.match.away_team}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontWeight: 900 }}>
                    <div>Odds {pick.odds}</div>
                    <div style={{ color: pick.edge > 0 ? "#86efac" : "#fca5a5" }}>
                      Edge {(pick.edge * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                  Suositeltu panos: <b style={{ color: "#fff" }}>€{pick.stake || Number(manualStake || 0)}</b>.{" "}
                  Peruste: markkina antaa paremman kertoimen kuin mallin arvio.
                </div>

                <button onClick={() => savePick(pick)} style={{ ...actionButton(true), marginTop: 12 }}>
                  Tallenna pick
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Nopeat nostot</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={cardStyle({ background: "rgba(255,255,255,0.04)" })}>
            <b>Turvallisin value</b>
            <div style={{ color: "#94a3b8", marginTop: 6 }}>
              {safestPick ? `${safestPick.label} @ ${safestPick.odds}` : "Ei vielä saatavilla"}
            </div>
          </div>
          <div style={cardStyle({ background: "rgba(255,255,255,0.04)" })}>
            <b>Korkein value-oddsi</b>
            <div style={{ color: "#94a3b8", marginTop: 6 }}>
              {highOddsPick ? `${highOddsPick.label} @ ${highOddsPick.odds}` : "Ei vielä saatavilla"}
            </div>
          </div>
        </div>
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Hae kohteita</h2>

        <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#94a3b8", fontWeight: 900, marginBottom: 8 }}>Laji</div>
          <div style={scrollRowStyle()}>
            {SPORT_OPTIONS.map((sport) => (
              <button
                key={sport.id}
                onClick={() => {
                  setSportFilter(sport.id);
                  setLeagueFilter("ALL");
                }}
                style={buttonStyle(sportFilter === sport.id)}
              >
                {lang === "fi" ? sport.labelFi : sport.labelEn}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#94a3b8", fontWeight: 900, marginBottom: 8 }}>Liiga</div>
          <div style={scrollRowStyle()}>
            <button onClick={() => setLeagueFilter("ALL")} style={buttonStyle(leagueFilter === "ALL")}>
              Kaikki
            </button>
            {leagueOptions.map((league) => (
              <button
                key={league.id}
                onClick={() => setLeagueFilter(league.id)}
                style={buttonStyle(leagueFilter === league.id)}
              >
                {lang === "fi" ? league.labelFi : league.labelEn}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: "100%",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.07)",
              color: "#fff",
              borderRadius: 14,
              padding: 14,
              fontWeight: 800,
            }}
          >
            <option value="upcoming">Tulevat</option>
            <option value="live">Live</option>
            <option value="all">Kaikki</option>
          </select>

          <select
            value={oddsOnly ? "1" : "0"}
            onChange={(e) => setOddsOnly(e.target.value === "1")}
            style={{
              width: "100%",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.07)",
              color: "#fff",
              borderRadius: 14,
              padding: 14,
              fontWeight: 800,
            }}
          >
            <option value="1">Vain kertoimelliset kohteet</option>
            <option value="0">Näytä myös ottelulistat</option>
          </select>

          <button onClick={() => loadGames(false)} disabled={loading} style={actionButton(true)}>
            {loading ? "Haetaan..." : "Hae pelit"}
          </button>

          <button onClick={() => loadGames(true)} disabled={loading} style={actionButton(false)}>
            Pakota uusi haku
          </button>
        </div>

        {oddsData.reason ? (
          <div style={{ marginTop: 14, color: "#fde68a", fontWeight: 800, lineHeight: 1.5, ...safeText() }}>
            {oddsData.reason}
          </div>
        ) : null}
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Markkinat</h2>
        <div style={scrollRowStyle()}>
          {MARKET_TYPES.map((m) => (
            <button key={m.id} onClick={() => setMarket(m.id)} style={buttonStyle(market === m.id)}>
              {lang === "fi" ? m.labelFi : m.labelEn}
            </button>
          ))}
        </div>
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Ottelut</h2>

        {matches.length === 0 ? (
          <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>Ei pelejä ladattuna.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {matches.map((match) => (
              <button
                key={match.id}
                onClick={() => setSelectedMatchId(match.id)}
                style={{
                  width: "100%",
                  border: selectedMatch?.id === match.id ? "1px solid rgba(34,197,94,0.65)" : "1px solid rgba(255,255,255,0.1)",
                  background: selectedMatch?.id === match.id ? "rgba(34,197,94,0.14)" : "rgba(255,255,255,0.04)",
                  color: "#fff",
                  borderRadius: 16,
                  padding: 14,
                  textAlign: "left",
                }}
              >
                <b style={safeText()}>{match.home_team} vs {match.away_team}</b>
                <div style={{ color: "#94a3b8", marginTop: 6 }}>
                  {match.sport_title} {match.fixturesOnly ? "• vain ottelulista" : ""}
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span>Koti {match.bestOdds?.home ?? "-"}</span>
                  <span>Tasapeli {match.bestOdds?.draw ?? "-"}</span>
                  <span>Vieras {match.bestOdds?.away ?? "-"}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0, ...safeText() }}>
          {selectedMatch ? `${selectedMatch.home_team} vs ${selectedMatch.away_team}` : "Valitse ottelu"}
        </h2>

        {selectedMatch?.fixturesOnly ? (
          <div style={{ color: "#fde68a", fontWeight: 800, lineHeight: 1.5 }}>
            Tästä ottelusta on vain ottelulista. Ei kertoimia, joten sitä ei nosteta pickiksi.
          </div>
        ) : marketRows.length === 0 ? (
          <div style={{ color: "#94a3b8" }}>Ei pelattavia rivejä tälle markkinalle.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {marketRows.map((row) => {
              const implied = decimalToProbability(row.odds);
              const ev = expectedValue({ odds: row.odds, probability: row.probability });
              const edge = implied != null ? row.probability - implied : null;
              const stake =
                stakeMode === "kelly"
                  ? kellyStake({
                      odds: row.odds,
                      probability: row.probability,
                      bankroll: Number(bankroll) || 1000,
                      fraction: 0.25,
                    })
                  : Number(manualStake) || 0;

              return (
                <div key={row.key} style={cardStyle({ background: "rgba(255,255,255,0.04)" })}>
                  <h3 style={{ margin: 0 }}>{row.label}</h3>
                  <div style={{ marginTop: 8 }}>Odds {row.odds}</div>
                  <div style={{ color: edge > 0 ? "#86efac" : "#fca5a5", fontWeight: 900 }}>
                    Edge {edge != null ? `${(edge * 100).toFixed(1)}%` : "-"} • EV {ev != null ? ev.toFixed(2) : "-"}
                  </div>
                  <div style={{ color: "#94a3b8", marginTop: 8 }}>
                    Suosituspanos €{stake}
                  </div>
                  <button
                    onClick={() =>
                      savePick({
                        id: `${selectedMatch.id}-${market}-${row.key}`,
                        match: selectedMatch,
                        ...row,
                        edge,
                        ev,
                        stake,
                        grade: getPickGrade(edge || 0),
                      })
                    }
                    style={{ ...actionButton(true), marginTop: 12 }}
                  >
                    Tallenna pick
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Panostus</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <button onClick={() => setStakeMode("manual")} style={actionButton(stakeMode === "manual")}>
            Manuaalinen
          </button>
          <button onClick={() => setStakeMode("kelly")} style={actionButton(stakeMode === "kelly")}>
            Kelly
          </button>
        </div>

        <input
          value={stakeMode === "kelly" ? bankroll : manualStake}
          onChange={(e) => (stakeMode === "kelly" ? setBankroll(e.target.value) : setManualStake(e.target.value))}
          placeholder={stakeMode === "kelly" ? "Kassa €" : "Panos €"}
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.07)",
            color: "#fff",
            borderRadius: 14,
            padding: 14,
            fontSize: 16,
          }}
        />
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Tallennetut pickit</h2>
        {savedPicks.length === 0 ? (
          <div style={{ color: "#94a3b8" }}>Ei tallennettuja pickejä.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {savedPicks.map((pick) => (
              <div key={pick.id} style={cardStyle({ background: "rgba(255,255,255,0.04)" })}>
                <b>{pick.label}</b>
                <div style={{ color: "#94a3b8", marginTop: 4 }}>
                  {pick.match.home_team} vs {pick.match.away_team}
                </div>
                <div style={{ marginTop: 6 }}>
                  Odds {pick.odds} • Edge {(pick.edge * 100).toFixed(1)}% • Stake €{pick.stake}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
