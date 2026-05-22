"use client";

import { useEffect, useMemo, useState } from "react";

const SPORTS = [
  { id: "all", label: "Kaikki" },
  { id: "icehockey", label: "Jääkiekko" },
  { id: "soccer", label: "Jalkapallo" },
  { id: "basketball", label: "Koripallo" },
  { id: "americanfootball", label: "NFL / Jenkkifutis" },
  { id: "baseball", label: "Baseball" },
  { id: "tennis", label: "Tennis" },
  { id: "mma", label: "UFC / MMA" },
  { id: "golf", label: "Golf" },
];

const LEAGUES = [
  { id: "all", label: "Kaikki" },
  { id: "NHL", label: "NHL" },
  { id: "Liiga", label: "Liiga 🇫🇮" },
  { id: "SHL", label: "SHL 🇸🇪" },
  { id: "Premier League", label: "Premier League" },
  { id: "La Liga", label: "La Liga 🇪🇸" },
  { id: "Serie A", label: "Serie A 🇮🇹" },
  { id: "Bundesliga", label: "Bundesliga 🇩🇪" },
  { id: "Ligue 1", label: "Ligue 1 🇫🇷" },
  { id: "NBA", label: "NBA" },
  { id: "NFL", label: "NFL" },
  { id: "MLB", label: "MLB" },
  { id: "ATP", label: "ATP Tennis" },
  { id: "UFC", label: "UFC" },
];

function getSportCategory(sportKey = "") {
  const key = sportKey.toLowerCase();

  if (key.includes("icehockey")) return "icehockey";
  if (key.includes("soccer")) return "soccer";
  if (key.includes("basketball")) return "basketball";
  if (key.includes("americanfootball")) return "americanfootball";
  if (key.includes("baseball")) return "baseball";
  if (key.includes("tennis")) return "tennis";
  if (key.includes("mma")) return "mma";
  if (key.includes("golf")) return "golf";

  return "other";
}

function getBestOdds(bookmakers = []) {
  let home = null;
  let draw = null;
  let away = null;

  bookmakers.forEach((book) => {
    book?.markets?.forEach((market) => {
      if (market.key !== "h2h") return;

      market.outcomes?.forEach((outcome, index) => {
        if (index === 0) {
          if (!home || outcome.price > home) {
            home = outcome.price;
          }
        }

        if (index === 1) {
          if (!away || outcome.price > away) {
            away = outcome.price;
          }
        }

        if (index === 2) {
          if (!draw || outcome.price > draw) {
            draw = outcome.price;
          }
        }
      });
    });
  });

  return {
    home,
    draw,
    away,
  };
}

