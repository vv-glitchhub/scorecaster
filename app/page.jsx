"use client";

import { useEffect, useState } from "react";

export default function Page() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const [bankroll, setBankroll] = useState(1000);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/odds?sport=icehockey_nhl");
        const data = await res.json();
        setGames(data.data || []);
      } catch (e) {
        console.log(e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function sendFeedback() {
    if (!feedback.trim()) return;

    setSending(true);
    setStatus("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          message: feedback,
          bankroll,
        }),
      });

      if (!res.ok) throw new Error();

      setFeedback("");
      setStatus("✅ Lähetetty!");
    } catch {
      setStatus("❌ Virhe");
    } finally {
      setSending(false);
    }
  }

  return (
    <main
      style={{
        padding: 16,
        maxWidth: 600,
        margin: "0 auto",
        color: "white",
      }}
    >
      <h1>SCORECASTER</h1>

      {/* GAMES */}
      <section>
        <h2>Ottelut</h2>

        {loading && <p>Ladataan...</p>}

        {!loading && games.length === 0 && (
          <p>Ei otteluita</p>
        )}

        {games.map((g) => (
          <div
            key={g.id}
            style={{
              padding: 12,
              marginTop: 10,
              border: "1px solid #333",
              borderRadius: 8,
              background: "#111827",
            }}
          >
            <b>
              {g.home_team} vs {g.away_team}
            </b>
          </div>
        ))}
      </section>

      {/* BANKROLL */}
      <section style={{ marginTop: 20 }}>
        <h2>Bankroll</h2>

        <input
          type="number"
          value={bankroll}
          onChange={(e) =>
            setBankroll(Number(e.target.value || 0))
          }
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 6,
            background: "#0f172a",
            color: "white",
          }}
        />

        <div style={{ marginTop: 6 }}>
          Tulkittu: {bankroll.toFixed(2)} €
        </div>
      </section>

      {/* FEEDBACK */}
      <section style={{ marginTop: 20 }}>
        <h2>Palaute</h2>

        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Kirjoita palaute..."
          style={{
            width: "100%",
            minHeight: 100,
            padding: 10,
            borderRadius: 6,
            background: "#0f172a",
            color: "white",
          }}
        />

        <button
          onClick={sendFeedback}
          disabled={sending}
          style={{
            marginTop: 10,
            padding: "10px 16px",
            background: "#16a34a",
            borderRadius: 6,
            color: "white",
            border: "none",
          }}
        >
          {sending ? "Lähetetään..." : "Lähetä"}
        </button>

        {status && <div>{status}</div>}
      </section>
    </main>
  );
}
