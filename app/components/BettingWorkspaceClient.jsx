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
    background: "rgba(2,6,23,0.72)",
    maxWidth: "100%",
    overflow: "hidden",
    ...extra,
  };
}

function pillButton(active = false) {
  return {
    flex: "0 0 auto",
    border: active
      ? "1px solid rgba(34,197,94,0.70)"
      : "1px solid rgba(255,255,255,0.12)",
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

function actionButton(primary = false, disabled = false) {
  return {
    width: "100%",
    border: primary
      ? "1px solid rgba(34,197,94,0.65)"
      : "1px solid rgba(255,255,255,0.14)",
    background: primary ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.08)",
    color: primary ? "#bbf7d0" : "#ffffff",
    borderRadius: 16,
    padding: "14px 16px",
    fontSize: 16,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

function inputStyle() {
  return {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.07)",
    color: "#ffffff",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontWeight: 800,
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
    cacheAgeSeconds: data?.cacheAgeSeconds ?? null,
    debug: data?.debug || null,
    filters: data?.filters || null,
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

  const adjustment = {
    home: 0.015,
    draw: -0.005,
    away: 0.015,
  };

  return Math.max(0.01, Math.min(0.95, base[side] + (adjustment[side] || 0)));
}

function buildMarketRows(match, market) {
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
    ].filter((row) => row.odds);
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
    ].filter((row) => row.odds);
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
  ].filter((row) => row.odds);
}

