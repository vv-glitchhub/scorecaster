"use client";

import { useEffect, useMemo, useState } from "react";

const SPORTS = [
  { key: "all", label: "Kaikki" },

  { key: "icehockey", label: "Jääkiekko" },

  { key: "soccer", label: "Jalkapallo" },

  { key: "basketball", label: "Koripallo" },

  { key: "football", label: "NFL / Jenkkifutis" },

  { key: "baseball", label: "Baseball" },

  { key: "tennis", label: "Tennis" },

  { key: "mma", label: "UFC / MMA" },

  { key: "golf", label: "Golf" },
];

const LEAGUES = [
  { key: "all", label: "Kaikki" },

  { key: "icehockey_nhl", label: "NHL" },

  { key: "icehockey_liiga", label: "Liiga 🇫🇮" },

  { key: "icehockey_shl", label: "SHL 🇸🇪" },

  { key: "icehockey_del", label: "DEL 🇩🇪" },

  { key: "soccer_epl", label: "Premier League 🇬🇧" },

  { key: "soccer_spain_la_liga", label: "La Liga 🇪🇸" },

  { key: "soccer_italy_serie_a", label: "Serie A 🇮🇹" },

  { key: "soccer_germany_bundesliga", label: "Bundesliga 🇩🇪" },

  { key: "soccer_france_ligue_one", label: "Ligue 1 🇫🇷" },

  { key: "basketball_nba", label: "NBA" },

  { key: "americanfootball_nfl", label: "NFL" },

  { key: "baseball_mlb", label: "MLB" },

  { key: "tennis_atp_french_open", label: "ATP Tennis" },

  { key: "mma_mixed_martial_arts", label: "UFC" },
];

