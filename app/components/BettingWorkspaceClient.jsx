"use client";

import { useEffect, useMemo, useState } from "react";

const SPORTS = [
  { key: "all", label: "Kaikki" },
  { key: "icehockey", label: "Jääkiekko" },
  { key: "soccer", label: "Jalkapallo" },
  { key: "basketball", label: "Koripallo" },
];

const LEAGUES = {
  all: [
    { key: "all", label: "Kaikki" },
  ],
  icehockey: [
    { key: "all", label: "Kaikki" },
    { key: "NHL", label: "NHL" },
    { key: "Liiga", label: "Liiga 🇫🇮" },
    { key: "SHL", label: "SHL 🇸🇪" },
  ],
  soccer: [
    { key: "all", label: "Kaikki" },
    { key: "Premier League", label: "Premier League" },
    { key: "La Liga", label: "La Liga" },
  ],
  basketball: [
    { key: "all", label: "Kaikki" },
    { key: "NBA", label: "NBA" },
  ],
};

function hasClientOdds(match) {
  return Boolean(
    match?.bestOdds?.home ||
      match?.bestOdds?.away ||
      match?.bestOdds?.draw ||
      match?.bestOdds?.over ||
      match?.bestOdds?.under ||
      match?.bestOdds?.spreadHome ||
      match?.bestOdds?.spreadAway ||
      match?.bookmakers?.length
  );
}