function buildPick(match, row, bankroll) {
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
}

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("fi-FI", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
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
  const [showDetails, setShowDetails] = useState(false);

  const leagueOptions = useMemo(() => getLeaguesForSport(sportFilter), [sportFilter]);
  const matches = oddsData.matches || [];

  const selectedMatch = useMemo(() => {
    return matches.find((m) => m.id === selectedMatchId) || matches[0] || null;
  }, [matches, selectedMatchId]);

  const allPicks = useMemo(() => {
    return matches
      .filter((match) => !match.fixturesOnly)
      .flatMap((match) => buildMarketRows(match, "h2h").map((row) => buildPick(match, row, bankroll)))
      .filter((pick) => pick.edge != null && pick.edge > 0.005)
      .sort((a, b) => b.edge - a.edge);
  }, [matches, bankroll]);

  const topPicks = allPicks.slice(0, 5);
  const safestPick = allPicks.filter((pick) => pick.odds < 2.2)[0] || null;
  const highOddsPick = allPicks.filter((pick) => pick.odds >= 2.5)[0] || null;

  const marketRows = useMemo(() => {
    return buildMarketRows(selectedMatch, market);
  }, [selectedMatch, market]);

  async function loadGames(force = false) {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("sport", sportFilter);
      params.set("league", leagueFilter);
      params.set("status", statusFilter);
      params.set("oddsOnly", oddsOnly ? "1" : "0");

      if (force) params.set("force", "1");

      const res = await fetch(`/api/odds?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await res.json();
      const normalized = normalizeOddsData(data);

      setOddsData(normalized);
      setSelectedMatchId(normalized.matches?.[0]?.id || null);
    } catch (error) {
      setOddsData({
        source: "error",
        status: "error",
        provider: "",
        reason: `Datan haku epäonnistui: ${error.message}`,
        matches: [],
      });
    } finally {
      setLoading(false);
    }
  }

  function savePick(pick) {
    setSavedPicks((prev) => {
      if (prev.some((item) => item.id === pick.id)) return prev;
      return [pick, ...prev].slice(0, 20);
    });
  }

  function removePick(id) {
    setSavedPicks((prev) => prev.filter((item) => item.id !== id));
  }

  function currentStake(row) {
    if (stakeMode === "kelly") {
      return kellyStake({
        odds: row.odds,
        probability: row.probability,
        bankroll: Number(bankroll) || 1000,
        fraction: 0.25,
      });
    }

    return Number(manualStake) || 0;
  }

  const dataLabel =
    oddsData.status === "fresh"
      ? "Data ladattu"
      : oddsData.status === "empty"
      ? "Ei kohteita"
      : oddsData.status === "waiting"
      ? "Odottaa hakua"
      : "Tarkista data";

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: "100%", overflow: "hidden" }}>
      <section
        style={cardStyle({
          background:
            "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(2,6,23,0.82))",
          borderColor: "rgba(34,197,94,0.30)",
        })}
      >
        <div style={{ color: "#86efac", fontWeight: 900, letterSpacing: 4, fontSize: 13 }}>
          SCORECASTER ALPHA
        </div>

        <h1
          style={{
            margin: "10px 0 8px",
            fontSize: "clamp(34px, 9vw, 58px)",
            lineHeight: 1.02,
            ...safeText(),
          }}
        >
          Vedonlyöntiavustaja
        </h1>

        <p style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 17, lineHeight: 1.45 }}>
          Etsi value-kohteita, katso päivän nostot ja hallitse panostusta. Data haetaan vain napista,
          jotta API-krediittejä ei kulu turhaan.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <div style={cardStyle({ padding: 14, background: "rgba(255,255,255,0.05)" })}>
            <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 900 }}>Status</div>
            <div style={{ fontWeight: 900, marginTop: 4 }}>{dataLabel}</div>
          </div>

          <div style={cardStyle({ padding: 14, background: "rgba(255,255,255,0.05)" })}>
            <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 900 }}>Kohteita</div>
            <div style={{ fontWeight: 900, marginTop: 4 }}>{matches.length}</div>
          </div>
        </div>
      </section>

      <section
        style={cardStyle({
          borderColor: "rgba(34,197,94,0.35)",
          background: "rgba(6,78,59,0.18)",
        })}
      >
        <h2 style={{ margin: 0, fontSize: 30 }}>Päivän pickit</h2>

        <p style={{ color: "#a7f3d0", fontWeight: 700, lineHeight: 1.45 }}>
          Parhaat value-signaalit nykyisestä haetusta datasta.
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
                    <div style={{ color: "#86efac", fontWeight: 900 }}>
                      #{index + 1} Grade {pick.grade.label}
                    </div>

                    <h3 style={{ margin: "6px 0", fontSize: 22, ...safeText() }}>
                      {pick.label}
                    </h3>

                    <div style={{ color: "#cbd5e1", fontWeight: 800, ...safeText() }}>
                      {pick.match.home_team} vs {pick.match.away_team}
                    </div>

                    <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
                      {pick.match.sport_title} • {formatDate(pick.match.commence_time)}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", fontWeight: 900, flexShrink: 0 }}>
                    <div>Odds {pick.odds}</div>
                    <div style={{ color: "#86efac" }}>Edge {(pick.edge * 100).toFixed(1)}%</div>
                  </div>
                </div>

                <div style={{ marginTop: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                  Suosituspanos:{" "}
                  <b style={{ color: "#fff" }}>€{pick.stake || Number(manualStake || 0)}</b>.{" "}
                  Peruste: mallin arvio on markkinan implied probabilitya korkeampi.
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
              {safestPick
                ? `${safestPick.label} @ ${safestPick.odds} (${(safestPick.edge * 100).toFixed(1)}%)`
                : "Ei vielä saatavilla"}
            </div>
          </div>

          <div style={cardStyle({ background: "rgba(255,255,255,0.04)" })}>
            <b>Korkein value-oddsi</b>
            <div style={{ color: "#94a3b8", marginTop: 6 }}>
              {highOddsPick
                ? `${highOddsPick.label} @ ${highOddsPick.odds} (${(highOddsPick.edge * 100).toFixed(1)}%)`
                : "Ei vielä saatavilla"}
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
                type="button"
                onClick={() => {
                  setSportFilter(sport.id);
                  setLeagueFilter("ALL");
                }}
                style={pillButton(sportFilter === sport.id)}
              >
                {lang === "fi" ? sport.labelFi : sport.labelEn}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#94a3b8", fontWeight: 900, marginBottom: 8 }}>Liiga</div>
          <div style={scrollRowStyle()}>
            <button
              type="button"
              onClick={() => setLeagueFilter("ALL")}
              style={pillButton(leagueFilter === "ALL")}
            >
              Kaikki
            </button>

            {leagueOptions.map((league) => (
              <button
                key={league.id}
                type="button"
                onClick={() => setLeagueFilter(league.id)}
                style={pillButton(leagueFilter === league.id)}
              >
                {lang === "fi" ? league.labelFi : league.labelEn}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle()}>
            <option value="upcoming">Tulevat</option>
            <option value="live">Live</option>
            <option value="all">Kaikki</option>
          </select>

          <select value={oddsOnly ? "1" : "0"} onChange={(e) => setOddsOnly(e.target.value === "1")} style={inputStyle()}>
            <option value="1">Vain kertoimelliset kohteet</option>
            <option value="0">Näytä myös ottelulistat</option>
          </select>

          <button type="button" onClick={() => loadGames(false)} disabled={loading} style={actionButton(true, loading)}>
            {loading ? "Haetaan..." : "Hae pelit"}
          </button>

          <button type="button" onClick={() => loadGames(true)} disabled={loading} style={actionButton(false, loading)}>
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
          {MARKET_TYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMarket(item.id)}
              style={pillButton(market === item.id)}
            >
              {lang === "fi" ? item.labelFi : item.labelEn}
            </button>
          ))}
        </div>
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Ottelut</h2>

        {matches.length === 0 ? (
          <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>
            Ei pelejä ladattuna. Valitse laji/liiga ja paina Hae pelit.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {matches.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => setSelectedMatchId(match.id)}
                style={{
                  width: "100%",
                  border:
                    selectedMatch?.id === match.id
                      ? "1px solid rgba(34,197,94,0.65)"
                      : "1px solid rgba(255,255,255,0.1)",
                  background:
                    selectedMatch?.id === match.id
                      ? "rgba(34,197,94,0.14)"
                      : "rgba(255,255,255,0.04)",
                  color: "#fff",
                  borderRadius: 16,
                  padding: 14,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <b style={safeText()}>
                  {match.home_team} vs {match.away_team}
                </b>

                <div style={{ color: "#94a3b8", marginTop: 6 }}>
                  {match.sport_title} • {formatDate(match.commence_time)}{" "}
                  {match.fixturesOnly ? "• vain ottelulista" : ""}
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
          {selectedMatch
            ? `${selectedMatch.home_team} vs ${selectedMatch.away_team}`
            : "Valitse ottelu"}
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
              const pick = buildPick(selectedMatch, row, bankroll);
              const stake = stakeMode === "kelly" ? pick.stake : Number(manualStake) || 0;

              return (
                <div key={row.key} style={cardStyle({ background: "rgba(255,255,255,0.04)" })}>
                  <h3 style={{ margin: 0, ...safeText() }}>{row.label}</h3>

                  <div style={{ marginTop: 8 }}>Odds {row.odds}</div>

                  <div
                    style={{
                      color: pick.edge > 0 ? "#86efac" : "#fca5a5",
                      fontWeight: 900,
                      marginTop: 6,
                    }}
                  >
                    Edge {pick.edge != null ? `${(pick.edge * 100).toFixed(1)}%` : "-"} • EV{" "}
                    {pick.ev != null ? pick.ev.toFixed(2) : "-"}
                  </div>

                  <div style={{ color: "#94a3b8", marginTop: 8 }}>
                    Suosituspanos €{stake}
                  </div>

                  <button
                    type="button"
                    onClick={() => savePick({ ...pick, stake })}
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
          <button type="button" onClick={() => setStakeMode("manual")} style={actionButton(stakeMode === "manual")}>
            Manuaalinen
          </button>

          <button type="button" onClick={() => setStakeMode("kelly")} style={actionButton(stakeMode === "kelly")}>
            Kelly
          </button>
        </div>

        <input
          value={stakeMode === "kelly" ? bankroll : manualStake}
          onChange={(e) =>
            stakeMode === "kelly"
              ? setBankroll(e.target.value)
              : setManualStake(e.target.value)
          }
          placeholder={stakeMode === "kelly" ? "Kassa €" : "Panos €"}
          style={inputStyle()}
        />

        {stakeMode === "kelly" ? (
          <div style={{ color: "#94a3b8", marginTop: 8, lineHeight: 1.5 }}>
            Kelly käyttää 25 % Kellyä riskin pienentämiseksi.
          </div>
        ) : null}
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Tallennetut pickit</h2>

        {savedPicks.length === 0 ? (
          <div style={{ color: "#94a3b8" }}>Ei tallennettuja pickejä.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {savedPicks.map((pick) => (
              <div key={pick.id} style={cardStyle({ background: "rgba(255,255,255,0.04)" })}>
                <b style={safeText()}>{pick.label}</b>

                <div style={{ color: "#94a3b8", marginTop: 4, ...safeText() }}>
                  {pick.match.home_team} vs {pick.match.away_team}
                </div>

                <div style={{ marginTop: 6 }}>
                  Odds {pick.odds} • Edge {(pick.edge * 100).toFixed(1)}% • Stake €{pick.stake}
                </div>

                <button
                  type="button"
                  onClick={() => removePick(pick.id)}
                  style={{ ...actionButton(false), marginTop: 10 }}
                >
                  Poista
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle()}>
        <button type="button" onClick={() => setShowDetails((v) => !v)} style={actionButton(false)}>
          {showDetails ? "Piilota lisätiedot" : "Näytä lisätiedot"}
        </button>

        {showDetails ? (
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <div style={{ color: "#94a3b8" }}>
              Source: {oddsData.source} • Provider: {oddsData.provider || "-"} • Status: {oddsData.status}
            </div>

            {oddsData.cached ? (
              <div style={{ color: "#94a3b8" }}>Cache age: {oddsData.cacheAgeSeconds}s</div>
            ) : null}

            {oddsData.debug ? (
              <pre
                style={{
                  background: "rgba(0,0,0,0.35)",
                  borderRadius: 14,
                  padding: 12,
                  overflowX: "auto",
                  color: "#cbd5e1",
                  fontSize: 12,
                }}
              >
                {JSON.stringify(oddsData.debug, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
