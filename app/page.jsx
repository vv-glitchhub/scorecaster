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
    analysis: "Analyysi",
    bestOdds: "Parhaat kertoimet",
    bestBet: "Paras kohde",
    loading: "Ladataan...",
    noGames: "Otteluita ei löytynyt",
    bankrollTitle: "Bankroll",
    bankroll: "Bankroll (€)",
    parsedBankroll: "Tulkittu bankroll",
    feedback: "Palaute",
    feedbackPlaceholder: "Kirjoita palaute...",
    feedbackEmail: "Sähköposti (valinnainen)",
    send: "Lähetä",
    sending: "Lähetetään...",
    sent: "✅ Lähetetty!",
    failed: "❌ Lähetys epäonnistui",
    probability: "Todennäköisyys",
    odds: "Kerroin",
    bookmaker: "Vedonvälittäjä",
    edge: "Edge",
    suggestedStake: "Suositeltu panos",
    noOdds: "Kertoimia ei saatavilla",
    whatIsThis: "Mikä tämä on?",
    infoTitle: "Mitä sovellus tekee?",
    infoBody:
      "Scorecaster näyttää tulevia otteluita, vertailee kertoimia ja arvioi parhaan kohteen saatavilla olevan datan perusteella. Sovellus käyttää otteludataa, bookmaker-kertoimia ja niistä johdettuja todennäköisyyksiä. Osa näkymästä voi käyttää fallback-dataa, jos live-dataa ei ole saatavilla.",
    close: "Sulje",
  },
  en: {
    title: "SCORECASTER",
    subtitle: "Betting analysis and odds dashboard",
    language: "Language",
    sportGroup: "Sport",
    league: "League",
    games: "Games",
    analysis: "Analysis",
    bestOdds: "Best odds",
    bestBet: "Best bet",
    loading: "Loading...",
    noGames: "No games found",
    bankrollTitle: "Bankroll",
    bankroll: "Bankroll (€)",
    parsedBankroll: "Parsed bankroll",
    feedback: "Feedback",
    feedbackPlaceholder: "Write feedback...",
    feedbackEmail: "Email (optional)",
    send: "Send",
    sending: "Sending...",
    sent: "✅ Sent!",
    failed: "❌ Failed to send",
    probability: "Probability",
    odds: "Odds",
    bookmaker: "Bookmaker",
    edge: "Edge",
    suggestedStake: "Suggested stake",
    noOdds: "No odds available",
    whatIsThis: "What is this?",
    infoTitle: "What does this app do?",
    infoBody:
      "Scorecaster shows upcoming games, compares odds, and estimates the best available betting option based on available data. The app uses game data, bookmaker odds, and derived probabilities. Some views may use fallback data if live data is unavailable.",
    close: "Close",
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
  basketball: [{ key: "basketball_nba", fi: "NBA", en: "NBA" }],
  soccer: [{ key: "soccer_epl", fi: "Valioliiga", en: "Premier League" }],
};

function getLeagueLabel(league, lang) {
  return lang === "fi" ? league.fi : league.en;
}

function getBestOdds(game) {
  if (!game?.bookmakers?.length) return [];

  const best = {};

  for (const bookmaker of game.bookmakers) {
    const market = bookmaker?.markets?.find((m) => m.key === "h2h");
    if (!market?.outcomes) continue;

    for (const outcome of market.outcomes) {
      const current = best[outcome.name];
      if (!current || Number(outcome.price) > Number(current.price)) {
        best[outcome.name] = {
          name: outcome.name,
          price: Number(outcome.price),
          bookmaker: bookmaker.title || "-",
        };
      }
    }
  }

  return Object.values(best);
}

function impliedProbFromOdds(odds) {
  const o = Number(odds || 0);
  if (o <= 1) return 0;
  return 1 / o;
}

function normalizeProbabilities(bestOdds, game) {
  const home = bestOdds.find((o) => o.name === game.home_team);
  const away = bestOdds.find((o) => o.name === game.away_team);
  const draw = bestOdds.find((o) => o.name === "Draw");

  const probs = [
    impliedProbFromOdds(home?.price),
    impliedProbFromOdds(draw?.price),
    impliedProbFromOdds(away?.price),
  ];

  const total = probs.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    return { home: 50, draw: 0, away: 50 };
  }

  return {
    home: Number(((probs[0] / total) * 100).toFixed(1)),
    draw: Number(((probs[1] / total) * 100).toFixed(1)),
    away: Number(((probs[2] / total) * 100).toFixed(1)),
  };
}