export default function BettingPage() {
  const [matches, setMatches] = useState([]);

  const [loading, setLoading] = useState(false);

  const [selectedSport, setSelectedSport] =
    useState("all");

  const [selectedLeague, setSelectedLeague] =
    useState("all");

  const [selectedMatch, setSelectedMatch] =
    useState(null);

  async function loadOdds() {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      params.set("sport", selectedSport);

      params.set("league", selectedLeague);

      params.set("force", "1");

      const res = await fetch(
        `/api/odds?${params.toString()}`
      );

      const data = await res.json();

      console.log(data);

      if (Array.isArray(data?.data)) {
        setMatches(data.data);
      } else {
        setMatches([]);
      }
    } catch (err) {
      console.error(err);

      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOdds();
  }, [selectedSport, selectedLeague]);

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      if (!match) return false;

      if (
        selectedLeague !== "all" &&
        match.sport_key !== selectedLeague
      ) {
        return false;
      }

      if (selectedSport === "icehockey") {
        return match.sport_key?.includes(
          "icehockey"
        );
      }

      if (selectedSport === "soccer") {
        return match.sport_key?.includes("soccer");
      }

      if (selectedSport === "basketball") {
        return match.sport_key?.includes(
          "basketball"
        );
      }

      if (selectedSport === "football") {
        return match.sport_key?.includes(
          "americanfootball"
        );
      }

      if (selectedSport === "baseball") {
        return match.sport_key?.includes(
          "baseball"
        );
      }

      if (selectedSport === "tennis") {
        return match.sport_key?.includes("tennis");
      }

      if (selectedSport === "mma") {
        return match.sport_key?.includes("mma");
      }

      if (selectedSport === "golf") {
        return match.sport_key?.includes("golf");
      }

      return true;
    });
  }, [
    matches,
    selectedSport,
    selectedLeague,
  ]);

  function getMarket(match, key = "h2h") {
    return (
      match?.bookmakers?.[0]?.markets?.find(
        (m) => m.key === key
      ) || null
    );
  }

  function getOutcomes(match) {
    return getMarket(match)?.outcomes || [];
  }

  function getBestOdds(match) {
    const outcomes = getOutcomes(match);

    if (!outcomes.length) return "-";

    return outcomes
      .map((o) => o.price)
      .join(" / ");
  }

  return (
    <div style={page()}>
      <div style={hero()}>
        <div style={title()}>
          Scorecaster
        </div>

        <div style={subtitle()}>
          Betting Intelligence Platform
        </div>

        <div style={liveText()}>
          Live-data • {filteredMatches.length} ottelua
        </div>

        <button
          style={refreshButton()}
          onClick={loadOdds}
        >
          {loading
            ? "Päivitetään..."
            : "Päivitä ottelut"}
        </button>
      </div>

      <section style={card()}>
        <div style={sectionTitle()}>
          Laji
        </div>

        <div style={row()}>
          {SPORTS.map((sport) => (
            <button
              key={sport.key}
              style={pill(
                selectedSport === sport.key
              )}
              onClick={() => {
                setSelectedSport(sport.key);

                setSelectedLeague("all");
              }}
            >
              {sport.label}
            </button>
          ))}
        </div>

        <div
          style={{
            ...sectionTitle(),
            marginTop: 30,
          }}
        >
          Liiga
        </div>

        <div style={row()}>
          {LEAGUES.map((league) => (
            <button
              key={league.key}
              style={pill(
                selectedLeague === league.key
              )}
              onClick={() =>
                setSelectedLeague(league.key)
              }
            >
              {league.label}
            </button>
          ))}
        </div>
      </section>

      <section style={card()}>
        <div style={bigTitle()}>
          Ottelut
        </div>

        {filteredMatches.length === 0 && (
          <div style={emptyState()}>
            Ei otteluita löytynyt.
          </div>
        )}

        <div style={matchGrid()}>
          {filteredMatches.map((match) => (
            <div
              key={match.id}
              style={{
                ...matchCard(),
                border:
                  selectedMatch?.id === match.id
                    ? "1px solid rgba(34,197,94,0.7)"
                    : "1px solid rgba(255,255,255,0.08)",
              }}
              onClick={() =>
                setSelectedMatch(match)
              }
            >
              <div style={matchTitle()}>
                {match.home_team} vs{" "}
                {match.away_team}
              </div>

              <div style={matchMeta()}>
                {match.sport_title} •{" "}
                {new Date(
                  match.commence_time
                ).toLocaleString("fi-FI")}
              </div>

              <div style={odds()}>
                {getBestOdds(match)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {selectedMatch && (
        <section style={card()}>
          <div style={bigTitle()}>
            Valitse ottelu
          </div>

          <div style={selectedMatchTitle()}>
            {selectedMatch.home_team} vs{" "}
            {selectedMatch.away_team}
          </div>

          <div style={marketGrid()}>
            {getOutcomes(selectedMatch).map(
              (outcome) => (
                <div
                  key={outcome.name}
                  style={marketCard()}
                >
                  <div style={marketName()}>
                    {outcome.name}
                  </div>

                  <div style={marketPrice()}>
                    {outcome.price}
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      )}

      <section style={card()}>
        <div style={bigTitle()}>
          Päivän parhaat vedot
        </div>

        {filteredMatches
          .slice(0, 5)
          .map((match) => (
            <div
              key={match.id}
              style={topPick()}
            >
              <div style={topPickTitle()}>
                {match.home_team} vs{" "}
                {match.away_team}
              </div>

              <div style={topPickOdds()}>
                Paras kerroin:{" "}
                {getBestOdds(match)}
              </div>
            </div>
          ))}
      </section>
    </div>
  );
}

function page() {
  return {
    minHeight: "100vh",

    background:
      "linear-gradient(to bottom, #020617, #001133)",

    padding: 16,

    color: "#fff",

    paddingBottom: 120,
  };
}

function hero() {
  return {
    background: "rgba(0,0,0,0.25)",

    border: "1px solid rgba(255,255,255,0.08)",

    borderRadius: 28,

    padding: 28,

    marginBottom: 20,
  };
}

function title() {
  return {
    fontSize: 64,

    fontWeight: 900,

    lineHeight: 1,
  };
}

function subtitle() {
  return {
    color: "#94a3b8",

    fontWeight: 700,

    fontSize: 20,

    marginTop: 12,
  };
}

function liveText() {
  return {
    marginTop: 18,

    color: "#94a3b8",

    fontWeight: 700,

    fontSize: 16,
  };
}

function refreshButton() {
  return {
    marginTop: 24,

    width: "100%",

    background: "rgba(34,197,94,0.2)",

    border: "1px solid rgba(34,197,94,0.8)",

    color: "#fff",

    borderRadius: 24,

    height: 72,

    fontSize: 28,

    fontWeight: 900,
  };
}

function card() {
  return {
    background: "rgba(0,0,0,0.25)",

    border: "1px solid rgba(255,255,255,0.08)",

    borderRadius: 28,

    padding: 24,

    marginBottom: 20,
  };
}

function sectionTitle() {
  return {
    fontSize: 24,

    fontWeight: 800,

    marginBottom: 16,
  };
}

function row() {
  return {
    display: "flex",

    gap: 12,

    flexWrap: "wrap",
  };
}

function pill(active) {
  return {
    border: active
      ? "1px solid rgba(34,197,94,0.8)"
      : "1px solid rgba(255,255,255,0.12)",

    background: active
      ? "rgba(34,197,94,0.20)"
      : "rgba(255,255,255,0.07)",

    color: "#fff",

    borderRadius: 999,

    padding: "14px 22px",

    fontWeight: 800,

    fontSize: 16,

    whiteSpace: "nowrap",

    minHeight: 54,
  };
}

function bigTitle() {
  return {
    fontSize: 72,

    fontWeight: 900,

    marginBottom: 24,

    lineHeight: 1,
  };
}

function emptyState() {
  return {
    color: "#94a3b8",

    fontSize: 18,

    fontWeight: 700,
  };
}

function matchGrid() {
  return {
    display: "grid",

    gap: 18,
  };
}

function matchCard() {
  return {
    background: "rgba(255,255,255,0.05)",

    borderRadius: 24,

    padding: 22,
  };
}

function matchTitle() {
  return {
    fontSize: 22,

    fontWeight: 900,

    lineHeight: 1.3,
  };
}

function matchMeta() {
  return {
    marginTop: 12,

    color: "#94a3b8",

    fontSize: 16,

    fontWeight: 700,
  };
}

function odds() {
  return {
    marginTop: 18,

    color: "#86efac",

    fontSize: 28,

    fontWeight: 900,
  };
}

function selectedMatchTitle() {
  return {
    fontSize: 28,

    fontWeight: 900,

    marginBottom: 24,
  };
}

function marketGrid() {
  return {
    display: "grid",

    gap: 16,
  };
}

function marketCard() {
  return {
    background: "rgba(255,255,255,0.05)",

    borderRadius: 24,

    padding: 24,
  };
}

function marketName() {
  return {
    color: "#94a3b8",

    fontWeight: 700,

    fontSize: 18,
  };
}

function marketPrice() {
  return {
    marginTop: 12,

    fontSize: 52,

    fontWeight: 900,
  };
}

function topPick() {
  return {
    background: "rgba(255,255,255,0.05)",

    borderRadius: 24,

    padding: 22,

    marginBottom: 16,
  };
}

function topPickTitle() {
  return {
    fontSize: 20,

    fontWeight: 900,
  };
}

function topPickOdds() {
  return {
    marginTop: 14,

    color: "#86efac",

    fontWeight: 900,

    fontSize: 20,
  };
}
