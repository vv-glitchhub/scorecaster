"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("scorecaster_admin_secret");
    if (saved) {
      setSecret(saved);
    }
  }, []);

  async function loadAdmin() {
    if (!secret.trim()) return;

    setLoading(true);
    setError("");

    try {
      localStorage.setItem("scorecaster_admin_secret", secret);

      const res = await fetch(`/api/admin?secret=${encodeURIComponent(secret)}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load admin data");
      }

      setData(json);
      setLoaded(true);
    } catch (err) {
      setError(err.message || "Error");
      setLoaded(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Scorecaster Admin</h1>

        {!loaded && (
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Kirjaudu adminiin</h2>

            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="ADMIN_SECRET"
              style={styles.input}
            />

            <button onClick={loadAdmin} style={styles.button} disabled={loading}>
              {loading ? "Ladataan..." : "Avaa admin"}
            </button>

            {error ? <div style={styles.error}>{error}</div> : null}
          </section>
        )}

        {loaded && data && (
          <>
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Yhteenveto</h2>
              <div style={styles.statRow}>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Tapahtumia / kävijöitä</div>
                  <div style={styles.statValue}>{data.visitors}</div>
                </div>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Palautteita</div>
                  <div style={styles.statValue}>{data.feedback.length}</div>
                </div>
              </div>
            </section>

            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Suosituimmat liigat</h2>
              <div style={styles.list}>
                {data.popularLeagues.length === 0 && (
                  <div style={styles.muted}>Ei dataa</div>
                )}

                {data.popularLeagues.map((item) => (
                  <div key={item.league} style={styles.row}>
                    <span>{item.league}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Palautteet</h2>
              <div style={styles.list}>
                {data.feedback.length === 0 && (
                  <div style={styles.muted}>Ei palautteita</div>
                )}

                {data.feedback.map((item) => (
                  <div key={item.id} style={styles.feedbackCard}>
                    <div style={styles.feedbackMeta}>
                      {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}
                    </div>
                    <div><strong>Liiga:</strong> {item.selected_sport_key || "-"}</div>
                    <div><strong>Ottelu:</strong> {item.selected_game || "-"}</div>
                    <div><strong>Bankroll:</strong> {item.bankroll ?? "-"}</div>
                    <div style={styles.feedbackMessage}>{item.message}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Viimeisimmät eventit</h2>
              <div style={styles.list}>
                {data.recentEvents.length === 0 && (
                  <div style={styles.muted}>Ei eventtejä</div>
                )}

                {data.recentEvents.map((item) => (
                  <div key={item.id} style={styles.rowBlock}>
                    <div><strong>{item.event_name}</strong></div>
                    <div style={styles.smallText}>
                      {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}
                    </div>
                    <div style={styles.smallText}>Liiga: {item.selected_sport_key || "-"}</div>
                    <div style={styles.smallText}>Ottelu: {item.selected_game || "-"}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#020617",
    color: "#fff",
    padding: 16,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
  },
  title: {
    fontSize: 40,
    fontWeight: 900,
    marginBottom: 20,
  },
  card: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    margin: "0 0 16px 0",
    fontSize: 24,
    fontWeight: 800,
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid #334155",
    background: "#0b1730",
    color: "#fff",
    fontSize: 16,
    boxSizing: "border-box",
  },
  button: {
    marginTop: 14,
    padding: "14px 20px",
    borderRadius: 14,
    background: "#16a34a",
    color: "#fff",
    border: "none",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
  },
  error: {
    marginTop: 12,
    color: "#fca5a5",
  },
  muted: {
    color: "#94a3b8",
  },
  statRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  statBox: {
    background: "#13203d",
    border: "1px solid #334155",
    borderRadius: 16,
    padding: 16,
  },
  statLabel: {
    color: "#94a3b8",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 900,
  },
  list: {
    display: "grid",
    gap: 12,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 14px",
    border: "1px solid #1f2937",
    borderRadius: 14,
    background: "#0b1730",
  },
  rowBlock: {
    padding: "12px 14px",
    border: "1px solid #1f2937",
    borderRadius: 14,
    background: "#0b1730",
  },
  smallText: {
    color: "#94a3b8",
    marginTop: 4,
    fontSize: 14,
  },
  feedbackCard: {
    padding: "14px",
    border: "1px solid #1f2937",
    borderRadius: 14,
    background: "#0b1730",
  },
  feedbackMeta: {
    color: "#94a3b8",
    marginBottom: 8,
    fontSize: 14,
  },
  feedbackMessage: {
    marginTop: 10,
    whiteSpace: "pre-wrap",
  },
};