export default function BettingPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedSport, setSelectedSport] = useState("all");
  const [selectedLeague, setSelectedLeague] = useState("all");

  const [selectedMatch, setSelectedMatch] = useState(null);

  async function loadOdds() {
    try {
      setLoading(true);

      const res = await fetch("/api/odds?force=1", {
        cache: "no-store",
      });

      const data = await res.json();

      const nextMatches = Array.isArray(data?.matches)
        ? data.matches
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setMatches(nextMatches);

      if (nextMatches.length > 0) {
        setSelectedMatch(nextMatches[0]);
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
    loadOdds();
  }, []);

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      const sportMatch =
        selectedSport === "all"
          ? true
          : getSportCategory(match?.sport_key) === selectedSport;

      const leagueMatch =
        selectedLeague === "all"
          ? true
          : match?.sport_title?.includes(selectedLeague);

      return sportMatch && leagueMatch;
    });
  }, [matches, selectedSport, selectedLeague]);

  const topPicks = useMemo(() => {
    return filteredMatches.slice(0, 5);
  }, [filteredMatches]);

  return (
    <main
      style={{
        background: "#020b2d",
        minHeight: "100vh",
        color: "white",
        padding: 16,
        paddingBottom: 120,
      }}
    >
      <section
        style={{
          background: "#040d35",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 28,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <h1
          style={{
            fontSize: 58,
            fontWeight: 900,
            lineHeight: 1,
            marginBottom: 12,
          }}
        >
          Scorecaster
        </h1>

        <div
          style={{
            color: "#aeb7d0",
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 24,
          }}
        >
          Betting Intelligence Platform
        </div>

        <div
          style={{
            color: "#93a0c3",
            fontSize: 18,
            marginBottom: 24,
          }}
        >
          Live-data • {filteredMatches.length} ottelua
        </div>

        <button
          onClick={loadOdds}
          disabled={loading}
          style={{
            width: "100%",
            height: 92,
            borderRadius: 28,
            border: "2px solid #00d26a",
            background: "#063c2c",
            color: "white",
            fontSize: 28,
            fontWeight: 800,
          }}
        >
          {loading ? "Ladataan..." : "Päivitä ottelut"}
        </button>
      </section>

      <section
        style={{
          background: "#040d35",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 28,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontSize: 28,
            fontWeight: 800,
            marginBottom: 18,
          }}
        >
          Laji
        </h2>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          {SPORTS.map((sport) => (
            <button
              key={sport.id}
              onClick={() => setSelectedSport(sport.id)}
              style={{
                padding: "20px 28px",
                borderRadius: 24,
                border:
                  selectedSport === sport.id
                    ? "2px solid #00d26a"
                    : "2px solid rgba(255,255,255,0.08)",
                background:
                  selectedSport === sport.id
                    ? "#063c2c"
                    : "#151c3d",
                color: "white",
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              {sport.label}
            </button>
          ))}
        </div>

        <h2
          style={{
            fontSize: 28,
            fontWeight: 800,
            marginTop: 40,
            marginBottom: 18,
          }}
        >
          Liiga
        </h2>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          {LEAGUES.map((league) => (
            <button
              key={league.id}
              onClick={() => setSelectedLeague(league.id)}
              style={{
                padding: "20px 28px",
                borderRadius: 24,
                border:
                  selectedLeague === league.id
                    ? "2px solid #00d26a"
                    : "2px solid rgba(255,255,255,0.08)",
                background:
                  selectedLeague === league.id
                    ? "#063c2c"
                    : "#151c3d",
                color: "white",
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              {league.label}
            </button>
          ))}
        </div>
      </section>

      <section
        style={{
          background: "#040d35",
          borderRadius: 28,
          padding: 24,
          marginBottom: 20,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h2
          style={{
            fontSize: 76,
            lineHeight: 0.95,
            fontWeight: 900,
            marginBottom: 32,
          }}
        >
          Ottelut
        </h2>

        {filteredMatches.length === 0 && (
          <div
            style={{
              color: "#aeb7d0",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            Ei otteluita löytynyt.
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {filteredMatches.map((match) => {
            const odds = getBestOdds(match.bookmakers);

            return (
              <button
                key={match.id}
                onClick={() => setSelectedMatch(match)}
                style={{
                  textAlign: "left",
                  background:
                    selectedMatch?.id === match.id
                      ? "#063c2c"
                      : "#151c3d",
                  border:
                    selectedMatch?.id === match.id
                      ? "2px solid #00d26a"
                      : "2px solid rgba(255,255,255,0.08)",
                  borderRadius: 28,
                  padding: 28,
                  color: "white",
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    marginBottom: 12,
                  }}
                >
                  {match.home_team} vs {match.away_team}
                </div>

                <div
                  style={{
                    color: "#93a0c3",
                    fontSize: 18,
                    marginBottom: 18,
                  }}
                >
                  {match.sport_title} •{" "}
                  {new Date(match.commence_time).toLocaleString("fi-FI")}
                </div>

                <div
                  style={{
                    color: "#7ef0a8",
                    fontSize: 24,
                    fontWeight: 900,
                  }}
                >
                  {odds.home ?? "-"} / {odds.away ?? "-"}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {selectedMatch && (
        <section
          style={{
            background: "#040d35",
            borderRadius: 28,
            padding: 24,
            marginBottom: 20,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h2
            style={{
              fontSize: 54,
              lineHeight: 1,
              fontWeight: 900,
              marginBottom: 28,
            }}
          >
            Valitse ottelu
          </h2>

          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              marginBottom: 24,
            }}
          >
            {selectedMatch.home_team} vs {selectedMatch.away_team}
          </div>

          <div
            style={{
              display: "grid",
              gap: 18,
            }}
          >
            {(() => {
              const odds = getBestOdds(selectedMatch.bookmakers);

              return (
                <>
                  <div
                    style={{
                      background: "#151c3d",
                      borderRadius: 24,
                      padding: 24,
                    }}
                  >
                    <div
                      style={{
                        color: "#93a0c3",
                        fontSize: 18,
                        marginBottom: 10,
                      }}
                    >
                      {selectedMatch.home_team}
                    </div>

                    <div
                      style={{
                        fontSize: 54,
                        fontWeight: 900,
                      }}
                    >
                      {odds.home ?? "-"}
                    </div>
                  </div>

                  {odds.draw && (
                    <div
                      style={{
                        background: "#151c3d",
                        borderRadius: 24,
                        padding: 24,
                      }}
                    >
                      <div
                        style={{
                          color: "#93a0c3",
                          fontSize: 18,
                          marginBottom: 10,
                        }}
                      >
                        Tasapeli
                      </div>

                      <div
                        style={{
                          fontSize: 54,
                          fontWeight: 900,
                        }}
                      >
                        {odds.draw}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      background: "#151c3d",
                      borderRadius: 24,
                      padding: 24,
                    }}
                  >
                    <div
                      style={{
                        color: "#93a0c3",
                        fontSize: 18,
                        marginBottom: 10,
                      }}
                    >
                      {selectedMatch.away_team}
                    </div>

                    <div
                      style={{
                        fontSize: 54,
                        fontWeight: 900,
                      }}
                    >
                      {odds.away ?? "-"}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </section>
      )}

      <section
        style={{
          background: "#040d35",
          borderRadius: 28,
          padding: 24,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h2
          style={{
            fontSize: 76,
            lineHeight: 0.95,
            fontWeight: 900,
            marginBottom: 28,
          }}
        >
          Päivän parhaat vedot
        </h2>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {topPicks.map((match) => {
            const odds = getBestOdds(match.bookmakers);

            const best =
              Math.max(
                odds.home || 0,
                odds.draw || 0,
                odds.away || 0
              ) || "-";

            return (
              <div
                key={match.id}
                style={{
                  background: "#151c3d",
                  borderRadius: 24,
                  padding: 24,
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    marginBottom: 12,
                  }}
                >
                  {match.home_team} vs {match.away_team}
                </div>

                <div
                  style={{
                    color: "#7ef0a8",
                    fontSize: 22,
                    fontWeight: 900,
                  }}
                >
                  Paras kerroin: {best}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
