"use client";

import { useEffect, useState } from "react";

export default function Page() {
  const [games, setGames] = useState([]);
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOdds() {
      try {
        const res = await fetch("/api/odds?sport=icehockey_nhl");
        if (!res.ok) {
          throw new Error("Failed to fetch odds");
        }

        const result = await res.json();
        setGames(result.data || []);
        setFallback(result.fallback || false);
      } catch (err) {
        setError("Failed to load odds");
      } finally {
        setLoading(false);
      }
    }

    loadOdds();
  }, []);

  return (
    <main style={{ padding: "20px" }}>
      <h1>🏒 Scorecaster</h1>

      {loading && <p>Loading odds...</p>}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {fallback && !loading && (
        <p style={{ color: "orange" }}>
          ⚠️ Showing fallback data (API quota exceeded)
        </p>
      )}

      {!loading && !error && games.length === 0 && <p>No games found</p>}

      {games.map((game) => (
        <div
          key={game.id || `${game.home_team}-${game.away_team}`}
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginTop: "10px",
            borderRadius: "8px",
          }}
        >
          <h2>
            {game.home_team} vs {game.away_team}
          </h2>
        </div>
      ))}
    </main>
  );
}
