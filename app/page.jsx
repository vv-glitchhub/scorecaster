"use client";

import { useEffect, useMemo, useState } from "react";

const TEXT = {
  fi: {
    title: "SCORECASTER",
    subtitle: "Vedonlyönnin analyysi- ja oddsinäkymä",
    language: "Kieli",
    sportGroup: "Laji",
    league: "Sarja",
    loading: "Ladataan...",
    noGames: "Otteluita ei löytynyt",
    bankrollTitle: "Bankroll",
    bankroll: "€",
    kellyMode: "Kelly",
    stakeSuggestion: "Panos",
    tracker: "Seuranta",
    markWin: "Win",
    markLose: "Lose",
    markVoid: "Void",
    feedback: "Palaute",
    send: "Lähetä",
  },
};

const GROUP_LABELS = {
  "Ice Hockey": "Jääkiekko",
  Basketball: "Koripallo",
  Soccer: "Jalkapallo",
  AmericanFootball: "Jenkkifutis",
};

const LEAGUE_LABELS = {
  icehockey_nhl: "NHL",
  icehockey_liiga: "Liiga",
  basketball_nba: "NBA",
  soccer_epl: "EPL",
};

export default function Page() {
  const [sports, setSports] = useState([]);
  const [group, setGroup] = useState("");
  const [league, setLeague] = useState("");
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);

  const [bankrollInput, setBankrollInput] = useState("1000");
  const bankroll = parseFloat(bankrollInput) || 0;

  const [feedback, setFeedback] = useState("");

  // 🔹 LOAD SPORTS
  useEffect(() => {
    fetch("/api/sports")
      .then((res) => res.json())
      .then((data) => {
        setSports(data.data);
      });
  }, []);

  // 🔹 FILTER GROUPS
  const groups = useMemo(() => {
    return [...new Set(sports.map((s) => s.group))];
  }, [sports]);

  // 🔹 FILTER LEAGUES
  const leagues = useMemo(() => {
    return sports.filter((s) => s.group === group);
  }, [group, sports]);

  // 🔹 LOAD GAMES
  useEffect(() => {
    if (!league) return;

    setLoading(true);

    fetch(`/api/odds?sport=${league}`)
      .then((res) => res.json())
      .then((data) => {
        setGames(data.data || []);
      })
      .finally(() => setLoading(false));
  }, [league]);

  // 🔹 FEEDBACK SEND
  async function sendFeedback() {
    await fetch("/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        message: feedback,
        selectedSportKey: league,
        selectedGroup: group,
        bankroll,
      }),
    });

    setFeedback("");
    alert("Lähetetty ✅");
  }

  return (
    <main style={styles.main}>
      <h1 style={styles.title}>SCORECASTER</h1>

      {/* FILTERS */}
      <div style={styles.filters}>
        <select style={styles.select} onChange={(e) => setGroup(e.target.value)}>
          <option>Laji</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {GROUP_LABELS[g] || g}
            </option>
          ))}
        </select>

        <select style={styles.select} onChange={(e) => setLeague(e.target.value)}>
          <option>Liiga</option>
          {leagues.map((l) => (
            <option key={l.key} value={l.key}>
              {LEAGUE_LABELS[l.key] || l.title}
            </option>
          ))}
        </select>
      </div>

      {/* GAMES */}
      <div style={styles.card}>
        <h2>Ottelut</h2>

        {loading && <p>Ladataan...</p>}

        {games.map((g) => (
          <div key={g.id} style={styles.game}>
            {g.home_team} vs {g.away_team}
          </div>
        ))}
      </div>

      {/* BANKROLL */}
      <div style={styles.card}>
        <h2>Bankroll</h2>
        <input
          style={styles.input}
          value={bankrollInput}
          onChange={(e) => setBankrollInput(e.target.value.replace(",", "."))}
        />
        <div>Tulkittu: {bankroll.toFixed(2)} €</div>
      </div>

      {/* FEEDBACK */}
      <div style={styles.card}>
        <h2>Palaute</h2>
        <textarea
          style={styles.textarea}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <button style={styles.button} onClick={sendFeedback}>
          Lähetä
        </button>
      </div>
    </main>
  );
}

const styles = {
  main: {
    padding: 16,
    background: "#020617",
    color: "white",
    minHeight: "100vh",
  },
  title: {
    fontSize: 36,
    fontWeight: 900,
  },
  filters: {
    display: "grid",
    gap: 10,
    marginBottom: 20,
  },
  select: {
    padding: 12,
    borderRadius: 12,
    background: "#0f172a",
    color: "white",
  },
  card: {
    background: "#0f172a",
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  game: {
    padding: 10,
    background: "#1e293b",
    borderRadius: 10,
    marginTop: 8,
  },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    background: "#020617",
    color: "white",
  },
  textarea: {
    width: "100%",
    height: 100,
    background: "#020617",
    color: "white",
    borderRadius: 10,
  },
  button: {
    marginTop: 10,
    padding: 10,
    background: "#22c55e",
    borderRadius: 10,
    border: "none",
  },
};
