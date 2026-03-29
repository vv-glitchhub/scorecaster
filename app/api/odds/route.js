"use client";

import { useEffect, useMemo, useState } from "react";

const TEXT = {
  fi: {
    title: "SCORECASTER",
    subtitle: "Vedonlyönnin analyysi- ja oddsinäkymä",
    language: "Kieli",
    sportGroup: "Laji",
    league: "Liiga",
    games: "Ottelut",
    loading: "Ladataan...",
    noGames: "Otteluita ei löytynyt",
    bankrollTitle: "Bankroll",
    bankroll: "Bankroll (€)",
    parsedBankroll: "Tulkittu",
    feedback: "Palaute",
    feedbackPlaceholder: "Kirjoita palaute...",
    send: "Lähetä",
    sending: "Lähetetään...",
    sent: "✅ Lähetetty!",
    failed: "❌ Lähetys epäonnistui",
  },
  en: {
    title: "SCORECASTER",
    subtitle: "Betting analysis and odds dashboard",
    language: "Language",
    sportGroup: "Sport",
    league: "League",
    games: "Games",
    loading: "Loading...",
    noGames: "No games found",
    bankrollTitle: "Bankroll",
    bankroll: "Bankroll (€)",
    parsedBankroll: "Parsed",
    feedback: "Feedback",
    feedbackPlaceholder: "Write feedback...",
    send: "Send",
    sending: "Sending...",
    sent: "✅ Sent!",
    failed: "❌ Failed to send",
  },
};

const GROUP_LABELS = {
  fi: {
    icehockey: "Jääkiekko",
    basketball: "Koripallo",
    soccer: "Jalkapallo",
  },
  en: {
    icehockey: "Ice Hockey",
    basketball: "Basketball",
    soccer: "Soccer",
  },
};

const LEAGUES = {
  icehockey: [
    { key: "icehockey_nhl", fi: "NHL", en: "NHL" },
    { key: "icehockey_liiga", fi: "Liiga", en: "Liiga" },
  ],
  basketball: [
    { key: "basketball_nba", fi: "NBA", en: "NBA" },
  ],
  soccer: [
    { key: "soccer_epl", fi: "Valioliiga", en: "Premier League" },
  ],
};

function getLeagueLabel(league, lang) {
  if (!league) return "";
  return lang === "fi" ? league.fi : league.en;
}

export default function Page() {
  const [lang, setLang] = useState("fi");
  const t = TEXT[lang];

  const [selectedGroup, setSelectedGroup] = useState("icehockey");
  const [selectedSportKey, setSelectedSportKey] = useState("icehockey_nhl");

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  const [bankrollInput, setBankrollInput] = useState("1000");

  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const bankroll = useMemo(() => {
    const parsed = Number(bankrollInput.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [bankrollInput]);

  const currentLeagues = LEAGUES[selectedGroup] || [];

  useEffect(() => {
    if (!currentLeagues.some((l) => l.key === selectedSportKey)) {
      setSelectedSportKey(currentLeagues[0]?.key || "");
    }
  }, [selectedGroup, selectedSportKey, currentLeagues]);

  useEffect(() => {
    async function loadGames() {
      if (!selectedSportKey) {
        setGames([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const res = await fetch(`/api/odds?sport=${selectedSportKey}`);
        const data = await res.json();
        setGames(Array.isArray(data.data) ? data.data : []);
      } catch (error) {
        setGames([]);
      } finally {
        setLoading(false);
      }
    }

    loadGames();
  }, [selectedSportKey]);

  async function sendFeedback() {
    if (!feedback.trim()) return;

    setSending(true);
    setStatus("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: feedback,
          selectedSportKey,
          selectedGroup,
          bankroll,
          selectedGame: null,
        }),
      });

      if (!res.ok) throw new Error("Failed");

      setFeedback("");
      setStatus(t.sent);
    } catch (error) {
      setStatus(t.failed);
    } finally {
      setSending(false);
    }
  }

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <h1 style={styles.title}>{t.title}</h1>
        <p style={styles.subtitle}>{t.subtitle}</p>

        <section style={styles.section}>
          <div style={styles.field}>
            <label style={styles.label}>{t.language}</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              style={styles.input}
            >
              <option value="fi">Suomi</option>
              <option value="en">English</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>{t.sportGroup}</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              style={styles.input}
            >
              <option value="icehockey">{GROUP_LABELS[lang].icehockey}</option>
              <option value="basketball">{GROUP_LABELS[lang].basketball}</option>
              <option value="soccer">{GROUP_LABELS[lang].soccer}</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>{t.league}</label>
            <select
              value={selectedSportKey}
              onChange={(e) => setSelectedSportKey(e.target.value)}
              style={styles.input}
            >
              {currentLeagues.map((league) => (
                <option key={league.key} value={league.key}>
                  {getLeagueLabel(league, lang)}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>{t.games}</h2>

          {loading && <p style={styles.muted}>{t.loading}</p>}

          {!loading && games.length === 0 && (
            <p style={styles.muted}>{t.noGames}</p>
          )}

          <div style={styles.gamesList}>
            {games.map((game) => (
              <div key={game.id || `${game.home_team}-${game.away_team}`} style={styles.gameCard}>
                <div style={styles.gameTitle}>
                  {game.home_team} vs {game.away_team}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>{t.bankrollTitle}</h2>

          <div style={styles.field}>
            <label style={styles.label}>{t.bankroll}</label>
            <input
              type="text"
              inputMode="decimal"
              value={bankrollInput}
              onChange={(e) => setBankrollInput(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.parsedText}>
            {t.parsedBankroll}: {bankroll.toFixed(2)} €
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>{t.feedback}</h2>

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={t.feedbackPlaceholder}
            style={styles.textarea}
          />

          <button
            onClick={sendFeedback}
            disabled={sending}
            style={styles.button}
          >
            {sending ? t.sending : t.send}
          </button>

          {status ? <div style={styles.status}>{status}</div> : null}
        </section>
      </div>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    background: "#020617",
    color: "#ffffff",
    padding: 16,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    maxWidth: 720,
    margin: "0 auto",
  },
  title: {
    fontSize: 48,
    lineHeight: 1,
    fontWeight: 900,
    margin: "0 0 12px 0",
    letterSpacing: 0.5,
  },
  subtitle: {
    margin: "0 0 24px 0",
    color: "#94a3b8",
    fontSize: 18,
  },
  section: {
    display: "grid",
    gap: 12,
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
  field: {
    display: "grid",
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 700,
    color: "#cbd5e1",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid #334155",
    background: "#0b1730",
    color: "#ffffff",
    fontSize: 16,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: 140,
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid #334155",
    background: "#0b1730",
    color: "#ffffff",
    fontSize: 16,
    boxSizing: "border-box",
    resize: "vertical",
  },
  button: {
    marginTop: 14,
    padding: "14px 20px",
    borderRadius: 14,
    background: "#16a34a",
    color: "#ffffff",
    border: "none",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
  },
  status: {
    marginTop: 12,
    color: "#cbd5e1",
    fontSize: 15,
  },
  muted: {
    color: "#94a3b8",
    fontSize: 16,
    margin: 0,
  },
  gamesList: {
    display: "grid",
    gap: 12,
  },
  gameCard: {
    padding: 16,
    borderRadius: 16,
    background: "#13203d",
    border: "1px solid #334155",
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.3,
  },
  parsedText: {
    marginTop: 8,
    color: "#cbd5e1",
    fontSize: 16,
  },
};
