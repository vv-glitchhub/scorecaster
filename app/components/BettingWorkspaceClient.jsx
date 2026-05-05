"use client";

import { useMemo, useState } from "react";
import { SPORT_OPTIONS, getLeaguesForSport } from "@/lib/league-options";
import { analyzeRows, getBestBets } from "@/lib/betting-engine";
import { getMatchDataStatus, splitMatchesByDataStatus } from "@/lib/data-status";

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
    background: active ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.07)",
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
    background: primary ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.08)",
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

function safe() {
  return {
    overflowWrap: "anywhere",
    wordBreak: "break-word",
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
    matches: Array.isArray(data?.matches) ? data.matches : [],
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

export default function BettingWorkspaceClient({ initialOddsData, lang = "fi" }) {
  const [oddsData, setOddsData] = useState(() => normalizeData(initialOddsData));
  const [sport, setSport] = useState("all");
  const [league, setLeague] = useState("ALL");
  const [status, setStatus] = useState("upcoming");
  const [oddsOnly, setOddsOnly] = useState(false);
  const [market, setMarket] = useState("h2h");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bankroll, setBankroll] = useState("1000");
  const [saved, setSaved] = useState([]);
  const [showData, setShowData] = useState(false);

  const matches = oddsData.matches || [];
  const leagues = useMemo(() => getLeaguesForSport(sport), [sport]);
  const selectedMatch = matches.find((m) => m.id === selectedId) || matches[0] || null;

  const split = useMemo(() => splitMatchesByDataStatus(matches), [matches]);

  const topPicks = useMemo(
    () => getBestBets(matches, Number(bankroll) || 1000),
    [matches, bankroll]
  );

  const selectedRows = useMemo(
    () => analyzeRows(selectedMatch, market, Number(bankroll) || 1000),
    [selectedMatch, market, bankroll]
  );

  const bestSelected =
    selectedRows.filter((r) => r.shouldBet).sort((a, b) => b.edge - a.edge)[0] || null;

  async function loadGames(force = false) {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("sport", sport);
      params.set("league", league);
      params.set("status", status);
      params.set("oddsOnly", oddsOnly ? "1" : "0");
      if (force) params.set("force", "1");

      const res = await fetch(`/api/odds?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await res.json();
      const normalized = normalizeData(data);

      setOddsData(normalized);
      setSelectedId(normalized.matches?.[0]?.id || null);
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

  function savePick(pick, match = selectedMatch) {
    if (!pick || !match) return;

    const item = {
      id: `${match.id}-${pick.key}`,
      match,
      ...pick,
    };

    setSaved((prev) => {
      if (prev.some((x) => x.id === item.id)) return prev;
      return [item, ...prev].slice(0, 20);
    });
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: "100%", overflow: "hidden" }}>
      <section
        style={card({
          background:
            "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(2,6,23,0.86))",
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
            ...safe(),
          }}
        >
          Vedonlyöntiavustaja
        </h1>

        <p style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 17, lineHeight: 1.45 }}>
          Appi näyttää ensin mitä voi lyödä. Jos kertoimia ei ole, ottelu näytetään vain
          ottelulistana eikä siitä tehdä vetosuositusta.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <div style={card({ padding: 14, background: "rgba(255,255,255,0.05)" })}>
            <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 900 }}>Otteluita</div>
            <div style={{ fontWeight: 900, marginTop: 4 }}>{matches.length}</div>
          </div>

          <div style={card({ padding: 14, background: "rgba(255,255,255,0.05)" })}>
            <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 900 }}>Betattavia</div>
            <div style={{ fontWeight: 900, marginTop: 4 }}>{split.bettable.length}</div>
          </div>
        </div>
      </section>

      <section
        style={card({
          borderColor: topPicks.length ? "rgba(34,197,94,0.45)" : "rgba(245,158,11,0.35)",
          background: topPicks.length ? "rgba(6,78,59,0.18)" : "rgba(245,158,11,0.08)",
        })}
      >
        <h2 style={{ margin: 0, fontSize: 30 }}>Mitä lyödään nyt?</h2>

        {topPicks.length === 0 ? (
          <p style={{ color: "#fde68a", fontWeight: 800, lineHeight: 1.5 }}>
            Ei vetosuosituksia. Tämä on oikein, jos kertoimia ei löydy tai edge ei riitä.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            {topPicks.map((pick, index) => (
              <div key={pick.id} style={card({ background: "rgba(15,23,42,0.78)" })}>
                <div style={{ color: "#86efac", fontWeight: 900 }}>#{index + 1} LYÖ VETO</div>

                <h3 style={{ margin: "6px 0", fontSize: 24, ...safe() }}>{pick.label}</h3>

                <div style={{ color: "#cbd5e1", fontWeight: 800, ...safe() }}>
                  {pick.match.home_team} vs {pick.match.away_team}
                </div>

                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                  <div>
                    Odds: <b>{pick.odds}</b>
                  </div>
                  <div>
                    Suosituspanos: <b>€{pick.stake}</b>
                  </div>
                  <div style={{ color: "#86efac", fontWeight: 900 }}>
                    Edge: {(pick.edge * 100).toFixed(1)}%
                  </div>
                  <div>EV: {pick.ev.toFixed(2)}</div>
                </div>

                <details style={{ marginTop: 12, color: "#94a3b8" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 900 }}>Miksi tämä?</summary>
                  <div style={{ marginTop: 8, lineHeight: 1.5 }}>
                    Markkina arvioi: {(pick.marketProb * 100).toFixed(1)}%
                    <br />
                    Malli arvioi: {(pick.modelProb * 100).toFixed(1)}%
                    <br />
                    Ero on positiivinen, joten kohde voi olla alihinnoiteltu.
                  </div>
                </details>

                <button
                  type="button"
                  onClick={() => savePick(pick, pick.match)}
                  style={{ ...button(true), marginTop: 12 }}
                >
                  Tallenna pick
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0 }}>Hae kohteita</h2>

        <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#94a3b8", fontWeight: 900, marginBottom: 8 }}>Laji</div>
          <div style={rowScroll()}>
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
                {lang === "fi" ? item.labelFi : item.labelEn}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#94a3b8", fontWeight: 900, marginBottom: 8 }}>Liiga</div>
          <div style={rowScroll()}>
            <button type="button" onClick={() => setLeague("ALL")} style={pill(league === "ALL")}>
              Kaikki
            </button>

            {leagues.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLeague(item.id)}
                style={pill(league === item.id)}
              >
                {lang === "fi" ? item.labelFi : item.labelEn}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={input()}>
            <option value="upcoming">Tulevat</option>
            <option value="live">Live</option>
            <option value="all">Kaikki</option>
          </select>

          <select
            value={oddsOnly ? "1" : "0"}
            onChange={(e) => setOddsOnly(e.target.value === "1")}
            style={input()}
          >
            <option value="1">Vain kertoimelliset kohteet</option>
            <option value="0">Näytä myös ottelulistat</option>
          </select>

          <button type="button" onClick={() => loadGames(false)} disabled={loading} style={button(true, loading)}>
            {loading ? "Haetaan..." : "Hae pelit"}
          </button>

          <button type="button" onClick={() => loadGames(true)} disabled={loading} style={button(false, loading)}>
            Pakota uusi haku
          </button>
        </div>

        {oddsData.reason ? (
          <div style={{ marginTop: 14, color: "#fde68a", fontWeight: 800, lineHeight: 1.5, ...safe() }}>
            {oddsData.reason}
          </div>
        ) : null}
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0 }}>Ottelut</h2>

        {matches.length === 0 ? (
          <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>
            Ei pelejä ladattuna. Valitse laji/liiga ja paina Hae pelit.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {matches.map((match) => {
              const dataStatus = getMatchDataStatus(match);

              return (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => setSelectedId(match.id)}
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
                  <b style={safe()}>
                    {match.home_team} vs {match.away_team}
                  </b>

                  <div style={{ color: "#94a3b8", marginTop: 6 }}>
                    {match.sport_title} • {formatTime(match.commence_time)}
                  </div>

                  <div style={{ color: dataStatus.color, fontWeight: 900, marginTop: 8 }}>
                    {dataStatus.label}
                  </div>

                  <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span>Koti {match.bestOdds?.home ?? "-"}</span>
                    <span>Tasapeli {match.bestOdds?.draw ?? "-"}</span>
                    <span>Vieras {match.bestOdds?.away ?? "-"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0, ...safe() }}>
          {selectedMatch
            ? `${selectedMatch.home_team} vs ${selectedMatch.away_team}`
            : "Valitse ottelu"}
        </h2>

        {selectedMatch ? (
          <div
            style={{
              color: getMatchDataStatus(selectedMatch).color,
              fontWeight: 900,
              marginBottom: 14,
              lineHeight: 1.5,
            }}
          >
            {getMatchDataStatus(selectedMatch).message}
          </div>
        ) : null}

        <div style={rowScroll()}>
          <button type="button" onClick={() => setMarket("h2h")} style={pill(market === "h2h")}>
            1X2 / ML
          </button>
          <button type="button" onClick={() => setMarket("totals")} style={pill(market === "totals")}>
            Over / Under
          </button>
          <button type="button" onClick={() => setMarket("spreads")} style={pill(market === "spreads")}>
            Handicap
          </button>
        </div>

        {selectedRows.length === 0 ? (
          <div style={{ color: "#94a3b8", marginTop: 14, lineHeight: 1.5 }}>
            Tästä ottelusta ei voi tehdä vedonlyöntisuositusta, koska kertoimet puuttuvat tai markkina ei ole saatavilla.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            {bestSelected ? (
              <div
                style={card({
                  borderColor: "rgba(34,197,94,0.45)",
                  background: "rgba(6,78,59,0.18)",
                })}
              >
                <div style={{ color: "#86efac", fontWeight: 900 }}>
                  PARAS VETO TÄSTÄ OTTELUSTA
                </div>

                <h3 style={{ margin: "8px 0", fontSize: 24 }}>{bestSelected.label}</h3>

                <div>
                  Odds: <b>{bestSelected.odds}</b>
                </div>

                <div>
                  Suosituspanos: <b>€{bestSelected.stake}</b>
                </div>

                <div style={{ color: "#86efac", fontWeight: 900 }}>
                  Edge {(bestSelected.edge * 100).toFixed(1)}%
                </div>

                <button
                  type="button"
                  onClick={() => savePick(bestSelected)}
                  style={{ ...button(true), marginTop: 12 }}
                >
                  Tallenna pick
                </button>
              </div>
            ) : (
              <div
                style={card({
                  borderColor: "rgba(239,68,68,0.35)",
                  background: "rgba(127,29,29,0.18)",
                })}
              >
                <h3 style={{ margin: 0 }}>Älä lyö tätä ottelua nyt</h3>
                <p style={{ color: "#fecaca", lineHeight: 1.5 }}>
                  Malli ei löydä riittävää edgeä valitulta markkinalta.
                </p>
              </div>
            )}

            {selectedRows.map((row) => (
              <div key={row.key} style={card({ background: "rgba(255,255,255,0.04)" })}>
                <h3 style={{ margin: 0 }}>{row.label}</h3>

                <div style={{ marginTop: 8 }}>Odds {row.odds}</div>

                <div
                  style={{
                    color: row.shouldBet ? "#86efac" : "#fca5a5",
                    fontWeight: 900,
                    marginTop: 6,
                  }}
                >
                  {row.shouldBet ? "LYÖ" : "ÄLÄ LYÖ"} • Edge {(row.edge * 100).toFixed(1)}%
                </div>

                <div style={{ color: "#94a3b8", marginTop: 8, lineHeight: 1.5 }}>
                  Market {(row.marketProb * 100).toFixed(1)}% / Malli{" "}
                  {(row.modelProb * 100).toFixed(1)}% / EV {row.ev.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0 }}>Pelikassa ja panostus</h2>

        <input
          value={bankroll}
          onChange={(e) => setBankroll(e.target.value)}
          placeholder="Pelikassa €"
          style={input()}
        />

        <div style={{ color: "#94a3b8", marginTop: 10, lineHeight: 1.5 }}>
          Panos lasketaan 25 % Kellyllä. Alpha-vaiheessa käytä tätä vain testaukseen.
        </div>
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0 }}>Tallennetut pickit</h2>

        {saved.length === 0 ? (
          <div style={{ color: "#94a3b8" }}>Ei tallennettuja pickejä.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {saved.map((pick) => (
              <div key={pick.id} style={card({ background: "rgba(255,255,255,0.04)" })}>
                <b>{pick.label}</b>

                <div style={{ color: "#94a3b8", marginTop: 4, ...safe() }}>
                  {pick.match.home_team} vs {pick.match.away_team}
                </div>

                <div style={{ marginTop: 6 }}>
                  Odds {pick.odds} • Edge {(pick.edge * 100).toFixed(1)}% • Panos €
                  {pick.stake}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={card()}>
        <button type="button" onClick={() => setShowData((v) => !v)} style={button(false)}>
          {showData ? "Piilota data" : "Näytä data ja debug"}
        </button>

        {showData ? (
          <pre
            style={{
              marginTop: 14,
              background: "rgba(0,0,0,0.35)",
              borderRadius: 14,
              padding: 12,
              overflowX: "auto",
              color: "#cbd5e1",
              fontSize: 12,
            }}
          >
            {JSON.stringify(
              {
                source: oddsData.source,
                status: oddsData.status,
                provider: oddsData.provider,
                cached: oddsData.cached,
                debug: oddsData.debug,
              },
              null,
              2
            )}
          </pre>
        ) : null}
      </section>
    </div>
  );
}
