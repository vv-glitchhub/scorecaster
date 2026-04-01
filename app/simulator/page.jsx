"use client";

import { useEffect, useState } from "react";

export default function SimulatorPage() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [iterations, setIterations] = useState(0);
  const [tournament, setTournament] = useState("");
  const [meta, setMeta] = useState(null);
  const [teamRatings, setTeamRatings] = useState([]);

  useEffect(() => {
    async function loadSimulator() {
      setLoading(true);

      try {
        const res = await fetch("/api/simulator", { cache: "no-store" });
        const data = await res.json();

        setResults(Array.isArray(data.results) ? data.results : []);
        setIterations(data.iterations || 0);
        setTournament(data.tournament || "");
        setMeta(data.meta || null);
        setTeamRatings(Array.isArray(data.teamRatings) ? data.teamRatings : []);
      } catch {
        setResults([]);
        setIterations(0);
        setTournament("");
        setMeta(null);
        setTeamRatings([]);
      } finally {
        setLoading(false);
      }
    }

    loadSimulator();
  }, []);

  const ratingFormula = meta?.ratingFormula || {
    attackWeight: 0.35,
    defenseWeight: 0.3,
    goalieWeight: 0.2,
    formWeight: 0.15,
  };

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Simulaattori</h1>
        <p style={styles.subtitle}>
          {tournament || "Turnaussimulaattori"}
        </p>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Miten tämä toimii?</h2>

          <div style={styles.infoGrid}>
            <div style={styles.infoBox}>
              <div style={styles.infoTitle}>Simulaatioiden määrä</div>
              <div style={styles.infoText}>
                Turnaus simuloidaan monta kertaa. Tässä versiossa määrä on{" "}
                <strong>{iterations}</strong>.
              </div>
            </div>

            <div style={styles.infoBox}>
              <div style={styles.infoTitle}>Mitä malli huomioi</div>
              <ul style={styles.infoList}>
                {(meta?.includes || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div style={styles.infoBox}>
              <div style={styles.infoTitle}>Mitä malli ei vielä huomioi</div>
              <ul style={styles.infoList}>
                {(meta?.excludes || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div style={styles.infoBox}>
              <div style={styles.infoTitle}>Mitä prosentit tarkoittavat?</div>
              <div style={styles.infoText}>
                Jos joukkueen mestaruustodennäköisyys on esimerkiksi 18 %, se ei
                tarkoita että joukkue voittaa varmasti. Se tarkoittaa, että
                näillä oletuksilla joukkue voitti noin 18 % simuloiduista
                turnauksista.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Miten joukkueen rating lasketaan?</h2>

          <div style={styles.explainBlock}>
            <p style={styles.explainText}>
              Jokaiselle joukkueelle annetaan neljä osa-aluetta: hyökkäys,
              puolustus, maalivahti ja formi. Näistä rakennetaan yksi
              kokonaisrating painotetulla laskulla. Tässä versiossa hyökkäys
              vaikuttaa eniten, puolustus toiseksi eniten, maalivahti kolmanneksi
              ja formi pienellä lisäkorjauksella.
            </p>

            <div style={styles.formulaCard}>
              <div style={styles.formulaTitle}>Kokonaisrating</div>
              <div style={styles.formulaText}>
                kokonaisrating =
                {" "}
                <strong>hyökkäys × {ratingFormula.attackWeight}</strong>
                {" + "}
                <strong>puolustus × {ratingFormula.defenseWeight}</strong>
                {" + "}
                <strong>maalivahti × {ratingFormula.goalieWeight}</strong>
                {" + "}
                <strong>formi × {ratingFormula.formWeight}</strong>
              </div>
            </div>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.metaLabel}>Simulaatioita</div>
          <div style={styles.metaValue}>{iterations}</div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Mestarisuosikit</h2>

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
                    Rating: {row.rating.toFixed(1)}
                  </div>
                </div>

                <div style={styles.probBlock}>
                  <div style={styles.probMain}>
                    {(row.championProbability * 100).toFixed(2)}%
                  </div>
                  <div style={styles.probSub}>mestaruus</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Joukkueiden ratingit</h2>

          <div style={styles.explainBlock}>
            <p style={styles.explainText}>
              Tässä näet jokaisen joukkueen lähtöarvot. Näitä käytetään
              simulaattorissa otteluiden voimasuhteiden arviointiin. Jos
              joukkueella on vahva hyökkäys, hyvä puolustus ja vahva maalivahti,
              sen kokonaisrating nousee ja mestaruustodennäköisyys kasvaa.
            </p>
          </div>

          {loading && <p style={styles.muted}>Ladataan...</p>}
          {!loading && teamRatings.length === 0 && (
            <p style={styles.muted}>Ratingeja ei löytynyt</p>
          )}

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Joukkue</th>
                  <th style={styles.th}>Hyökkäys</th>
                  <th style={styles.th}>Puolustus</th>
                  <th style={styles.th}>Maalivahti</th>
                  <th style={styles.th}>Formi</th>
                  <th style={styles.th}>Kokonaisrating</th>
                </tr>
              </thead>
              <tbody>
                {teamRatings.map((team) => (
                  <tr key={team.team}>
                    <td style={styles.tdStrong}>{team.team}</td>
                    <td style={styles.td}>{team.attack.toFixed(1)}</td>
                    <td style={styles.td}>{team.defense.toFixed(1)}</td>
                    <td style={styles.td}>{team.goalie.toFixed(1)}</td>
                    <td style={styles.td}>{team.form.toFixed(1)}</td>
                    <td style={styles.tdHighlight}>{team.overall.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Miksi joukkue on tällä sijalla?</h2>

          <div style={styles.explainBlock}>
            <p style={styles.explainText}>
              Joukkueen sijoitukseen vaikuttaa tässä versiossa erityisesti sen
              kokonaisrating, joka muodostuu hyökkäys-, puolustus-,
              maalivahti- ja formiarvioista. Simulaattori pelaa koko turnauksen
              tuhansia kertoja, ja laskee kuinka usein joukkue pääsee
              pudotuspeleihin, välieriin, finaaliin ja voittaa koko turnauksen.
            </p>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Syvemmät todennäköisyydet</h2>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Joukkue</th>
                  <th style={styles.th}>QF</th>
                  <th style={styles.th}>SF</th>
                  <th style={styles.th}>Final</th>
                  <th style={styles.th}>Win</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={row.team}>
                    <td style={styles.tdStrong}>{row.team}</td>
                    <td style={styles.td}>
                      {(row.quarterProbability * 100).toFixed(1)}%
                    </td>
                    <td style={styles.td}>
                      {(row.semifinalProbability * 100).toFixed(1)}%
                    </td>
                    <td style={styles.td}>
                      {(row.finalProbability * 100).toFixed(1)}%
                    </td>
                    <td style={styles.td}>
                      {(row.championProbability * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    maxWidth: 960,
    margin: "0 auto",
  },
  title: {
    fontSize: 40,
    fontWeight: 900,
    margin: "0 0 8px 0",
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
  metaLabel: {
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 6,
  },
  metaValue: {
    fontSize: 30,
    fontWeight: 900,
  },
  list: {
    display: "grid",
    gap: 12,
  },
  rowCard: {
    display: "grid",
    gridTemplateColumns: "64px 1fr auto",
    gap: 12,
    alignItems: "center",
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
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 4,
  },
  probBlock: {
    textAlign: "right",
  },
  probMain: {
    fontSize: 26,
    fontWeight: 900,
  },
  probSub: {
    fontSize: 13,
    color: "#94a3b8",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    color: "#94a3b8",
    fontSize: 14,
    borderBottom: "1px solid #334155",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px 10px",
    borderBottom: "1px solid #1e293b",
    color: "#e2e8f0",
  },
  tdStrong: {
    padding: "12px 10px",
    borderBottom: "1px solid #1e293b",
    color: "#fff",
    fontWeight: 700,
  },
  tdHighlight: {
    padding: "12px 10px",
    borderBottom: "1px solid #1e293b",
    color: "#22c55e",
    fontWeight: 800,
  },
  infoGrid: {
    display: "grid",
    gap: 14,
  },
  infoBox: {
    background: "#13203d",
    border: "1px solid #334155",
    borderRadius: 16,
    padding: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 800,
    marginBottom: 8,
  },
  infoText: {
    color: "#cbd5e1",
    lineHeight: 1.7,
  },
  infoList: {
    margin: 0,
    paddingLeft: 18,
    color: "#cbd5e1",
    lineHeight: 1.7,
  },
  explainBlock: {
    background: "#13203d",
    border: "1px solid #334155",
    borderRadius: 16,
    padding: 16,
  },
  explainText: {
    color: "#cbd5e1",
    lineHeight: 1.8,
    margin: 0,
  },
  formulaCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    background: "#0b1730",
    border: "1px solid #334155",
  },
  formulaTitle: {
    fontSize: 15,
    fontWeight: 800,
    marginBottom: 8,
  },
  formulaText: {
    color: "#cbd5e1",
    lineHeight: 1.7,
  },
};
