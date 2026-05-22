"use client";

import { useEffect, useMemo, useState } from "react";
import { getLeagueOptions, getSportOptions } from "@/lib/sports-config";

function card(extra = {}) {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 24,
    padding: 18,
    background: "rgba(2,6,23,0.78)",
    ...extra,
  };
}

function pill(active) {
  return {
    border: active
      ? "1px solid rgba(34,197,94,0.75)"
      : "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(34,197,94,0.20)" : "rgba(255,255,255,0.07)",
    color: "#fff",
    borderRadius: 999,
    padding: "12px 16px",
    fontWeight: 950,
    whiteSpace: "nowrap",
    cursor: "pointer",
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
      match?.bestOdds?.spreadHome ||
      match?.bestOdds?.spreadAway
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

function bestNumber(...values) {
  return Math.max(...values.map((value) => Number(value || 0))).toFixed(2);
}

export default function BettingWorkspaceClient() {
  const [sport, setSport] = useState("all");
  const [league, setLeague] = useState("ALL");
  const [market, setMarket] = useState("h2h");
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sourceInfo, setSourceInfo] = useState("");

  const sports = useMemo(() => getSportOptions(), []);
  const leagues = useMemo(() => getLeagueOptions(sport), [sport]);

  async function loadGames(force = false) {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      params.set("sport", sport);
      params.set("league", league);

      if (force) {
        params.set("force", "1");
      }

      const res = await fetch(`/api/odds?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await res.json();

      const next = Array.isArray(data?.matches)
        ? data.matches.filter(hasOdds)
        : [];

      setMatches(next);
      setSelectedMatch(next[0] || null);

      setSourceInfo(
        data?.source === "live"
          ? `Live-data · ${next.length} ottelua${data?.cached ? " · cache" : ""}`
          : data?.reason || "Ei dataa"
      );
    } catch (error) {
      console.error(error);
      setMatches([]);
      setSelectedMatch(null);
      setSourceInfo(error?.message || "Haku epäonnistui");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGames(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bestPicks = useMemo(() => {
    return [...matches]
      .sort((a, b) => {
        const aBest = Math.max(Number(a.bestOdds?.home || 0), Number(a.bestOdds?.away || 0));
        const bBest = Math.max(Number(b.bestOdds?.home || 0), Number(b.bestOdds?.away || 0));
        return bBest - aBest;
      })
      .slice(0, 5);
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
        <h1 style={{ margin: 0, fontSize: "clamp(42px, 12vw, 72px)", lineHeight: 0.95 }}>
          Scorecaster
        </h1>

        <p style={{ margin: "12px 0 0", color: "#94a3b8", fontWeight: 900 }}>
          Betting Intelligence Platform
        </p>

        <p style={{ margin: "12px 0 0", color: "#64748b", fontWeight: 800 }}>
          {sourceInfo || "Multi-sport odds, value picks ja live-data."}
        </p>

        <button
          onClick={() => loadGames(true)}
          disabled={loading}
          style={{
            marginTop: 18,
            width: "100%",
            border: "1px solid rgba(34,197,94,0.75)",
            background: "rgba(34,197,94,0.18)",
            color: "#fff",
            borderRadius: 18,
            padding: 16,
            fontWeight: 950,
            fontSize: 17,
          }}
        >
          {loading ? "Päivitetään..." : "Päivitä ottelut"}
        </button>
      </section>

      <section style={card()}>
        <div style={{ color: "#94a3b8", fontWeight: 950, marginBottom: 8 }}>
          Laji
        </div>

        <div style={row()}>
          {sports.map((item) => (
            <button
              key={item.id}
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

        <div style={{ color: "#94a3b8", fontWeight: 950, margin: "18px 0 8px" }}>
          Liiga
        </div>

        <div style={row()}>
          {leagues.map((item) => (
            <button
              key={item.id}
              onClick={() => setLeague(item.id)}
              style={pill(league === item.id)}
            >
              {item.labelFi}
            </button>
          ))}
        </div>
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0, fontSize: 34 }}>Ottelut</h2>

        {matches.length === 0 ? (
          <p style={{ color: "#94a3b8", fontWeight: 850, lineHeight: 1.5 }}>
            Ei pelejä ladattuna. Valitse laji/liiga ja paina Päivitä.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
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
                  borderRadius: 20,
                  padding: 16,
                }}
              >
                <div style={{ fontWeight: 950, fontSize: 20 }}>
                  {match.home_team} vs {match.away_team}
                </div>

                <div style={{ color: "#94a3b8", marginTop: 8, fontWeight: 800 }}>
                  {match.sport_title || match.sport_key} · {formatTime(match.commence_time)}
                </div>

                <div style={{ color: "#86efac", marginTop: 10, fontWeight: 950, fontSize: 20 }}>
                  {match.bestOdds?.home || "-"} / {match.bestOdds?.away || "-"}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0, fontSize: 34 }}>Valitse ottelu</h2>

        {selectedMatch ? (
          <>
            <div style={{ color: "#cbd5e1", fontWeight: 950, fontSize: 18 }}>
              {selectedMatch.home_team} vs {selectedMatch.away_team}
            </div>

            <div style={{ ...row(), marginTop: 16 }}>
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

            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {market === "h2h" && (
                <>
                  <OddButton label={selectedMatch.home_team} odds={selectedMatch.bestOdds?.home} book={selectedMatch.bestOdds?.books?.home} />
                  {selectedMatch.bestOdds?.draw ? <OddButton label="Tasapeli" odds={selectedMatch.bestOdds?.draw} book={selectedMatch.bestOdds?.books?.draw} /> : null}
                  <OddButton label={selectedMatch.away_team} odds={selectedMatch.bestOdds?.away} book={selectedMatch.bestOdds?.books?.away} />
                </>
              )}

              {market === "totals" && (
                <>
                  <OddButton label={`Over ${selectedMatch.bestOdds?.point || ""}`} odds={selectedMatch.bestOdds?.over} book={selectedMatch.bestOdds?.books?.over} />
                  <OddButton label={`Under ${selectedMatch.bestOdds?.point || ""}`} odds={selectedMatch.bestOdds?.under} book={selectedMatch.bestOdds?.books?.under} />
                </>
              )}

              {market === "spreads" && (
                <>
                  <OddButton label={`${selectedMatch.home_team} ${selectedMatch.bestOdds?.spreadPointHome || ""}`} odds={selectedMatch.bestOdds?.spreadHome} book={selectedMatch.bestOdds?.books?.spreadHome} />
                  <OddButton label={`${selectedMatch.away_team} ${selectedMatch.bestOdds?.spreadPointAway || ""}`} odds={selectedMatch.bestOdds?.spreadAway} book={selectedMatch.bestOdds?.books?.spreadAway} />
                </>
              )}
            </div>
          </>
        ) : (
          <p style={{ color: "#94a3b8" }}>Ei valittua ottelua.</p>
        )}
      </section>

      <section style={card()}>
        <h2 style={{ marginTop: 0, fontSize: 34 }}>Päivän parhaat vedot</h2>

        {bestPicks.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>Ei value-kohteita.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {bestPicks.map((match) => (
              <div
                key={match.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 20,
                  padding: 16,
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                <div style={{ fontWeight: 950, fontSize: 18 }}>
                  {match.home_team} vs {match.away_team}
                </div>

                <div style={{ color: "#94a3b8", marginTop: 6 }}>
                  {match.sport_title || match.sport_key}
                </div>

                <div style={{ color: "#86efac", marginTop: 8, fontWeight: 950 }}>
                  Paras kerroin: {bestNumber(match.bestOdds?.home, match.bestOdds?.away, match.bestOdds?.draw)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function OddButton({ label, odds, book }) {
  return (
    <button
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.06)",
        color: "#fff",
        borderRadius: 20,
        padding: 16,
        textAlign: "left",
      }}
    >
      <div style={{ color: "#94a3b8", fontWeight: 900 }}>{label}</div>

      <div style={{ marginTop: 4, fontSize: 34, fontWeight: 950 }}>
        {odds || "-"}
      </div>

      {book ? (
        <div style={{ marginTop: 4, color: "#64748b", fontWeight: 800 }}>
          {book}
        </div>
      ) : null}
    </button>
  );
}