function getBestBet(game) {
  const bestOdds = getBestOdds(game);
  const probs = normalizeProbabilities(bestOdds, game);

  const candidates = [
    {
      outcome: game.home_team,
      probability: probs.home,
      odd: bestOdds.find((o) => o.name === game.home_team)?.price || 0,
      bookmaker: bestOdds.find((o) => o.name === game.home_team)?.bookmaker || "-",
    },
    {
      outcome: "Draw",
      probability: probs.draw,
      odd: bestOdds.find((o) => o.name === "Draw")?.price || 0,
      bookmaker: bestOdds.find((o) => o.name === "Draw")?.bookmaker || "-",
    },
    {
      outcome: game.away_team,
      probability: probs.away,
      odd: bestOdds.find((o) => o.name === game.away_team)?.price || 0,
      bookmaker: bestOdds.find((o) => o.name === game.away_team)?.bookmaker || "-",
    },
  ]
    .filter((x) => x.odd > 1)
    .map((x) => ({
      ...x,
      edge: Number(((x.probability / 100) * x.odd - 1).toFixed(3)),
    }))
    .sort((a, b) => b.edge - a.edge);

  return candidates[0] || null;
}

function calculateStake(bankroll, edge) {
  if (!bankroll || edge <= 0) return 0;
  return Number((bankroll * Math.min(edge, 0.03)).toFixed(2));
}

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export default function Page() {
  const [lang, setLang] = useState("fi");
  const t = TEXT[lang];

  const [selectedGroup, setSelectedGroup] = useState("icehockey");
  const [selectedSportKey, setSelectedSportKey] = useState("icehockey_nhl");

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGameId, setSelectedGameId] = useState("");

  const [bankrollInput, setBankrollInput] = useState("1000");

  const [feedback, setFeedback] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const [infoOpen, setInfoOpen] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [visitorId, setVisitorId] = useState("");

  const bankroll = useMemo(() => {
    const parsed = Number(bankrollInput.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [bankrollInput]);

  const currentLeagues = LEAGUES[selectedGroup] || [];

  useEffect(() => {
    const storedSession = localStorage.getItem("scorecaster_session_id");
    const storedVisitor = localStorage.getItem("scorecaster_visitor_id");

    if (storedSession) {
      setSessionId(storedSession);
    } else {
      const id = createId("session");
      localStorage.setItem("scorecaster_session_id", id);
      setSessionId(id);
    }

    if (storedVisitor) {
      setVisitorId(storedVisitor);
    } else {
      const id = createId("visitor");
      localStorage.setItem("scorecaster_visitor_id", id);
      setVisitorId(id);
    }
  }, []);

  useEffect(() => {
    if (!currentLeagues.some((l) => l.key === selectedSportKey)) {
      setSelectedSportKey(currentLeagues[0]?.key || "");
    }
  }, [selectedGroup, selectedSportKey, currentLeagues]);

  useEffect(() => {
    async function trackPageView() {
      if (!sessionId || !visitorId) return;

      try {
        await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_name: "page_view",
            page_path: "/",
            session_id: sessionId,
            visitor_id: visitorId,
            selected_group: selectedGroup,
            selected_sport_key: selectedSportKey,
          }),
        });
      } catch {}
    }

    trackPageView();
  }, [sessionId, visitorId, selectedGroup, selectedSportKey]);

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
        const list = Array.isArray(data.data) ? data.data : [];
        setGames(list);
        setSelectedGameId(list[0]?.id || "");
      } catch {
        setGames([]);
        setSelectedGameId("");
      } finally {
        setLoading(false);
      }
    }

    loadGames();
  }, [selectedSportKey]);

  const selectedGame = useMemo(() => {
    return games.find((g) => g.id === selectedGameId) || null;
  }, [games, selectedGameId]);

  const bestOdds = useMemo(() => {
    return selectedGame ? getBestOdds(selectedGame) : [];
  }, [selectedGame]);

  const bestBet = useMemo(() => {
    return selectedGame ? getBestBet(selectedGame) : null;
  }, [selectedGame]);

  const suggestedStake = useMemo(() => {
    return bestBet ? calculateStake(bankroll, bestBet.edge) : 0;
  }, [bankroll, bestBet]);

  async function sendFeedback() {
    if (!feedback.trim()) return;

    setSending(true);
    setStatus("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: feedback,
          email: feedbackEmail,
          selectedSportKey,
          selectedGroup,
          bankroll,
          selectedGame,
          sessionId,
          visitorId,
        }),
      });

      if (!res.ok) throw new Error("Failed");

      setFeedback("");
      setFeedbackEmail("");
      setStatus(t.sent);

      try {
        await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_name: "feedback_sent",
            page_path: "/",
            session_id: sessionId,
            visitor_id: visitorId,
            selected_group: selectedGroup,
            selected_sport_key: selectedSportKey,
            selected_game: selectedGame
              ? `${selectedGame.home_team} vs ${selectedGame.away_team}`
              : null,
          }),
        });
      } catch {}
    } catch {
      setStatus(t.failed);
    } finally {
      setSending(false);
    }
  }

  async function trackGameOpen(game) {
    setSelectedGameId(game.id);

    try {
      await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "game_selected",
          page_path: "/",
          session_id: sessionId,
          visitor_id: visitorId,
          selected_group: selectedGroup,
          selected_sport_key: selectedSportKey,
          selected_game: `${game.home_team} vs ${game.away_team}`,
        }),
      });
    } catch {}
  }

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>{t.title}</h1>
            <p style={styles.subtitle}>{t.subtitle}</p>
          </div>

          <button style={styles.infoButton} onClick={() => setInfoOpen(true)}>
            ?
          </button>
        </div>

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
              <button
                key={game.id || `${game.home_team}-${game.away_team}`}
                onClick={() => trackGameOpen(game)}
                style={{
                  ...styles.gameCard,
                  border:
                    selectedGameId === game.id
                      ? "2px solid #22c55e"
                      : "1px solid #334155",
                }}
              >
                <div style={styles.gameTitle}>
                  {game.home_team} vs {game.away_team}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>{t.analysis}</h2>

          {!selectedGame ? (
            <p style={styles.muted}>{t.noGames}</p>
          ) : (
            <>
              <div style={styles.analysisBlock}>
                <div style={styles.analysisGame}>
                  {selectedGame.home_team} vs {selectedGame.away_team}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={styles.subTitle}>{t.bestOdds}</div>
                {bestOdds.length === 0 ? (
                  <div style={styles.muted}>{t.noOdds}</div>
                ) : (
                  <div style={styles.stack}>
                    {bestOdds.map((odd) => (
                      <div key={odd.name} style={styles.rowCard}>
                        <span>{odd.name}</span>
                        <strong>
                          {odd.price} · {odd.bookmaker}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={styles.subTitle}>{t.bestBet}</div>
                {!bestBet ? (
                  <div style={styles.muted}>{t.noOdds}</div>
                ) : (
                  <div style={styles.greenCard}>
                    <div style={styles.stack}>
                      <div style={styles.rowCard}>
                        <span>Kohde</span>
                        <strong>{bestBet.outcome}</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.probability}</span>
                        <strong>{bestBet.probability}%</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.odds}</span>
                        <strong>{bestBet.odd}</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.bookmaker}</span>
                        <strong>{bestBet.bookmaker}</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.edge}</span>
                        <strong>{bestBet.edge}</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.suggestedStake}</span>
                        <strong>{suggestedStake.toFixed(2)} €</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
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

          <input
            value={feedbackEmail}
            onChange={(e) => setFeedbackEmail(e.target.value)}
            placeholder={t.feedbackEmail}
            style={{ ...styles.input, marginBottom: 12 }}
          />

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={t.feedbackPlaceholder}
            style={styles.textarea}
          />

          <button onClick={sendFeedback} disabled={sending} style={styles.button}>
            {sending ? t.sending : t.send}
          </button>

          {status ? <div style={styles.status}>{status}</div> : null}
        </section>

        {infoOpen && (
          <div style={styles.modalOverlay} onClick={() => setInfoOpen(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>{t.infoTitle}</h3>
              <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>{t.infoBody}</p>
              <button style={styles.button} onClick={() => setInfoOpen(false)}>
                {t.close}
              </button>
            </div>
          </div>
        )}
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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
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
  infoButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#fff",
    fontSize: 20,
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 4,
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
  subTitle: {
    margin: "0 0 10px 0",
    fontSize: 18,
    fontWeight: 700,
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
    color: "#fff",
    textAlign: "left",
    cursor: "pointer",
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
  analysisBlock: {
    padding: 14,
    background: "#13203d",
    borderRadius: 16,
    border: "1px solid #334155",
  },
  analysisGame: {
    fontSize: 20,
    fontWeight: 800,
  },
  stack: {
    display: "grid",
    gap: 10,
  },
  rowCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 14px",
    border: "1px solid #1f2937",
    borderRadius: 14,
    background: "#0b1730",
  },
  greenCard: {
    border: "1px solid #166534",
    borderRadius: 16,
    padding: 14,
    background: "#0d1f18",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 20,
    padding: 20,
  },
};
