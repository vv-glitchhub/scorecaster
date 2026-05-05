"use client";

import { useState } from "react";

export default function BettingWorkspaceClient() {
  const [matches, setMatches] = useState([]);
  const [league, setLeague] = useState("ALL");
  const [loading, setLoading] = useState(false);

  const fetchGames = async () => {
    setLoading(true);

    try {
      const res = await fetch(`/api/odds?league=${league}`);
      const data = await res.json();

      setMatches(data.matches || []);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: "20px", color: "white" }}>
      <h1>Vedonlyöntityötila</h1>

      {/* SELECTORIT */}
      <div style={{ marginBottom: "20px" }}>
        <select
          value={league}
          onChange={(e) => setLeague(e.target.value)}
          style={{ padding: "10px", marginRight: "10px" }}
        >
          <option value="ALL">All</option>
          <option value="NHL">NHL</option>
          <option value="NBA">NBA</option>
          <option value="FIN_LIIGA">Liiga 🇫🇮</option>
          <option value="FIN_VEIKKAUSLIIGA">Veikkausliiga 🇫🇮</option>
        </select>

        <button onClick={fetchGames} style={{ padding: "10px 20px" }}>
          {loading ? "Ladataan..." : "Hae pelit"}
        </button>
      </div>

      {/* LISTA */}
      <div>
        {matches.length === 0 && <p>Ei pelejä</p>}

        {matches.map((m) => (
          <div
            key={m.id}
            style={{
              border: "1px solid #333",
              padding: "15px",
              marginBottom: "10px",
              borderRadius: "10px",
            }}
          >
            <h3>
              {m.home_team} vs {m.away_team}
            </h3>

            <p>{m.sport_title}</p>

            {m.bestOdds?.home && (
              <p>
                Koti: {m.bestOdds.home} | Vieras: {m.bestOdds.away}
              </p>
            )}

            {m.fixturesOnly && (
              <p style={{ color: "orange" }}>
                Ei odds-dataa (Suomen liiga)
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
