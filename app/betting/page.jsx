"use client";

import { useEffect, useMemo, useState } from "react";

const SPORTS = [
  {
    key: "all",
    label: "Kaikki",
  },

  {
    key: "icehockey",
    label: "Jääkiekko",
  },

  {
    key: "soccer",
    label: "Jalkapallo",
  },

  {
    key: "basketball",
    label: "Koripallo",
  },
];

const LEAGUES = [
  {
    key: "all",
    label: "Kaikki",
  },

  {
    key: "icehockey_nhl",
    label: "NHL",
  },

  {
    key: "icehockey_liiga",
    label: "Liiga 🇫🇮",
  },

  {
    key: "icehockey_shl",
    label: "SHL 🇸🇪",
  },

  {
    key: "soccer_italy_serie_a",
    label: "Serie A",
  },

  {
    key: "soccer_epl",
    label: "Premier League",
  },

  {
    key: "basketball_nba",
    label: "NBA",
  },
];

export default function BettingPage() {
  const [matches, setMatches] = useState([]);

  const [loading, setLoading] = useState(false);

  const [selectedSport, setSelectedSport] = useState("all");

  const [selectedLeague, setSelectedLeague] = useState("all");

  const [selectedMatch, setSelectedMatch] = useState(null);

  async function loadOdds() {
    try {
      setLoading(true);

      const res = await fetch("/api/odds");

      const data = await res.json();

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
  }, []);

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
        return match.sport_key?.includes("icehockey");
      }

      if (selectedSport === "soccer") {
        return match.sport_key?.includes("soccer");
      }

      if (selectedSport === "basketball") {
        return match.sport_key?.includes("basketball");
      }

      return true;
    });
  }, [matches, selectedSport, selectedLeague]);

  function getH2HMarket(match) {
    return match?.bookmakers?.[0]?.markets?.find(
      (m) => m.key === "h2h"
    );
  }

  function getOutcomes(match) {
    return getH2HMarket(match)?.outcomes || [];
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
        <h1 style={title()}>Scorecaster</h1>

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
          {loading ? "Päivitetään..." : "Päivitä ottelut"}
        </button>
      </div>

      <section style={card()}>
        <div style={sectionTitle()}>
          Laji
        </div>

        <div
          style={{
            ...row(),
            maxWidth: "100%",
          }}
        >
          {SPORTS.map((sport) => (
            <button
              key={sport.key}
              style={pill(selectedSport === sport.key)}
              onClick={() => setSelectedSport(sport.key)}
            >
              {sport.label}
            </button>
          ))}
        </div>

        <div
          style={{
            ...sectionTitle(),
            marginTop: 24,
          }}
        >
          Liiga
        </div>

        <div
          style={{
            ...row(),
            maxWidth: "100%",
          }}
        >
          {LEAGUES.map((league) => (
            <button
              key={league.key}
              style={pill(selectedLeague === league.key)}
              onClick={() => setSelectedLeague(league.key)}
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
              onClick={() => setSelectedMatch(match)}
            >
              <div style={matchTitle()}>
                {match.home_team} vs {match.away_team}
              </div>

              <div style={matchMeta()}>
                {match.sport_title} •{" "}
                {new Date(
                  match.commence_time
                ).toLocaleDateString("fi-FI")}
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
            {getOutcomes(selectedMatch).map((outcome) => (
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
            ))}
          </div>
        </section>
      )}

      <section style={card()}>
        <div style={bigTitle()}>
          Päivän parhaat vedot
        </div>

        {filteredMatches.slice(0, 5).map((match) => (
          <div
            key={match.id}
            style={topPick()}
          >
            <div style={topPickTitle()}>
              {match.home_team} vs{" "}
              {match.away_team}
            </div>

            <div style={topPickOdds()}>
              Paras kerroin: {getBestOdds(match)}
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

    marginBottom: 6,
  };
}

function subtitle() {
  return {
    color: "#94a3b8",

    fontWeight: 700,

    fontSize: 20,
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

    marginBottom: 14,
  };
}

function row() {
  return {
    display: "flex",

    gap: 10,

    flexWrap: "wrap",

    paddingBottom: 8,
  };
}

function pill(active) {
  return {
    border: active
      ? "1px solid rgba(34,197,94,0.75)"
      : "1px solid rgba(255,255,255,0.14)",

    background: active
      ? "rgba(34,197,94,0.20)"
      : "rgba(255,255,255,0.07)",

    color: "#fff",

    borderRadius: 999,

    padding: "12px 18px",

    fontWeight: 900,

    whiteSpace: "nowrap",

    cursor: "pointer",

    fontSize: 15,

    minHeight: 48,

    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    flexShrink: 0,
  };
}

function bigTitle() {
  return {
    fontSize: 56,

    fontWeight: 900,

    marginBottom: 24,
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

    cursor: "pointer",
  };
}

function matchTitle() {
  return {
    fontSize: 22,

    fontWeight: 900,

    lineHeight: 1.25,
  };
}

function matchMeta() {
  return {
    marginTop: 12,

    color: "#94a3b8",

    fontSize: 18,

    fontWeight: 700,
  };
}

function odds() {
  return {
    marginTop: 18,

    color: "#86efac",

    fontSize: 24,

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

    gap: 18,
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
