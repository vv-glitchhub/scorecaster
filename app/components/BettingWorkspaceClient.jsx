"use client";

import { useEffect, useMemo, useState } from "react";

function card() {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 18,
    background: "rgba(2,6,23,0.78)",
  };
}

function pill(active) {
  return {
    border: active
      ? "1px solid rgba(34,197,94,0.65)"
      : "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.07)",
    color: "#fff",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}

function row() {
  return {
    display: "flex",
    gap: 10,
    overflowX: "auto",
    paddingBottom: 8,
  };
}

function hasOdds(match) {
  return Boolean(
    match?.bestOdds?.home ||
      match?.bestOdds?.away ||
      match?.bestOdds?.draw ||
      match?.bestOdds?.over ||
      match?.bestOdds?.under ||
      match?.bookmakers?.length
  );
}

function formatTime(value) {
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

export default function BettingWorkspaceClient() {
  const [sport, setSport] = useState("icehockey");
  const [league, setLeague] = useState("NHL");
  const [market, setMarket] = useState("h2h");
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loading, setLoading] = useState(false);

  const sports = [
    ["all", "Kaikki"],
    ["icehockey", "Jääkiekko"],
    ["soccer", "Jalkapallo"],
    ["basketball", "Koripallo"],
  ];

  const leagues = [
    ["ALL", "Kaikki"],
    ["NHL", "NHL"],
    ["LIIGA", "Liiga 🇫🇮"],
    ["SHL", "SHL 🇸🇪"],
  ];

  async function loadGames() {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("sport", sport === "all" ? "icehockey" : sport);
      params.set("league", league === "ALL" ? "NHL" : league);
      params.set("force", "1");

      const res = await fetch(`/api/odds?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await res.json();
      const next = Array.isArray(data?.matches) ? data.matches.filter(hasOdds) : [];

      setMatches(next);
      setSelectedMatch(next[0] || null);
    } catch (error) {
      console.error(error);
      setMatches([]);
      setSelectedMatch(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGames();
  }, []);

  const bestPicks = useMemo(() => {
    return matches.slice(0, 3);
  }, [matches]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(16,185,129,0.10), transparent 30rem), linear-gradient(180deg,#020617,#071631)",
        color: "#fff",
        padding: "14px 14px 130px",
        display: "grid",
        gap: 14,
      }}
    >
      <section style={card()}>
        <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1 }}>Scorecaster</h1>
        <p style={{ margin: "10px 0 0", color: "#94a3b8", fontWeight: 800 }}>
          Betting Intelligence Platform
        </p>

        <button
          onClick={loadGames}
          disabled={loading}
          style={{
            marginTop: 16,
            width: "100%",
            border: "1px solid rgba(34,197,94,0.65)",
            background: "rgba(34,197,94,0.18)",
            color: "#fff",
            borderRadius: 16,
            padding: 14,
            fontWeight: 950,
            fontSize: 16,
          }}
        >
          {loading ? "Päivitetään..." : "Päivitä ottelut"}
        </button>
      </section>

      <section style={card()}>
        <div style={{ color: "#94a3b8", fontWeight: 900, marginBottom: 8 }}>
          Laji
        </div>

        <div style={row()}>
          {sports.map(([key, label]) => (
            <button key={key} onClick={() => setSport(key)} style={pill(sport === key)}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ color: "#94a3b8", fontWeight: 900, margin: "16px 0 8px" }}>
          Liiga
        </div>

        <div style={row()}>
          {leagues.map(([key, label]) => (
            <button key={key} onClick={() => setLeague(key)} style={pill(league === key)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0, fontSize: 30 }}>Ottelut</h2>

        {matches.length === 0 ? (
          <p style={{ color: "#94a3b8", fontWeight: 800 }}>
            Ei pelejä ladattuna. Valitse liiga ja paina Päivitä.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {matches.map((match) => (
              <button
                key={match.id}
                onClick={() => setSelectedMatch(match)}
                style={{
                  textAlign: "left",
                  border:
                    selectedMatch?.id === match.id
                      ? "1px solid rgba(34,197,94,0.75)"
                      : "1px solid rgba(255,255,255,0.10)",
                  background:
                    selectedMatch?.id === match.id
                      ? "rgba(34,197,94,0.14)"
                      : "rgba(255,255,255,0.05)",
                  color: "#fff",
                  borderRadius: 18,
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 950, fontSize: 18 }}>
                  {match.home_team} vs {match.away_team}
                </div>

                <div style={{ color: "#94a3b8", marginTop: 6 }}>
                  {match.sport_title} · {formatTime(match.commence_time)}
                </div>

                <div style={{ color: "#86efac", marginTop: 8, fontWeight: 950 }}>
                  {match.bestOdds?.home || "-"} / {match.bestOdds?.away || "-"}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0, fontSize: 30 }}>Valitse ottelu</h2>

        {selectedMatch ? (
          <>
            <div style={{ color: "#cbd5e1", fontWeight: 900 }}>
              {selectedMatch.home_team} vs {selectedMatch.away_team}
            </div>

            <div style={{ ...row(), marginTop: 14 }}>
              <button onClick={() => setMarket("h2h")} style={pill(market === "h2h")}>
                1X2 / ML
              </button>
              <button onClick={() => setMarket("totals")} style={pill(market === "totals")}>
                Over / Under
              </button>
              <button onClick={() => setMarket("spreads")} style={pill(market === "spreads")}>
                Handicap
              </button>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {market === "h2h" && (
                <>
                  <OddButton label={selectedMatch.home_team} odds={selectedMatch.bestOdds?.home} />
                  {selectedMatch.bestOdds?.draw && (
                    <OddButton label="Tasapeli" odds={selectedMatch.bestOdds?.draw} />
                  )}
                  <OddButton label={selectedMatch.away_team} odds={selectedMatch.bestOdds?.away} />
                </>
              )}

              {market === "totals" && (
                <>
                  <OddButton
                    label={`Over ${selectedMatch.bestOdds?.point || ""}`}
                    odds={selectedMatch.bestOdds?.over}
                  />
                  <OddButton
                    label={`Under ${selectedMatch.bestOdds?.point || ""}`}
                    odds={selectedMatch.bestOdds?.under}
                  />
                </>
              )}

              {market === "spreads" && (
                <>
                  <OddButton
                    label={`${selectedMatch.home_team} ${selectedMatch.bestOdds?.spreadPointHome || ""}`}
                    odds={selectedMatch.bestOdds?.spreadHome}
                  />
                  <OddButton
                    label={`${selectedMatch.away_team} ${selectedMatch.bestOdds?.spreadPointAway || ""}`}
                    odds={selectedMatch.bestOdds?.spreadAway}
                  />
                </>
              )}
            </div>
          </>
        ) : (
          <p style={{ color: "#94a3b8" }}>Ei valittua ottelua.</p>
        )}
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0, fontSize: 30 }}>Päivän parhaat vedot</h2>

        {bestPicks.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>Ei value-kohteita.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {bestPicks.map((match) => (
              <div
                key={match.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 18,
                  padding: 14,
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                <div style={{ fontWeight: 950 }}>
                  {match.home_team} vs {match.away_team}
                </div>
                <div style={{ color: "#86efac", marginTop: 6, fontWeight: 900 }}>
                  Paras kerroin:{" "}
                  {Math.max(match.bestOdds?.home || 0, match.bestOdds?.away || 0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function OddButton({ label, odds }) {
  return (
    <button
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.06)",
        color: "#fff",
        borderRadius: 18,
        padding: 14,
        textAlign: "left",
      }}
    >
      <div style={{ color: "#94a3b8", fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950 }}>
        {odds || "-"}
      </div>
    </button>
  );
}
