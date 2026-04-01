"use client";

import { useEffect, useState } from "react";

export default function SimulatorPage() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [iterations, setIterations] = useState(0);
  const [fixturesCount, setFixturesCount] = useState(0);

  useEffect(() => {
    async function loadSimulator() {
      setLoading(true);

      try {
        const res = await fetch("/api/simulator", { cache: "no-store" });
        const data = await res.json();

        setResults(Array.isArray(data.results) ? data.results : []);
        setIterations(data.iterations || 0);
        setFixturesCount(data.fixturesCount || 0);
      } catch {
        setResults([]);
        setIterations(0);
        setFixturesCount(0);
      } finally {
        setLoading(false);
      }
    }

    loadSimulator();
  }, []);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Turnaussimulaattori</h1>
        <p style={styles.subtitle}>
          MM-kisojen voittajaennuste rating-mallilla
        </p>

        <section style={styles.card}>
          <div style={styles.metaRow}>
            <div style={styles.metaBox}>
              <div style={styles.metaLabel}>Simulaatioita</div>
              <div style={styles.metaValue}>{iterations}</div>
            </div>
            <div style={styles.metaBox}>
              <div style={styles.metaLabel}>Otteluita / turnaus</div>
              <div style={styles.metaValue}>{fixturesCount}</div>
            </div>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Voittajaennusteet</h2>

          {loading && <p style={styles.muted}>Ladataan...</p>}
          {!loading && results.length === 0 && (
            <p style={styles.muted}>Tuloksia ei löytynyt</p>
          )}

          <div style={styles.list}>
            {results.map((row, index) => (
              <div key={row.team} style={styles.rowCard}>
                <div style={styles.rank}>#{index + 1}</div>

                <div style={styles.teamBlock}>
                  <div style={styles.teamName}>{row.team}</div>
                  <div style={styles.teamMeta}>
                    Keskimääräiset voitot: {row.averageWins.toFixed(2)}
                  </div>
                </div>

                <div style={styles.probability}>
                  {(row.championProbability * 100).toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#020617",
    color: "#fff",
    padding: 20,
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
    margin: "0 0 10px 0",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 18,
    marginBottom: 24,
  },
  card: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  cardTitle: {
    margin: "0 0 16px 0",
    fontSize: 24,
    fontWeight: 800,
  },
  muted: {
    color: "#94a3b8",
    fontSize: 16,
  },
  metaRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  metaBox: {
    background: "#13203d",
    border: "1px solid #334155",
    borderRadius: 16,
    padding: 16,
  },
  metaLabel: {
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 6,
  },
  metaValue: {
    fontSize: 28,
    fontWeight: 900,
  },
  list: {
    display: "grid",
    gap: 12,
  },
  rowCard: {
    display: "grid",
    gridTemplateColumns: "70px 1fr auto",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    background: "#13203d",
    border: "1px solid #334155",
  },
  rank: {
    fontSize: 24,
    fontWeight: 900,
    color: "#22c55e",
  },
  teamBlock: {
    minWidth: 0,
  },
  teamName: {
    fontSize: 20,
    fontWeight: 800,
  },
  teamMeta: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 4,
  },
  probability: {
    fontSize: 24,
    fontWeight: 900,
    color: "#f8fafc",
  },
};
