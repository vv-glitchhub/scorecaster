"use client";

import { useMemo, useState } from "react";
import { SPORT_OPTIONS, getLeaguesForSport } from "@/lib/league-options";
import { analyzeRows, getBestBets } from "@/lib/betting-engine";
import { getMatchDataStatus, isBettableMatch } from "@/lib/data-status";
import BetSlipPanel from "@/app/components/BetSlipPanel";

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

function pct(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "€0.00";
  return `€${n.toFixed(2)}`;
}

function MiniStat({ label, value, good = false }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 12,
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>
        {label}
      </div>

      <div
        style={{
          color: good ? "#86efac" : "#fff",
          fontWeight: 900,
          marginTop: 4,
          ...safe(),
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
      <MiniStat label="Markkina" value={pick.market || "-"} />
      <MiniStat label="Kerroin" value={pick.odds} />
      <MiniStat label="Yhtiö" value={pick.bookmaker || "Unknown"} good />
      <MiniStat label="Edge" value={pct(pick.edge)} good />
      <MiniStat label="EV" value={pick.ev?.toFixed(2) ?? "-"} good={pick.ev > 0} />
      <MiniStat label="Market %" value={pct(pick.marketProb)} />
      <MiniStat label="Malli %" value={pct(pick.modelProb)} good />
      <MiniStat label="Riski" value={pick.risk?.level || "-"} good={pick.shouldBet} />
      <MiniStat label="Panos" value={money(pick.stake)} good={pick.shouldBet} />
    </div>
  );
}

export default function BettingWorkspaceClient({ initialOddsData, lang = "fi" }) {
  const [oddsData, setOddsData] = useState(() => normalizeData(initialOddsData));
  const [sport, setSport] = useState("all");
  const [league, setLeague] = useState("ALL");
  const [status, setStatus] = useState("upcoming");
  const [oddsOnly, setOddsOnly] = useState(true);
  const [market, setMarket] = useState("h2h");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bankroll, setBankroll] = useState("1000");
  const [saved, setSaved] = useState([]);
  const [betSlip, setBetSlip] = useState([]);
  const [showData, setShowData] = useState(false);

  const matches = oddsData.matches || [];
  const bettableMatches = useMemo(() => matches.filter(isBettableMatch), [matches]);
  const leagues = useMemo(() => getLeaguesForSport(sport), [sport]);

  const selectedMatch =
    bettableMatches.find((m) => m.id === selectedId) || bettableMatches[0] || null;

  const topPicks = useMemo(
    () => getBestBets(bettableMatches, Number(bankroll) || 1000),
    [bettableMatches, bankroll]
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

      const firstBettable = normalized.matches?.find(isBettableMatch);
      setSelectedId(firstBettable?.id || null);
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
      id: `${match.id}-${pick.market}-${pick.key}`,
      match,
      ...pick,
    };

    setSaved((prev) => {
      if (prev.some((x) => x.id === item.id)) return prev;
      return [item, ...prev].slice(0, 20);
    });
  }

  function addToBetSlip(pick, match = selectedMatch) {
    if (!pick || !match) return;

    const item = {
      id: `${match.id}-${pick.market}-${pick.key}`,
      match,
      ...pick,
      userStake: pick.stake || 0,
    };

    setBetSlip((prev) => {
      if (prev.some((x) => x.id === item.id)) return prev;
      return [item, ...prev];
    });
  }

  function removeFromBetSlip(id) {
    setBetSlip((prev) => prev.filter((p) => p.id !== id));
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
          Appi näyttää Top 3 tulevat vedot, markkinan, riskitason, panoksen,
          yhtiön ja perustelun.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <div style={card({ padding: 14, background: "rgba(255,255,255,0.05)" })}>
            <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 900 }}>
              API otteluita
            </div>
            <div style={{ fontWeight: 900, marginTop: 4 }}>{matches.length}</div>
          </div>

          <div style={card({ padding: 14, background: "rgba(255,255,255,0.05)" })}>
            <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 900 }}>
              Betattavia
            </div>
            <div style={{ fontWeight: 900, marginTop: 4 }}>{bettableMatches.length}</div>
          </div>
        </div>
      </section>

      <section
        style={card({
          borderColor: topPicks.length ? "rgba(34,197,94,0.45)" : "rgba(245,158,11,0.35)",
          background: topPicks.length ? "rgba(6,78,59,0.18)" : "rgba(245,158,11,0.08)",
        })}
      >
        <h2 style={{ margin: 0, fontSize: 30 }}>Top 3 tulevat vedot</h2>

        {topPicks.length === 0 ? (
          <p style={{ color: "#fde68a", fontWeight: 800, lineHeight: 1.5 }}>
            Ei vetosuosituksia. Hae pelejä tai kokeile isoa sarjaa kuten NHL, NBA,
            NFL, Premier League tai MLB.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            {topPicks.slice(0, 3).map((pick, index) => (
              <div key={pick.id} style={card({ background: "rgba(15,23,42,0.78)" })}>
                <div style={{ color: "#86efac", fontWeight: 900 }}>
                  #{index + 1} LYÖ VETO
                </div>

                <h3 style={{ margin: "6px 0", fontSize: 24, ...safe() }}>{pick.label}</h3>

                <div style={{ color: "#cbd5e1", fontWeight: 800, ...safe() }}>
                  {pick.match.home_team} vs {pick.match.away_team}
                </div>

                <div style={{ color: "#94a3b8", marginTop: 4 }}>
                  {pick.match.sport_title} • {formatTime(pick.match.commence_time)}
                </div>

                <PickStats pick={pick} />

                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid rgba(34,197,94,0.18)",
                    background: "rgba(34,197,94,0.08)",
                    borderRadius: 14,
                    padding: 12,
                    color: "#d1fae5",
                    lineHeight: 1.5,
                    fontWeight: 800,
                  }}
                >
                  Aloittelijan ohje: {pick.beginnerAction || "Pieni tai maltillinen panos."}
                </div>

                <details style={{ marginTop: 12, color: "#94a3b8" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 900 }}>Miksi tämä?</summary>
                  <div style={{ marginTop: 8, lineHeight: 1.5 }}>
                    Markkina arvioi: {pct(pick.marketProb)}
                    <br />
                    Malli arvioi: {pct(pick.modelProb)}
                    <br />
                    Ero eli edge: {pct(pick.edge)}
                    <br />
                    Riskitaso: {pick.risk?.level || "-"}
                    <br />
                    Yhtiö: {pick.bookmaker || "Unknown"}
                    <br />
                    {pick.risk?.message || "Tarkista vielä joukkueuutiset ennen panostusta."}
                  </div>
                </details>

                <button
                  type="button"
                  onClick={() => addToBetSlip(pick, pick.match)}
                  style={{ ...button(true), marginTop: 12 }}
                >
                  Lisää kuponkiin
                </button>

                <button
                  type="button"
                  onClick={() => savePick(pick, pick.match)}
                  style={{ ...button(false), marginTop: 10 }}
                >
                  Tallenna seurantaan
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
            <option value="1">Vain betattavat pelit</option>
            <option value="0">Hae kaikki, mutta näytä bettingissä vain kertoimelliset</option>
          </select>

          <button
            type="button"
            onClick={() => loadGames(false)}
            disabled={loading}
            style={button(true, loading)}
          >
            {loading ? "Haetaan..." : "Hae pelit"}
          </button>

          <button
            type="button"
            onClick={() => loadGames(true)}
            disabled={loading}
            style={button(false, loading)}
          >
            Pakota uusi haku
          </button>
        </div>

        {oddsData.reason ? (
          <div
            style={{
              marginTop: 14,
              color: "#fde68a",
              fontWeight: 800,
              lineHeight: 1.5,
              ...safe(),
            }}
          >
            {oddsData.reason}
          </div>
        ) : null}
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0 }}>Betattavat ottelut</h2>

        {bettableMatches.length === 0 ? (
          <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>
            Ei betattavia pelejä ladattuna. Valitse iso sarja ja paina Hae pelit.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {bettableMatches.map((match) => {
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

        {!selectedMatch ? (
          <div style={{ color: "#94a3b8", marginTop: 14, lineHeight: 1.5 }}>
            Valitse ottelu listasta.
          </div>
        ) : selectedRows.length === 0 ? (
          <div style={{ color: "#94a3b8", marginTop: 14, lineHeight: 1.5 }}>
            Tälle markkinalle ei löytynyt rivejä tästä ottelusta.
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

                <PickStats pick={bestSelected} />

                <div
                  style={{
                    marginTop: 12,
                    color: "#d1fae5",
                    fontWeight: 800,
                    lineHeight: 1.5,
                  }}
                >
                  Aloittelijan ohje: {bestSelected.beginnerAction || "Maltillinen panos."}
                </div>

                <button
                  type="button"
                  onClick={() => addToBetSlip(bestSelected)}
                  style={{ ...button(true), marginTop: 12 }}
                >
                  Lisää kuponkiin
                </button>

                <button
                  type="button"
                  onClick={() => savePick(bestSelected)}
                  style={{ ...button(false), marginTop: 10 }}
                >
                  Tallenna seurantaan
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

                <PickStats pick={row} />

                <div
                  style={{
                    color: row.shouldBet ? "#86efac" : "#fca5a5",
                    fontWeight: 900,
                    marginTop: 10,
                  }}
                >
                  {row.shouldBet ? "LYÖ" : "ÄLÄ LYÖ"} • {row.beginnerAction}
                </div>

                {row.shouldBet ? (
                  <button
                    type="button"
                    onClick={() => addToBetSlip(row)}
                    style={{ ...button(true), marginTop: 12 }}
                  >
                    Lisää kuponkiin
                  </button>
                ) : null}
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

      <BetSlipPanel
        picks={betSlip}
        onRemove={removeFromBetSlip}
        onClear={clearBetSlip}
        onStakeChange={updateBetSlipStake}
      />

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
                  {pick.market} • Odds {pick.odds} • {pick.bookmaker || "Unknown"} • Edge{" "}
                  {pct(pick.edge)} • Panos {money(pick.stake)}
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
                totalMatches: matches.length,
                bettableMatches: bettableMatches.length,
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