function formatTime(date) {
  try {
    return new Date(date).toLocaleString("fi-FI", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-[#020b2a] p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-5 py-3 text-lg font-bold transition ${
        active
          ? "border-green-500 bg-green-900/40 text-white"
          : "border-white/10 bg-white/5 text-white/90"
      }`}
    >
      {children}
    </button>
  );
}

export default function BettingWorkspaceClient() {
  const [sport, setSport] = useState("icehockey");
  const [league, setLeague] = useState("NHL");

  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);

  const [market, setMarket] = useState("h2h");

  async function loadGames(force = false) {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (sport !== "all") {
        params.set("sport", sport);
      }

      if (league !== "all") {
        params.set("league", league);
      }

      if (force) {
        params.set("t", Date.now().toString());
      }

      const res = await fetch(`/api/odds?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await res.json();

      console.log("ODDS DATA", data);

      const nextMatches = data?.matches || [];

      const filtered = nextMatches.filter((m) => hasClientOdds(m));

      setMatches(filtered);

      if (filtered.length > 0) {
        setSelectedMatch(filtered[0]);
      } else {
        setSelectedMatch(null);
      }
    } catch (err) {
      console.error(err);
      setMatches([]);
      setSelectedMatch(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGames(true);
  }, []);

  useEffect(() => {
    loadGames();
  }, [sport, league]);

  const availableLeagues = useMemo(() => {
    return LEAGUES[sport] || LEAGUES.all;
  }, [sport]);

  function renderMarketButtons() {
    if (!selectedMatch?.bestOdds) {
      return (
        <div className="mt-4 text-gray-400">
          Ei vetomarkkinoita tälle ottelulle.
        </div>
      );
    }

    if (market === "h2h") {
      return (
        <div className="mt-5 grid grid-cols-1 gap-3">
          <button className="rounded-2xl bg-white/5 p-4 text-left">
            <div className="text-sm text-gray-400">
              {selectedMatch.home_team}
            </div>

            <div className="mt-1 text-2xl font-black">
              {selectedMatch.bestOdds.home}
            </div>
          </button>

          {selectedMatch.bestOdds.draw && (
            <button className="rounded-2xl bg-white/5 p-4 text-left">
              <div className="text-sm text-gray-400">Tasapeli</div>

              <div className="mt-1 text-2xl font-black">
                {selectedMatch.bestOdds.draw}
              </div>
            </button>
          )}

          <button className="rounded-2xl bg-white/5 p-4 text-left">
            <div className="text-sm text-gray-400">
              {selectedMatch.away_team}
            </div>

            <div className="mt-1 text-2xl font-black">
              {selectedMatch.bestOdds.away}
            </div>
          </button>
        </div>
      );
    }

    if (market === "totals") {
      return (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="rounded-2xl bg-white/5 p-4 text-left">
            <div className="text-sm text-gray-400">
              Over {selectedMatch.bestOdds.point}
            </div>

            <div className="mt-1 text-2xl font-black">
              {selectedMatch.bestOdds.over}
            </div>
          </button>

          <button className="rounded-2xl bg-white/5 p-4 text-left">
            <div className="text-sm text-gray-400">
              Under {selectedMatch.bestOdds.point}
            </div>

            <div className="mt-1 text-2xl font-black">
              {selectedMatch.bestOdds.under}
            </div>
          </button>
        </div>
      );
    }

    if (market === "spread") {
      return (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="rounded-2xl bg-white/5 p-4 text-left">
            <div className="text-sm text-gray-400">
              {selectedMatch.home_team}{" "}
              {selectedMatch.bestOdds.spreadPointHome}
            </div>

            <div className="mt-1 text-2xl font-black">
              {selectedMatch.bestOdds.spreadHome}
            </div>
          </button>

          <button className="rounded-2xl bg-white/5 p-4 text-left">
            <div className="text-sm text-gray-400">
              {selectedMatch.away_team}{" "}
              {selectedMatch.bestOdds.spreadPointAway}
            </div>

            <div className="mt-1 text-2xl font-black">
              {selectedMatch.bestOdds.spreadAway}
            </div>
          </button>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="min-h-screen bg-[#01081f] p-4 text-white">
      <div className="mx-auto max-w-6xl space-y-5">
        <Card>
          <div className="text-2xl font-black">Laji</div>

          <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
            {SPORTS.map((item) => (
              <Chip
                key={item.key}
                active={sport === item.key}
                onClick={() => {
                  setSport(item.key);
                  setLeague("all");
                }}
              >
                {item.label}
              </Chip>
            ))}
          </div>

          <div className="mt-8 text-2xl font-black">Liiga</div>

          <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
            {availableLeagues.map((item) => (
              <Chip
                key={item.key}
                active={league === item.key}
                onClick={() => setLeague(item.key)}
              >
                {item.label}
              </Chip>
            ))}
          </div>

          <button
            onClick={() => loadGames(true)}
            className="mt-6 rounded-2xl bg-green-600 px-5 py-3 text-lg font-black"
          >
            {loading ? "Päivitetään..." : "Päivitä"}
          </button>
        </Card>

        <Card>
          <div className="text-4xl font-black">Ottelut</div>

          {matches.length === 0 ? (
            <div className="mt-5 text-2xl text-gray-400">
              Ei pelejä ladattuna.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {matches.map((match) => (
                <button
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedMatch?.id === match.id
                      ? "border-green-500 bg-green-900/20"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xl font-black">
                        {match.home_team}
                      </div>

                      <div className="text-gray-400">
                        vs {match.away_team}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {match.bestOdds?.home} / {match.bestOdds?.away}
                      </div>

                      <div className="text-sm text-gray-400">
                        {formatTime(match.commence_time)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="text-4xl font-black">Valitse ottelu</div>

          {selectedMatch ? (
            <>
              <div className="mt-3 text-xl text-gray-300">
                {selectedMatch.home_team} vs {selectedMatch.away_team}
              </div>

              <div className="mt-5 flex gap-3 overflow-x-auto">
                <Chip
                  active={market === "h2h"}
                  onClick={() => setMarket("h2h")}
                >
                  1X2 / ML
                </Chip>

                <Chip
                  active={market === "totals"}
                  onClick={() => setMarket("totals")}
                >
                  Over / Under
                </Chip>

                <Chip
                  active={market === "spread"}
                  onClick={() => setMarket("spread")}
                >
                  Handicap
                </Chip>
              </div>

              {renderMarketButtons()}
            </>
          ) : (
            <div className="mt-5 text-gray-400">
              Ei valittua ottelua.
            </div>
          )}
        </Card>

        <Card>
          <div className="text-4xl font-black">
            Päivän parhaat vedot
          </div>

          {matches.length > 0 ? (
            <div className="mt-5 space-y-3">
              {matches.slice(0, 3).map((match) => (
                <div
                  key={match.id}
                  className="rounded-2xl bg-white/5 p-4"
                >
                  <div className="font-bold">
                    {match.home_team} vs {match.away_team}
                  </div>

                  <div className="mt-2 text-gray-300">
                    Paras kerroin:{" "}
                    {Math.max(
                      match.bestOdds?.home || 0,
                      match.bestOdds?.away || 0
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 text-gray-400">
              Ei value-kohteita.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
