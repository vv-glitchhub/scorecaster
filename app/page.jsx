"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getBestOdds,
  getValueBet,
  getStakeFromKelly,
} from "../lib/value-model";

const TEXT = {
  fi: {
    title: "SCORECASTER",
    subtitle: "Vedonlyönnin analyysi- ja oddsinäkymä",
    language: "Kieli",
    sport: "Laji",
    league: "Liiga",
    games: "Ottelut",
    analysis: "Analyysi",
    bankroll: "Bankroll",
    bankrollLabel: "Bankroll (€)",
    parsedBankroll: "Tulkittu bankroll",
    feedback: "Palaute",
    feedbackPlaceholder: "Kirjoita palaute...",
    send: "Lähetä",
    sending: "Lähetetään...",
    sent: "✅ Lähetetty",
    failed: "❌ Lähetys epäonnistui",
    loading: "Ladataan...",
    noGames: "Otteluita ei löytynyt",
    bestOdds: "Parhaat kertoimet",
    bestBet: "Paras kohde",
    probability: "Mallin todennäköisyys",
    marketProbability: "Markkinan todennäköisyys",
    odds: "Kerroin",
    bookmaker: "Vedonvälittäjä",
    edge: "Edge",
    expectedValue: "Odotusarvo",
    quarterKelly: "Quarter Kelly",
    suggestedStake: "Suositeltu panos",
    info: "Info",
    infoText:
      "Scorecaster näyttää otteluita, vertailee kertoimia ja näyttää value bet -näkymän markkinan ja mallin perusteella.",
    close: "Sulje",
    noOdds: "Kertoimia ei saatavilla",
    outcome: "Kohde",
    nextAvailableBanner:
      "Valitussa liigassa ei ollut pelejä 3 päivän sisällä. Näytetään seuraavat saatavilla olevat pelit tästä lajista.",
    globalFallbackBanner:
      "Valitusta liigasta ei löytynyt pelejä. Näytetään koko lajin saatavilla olevia pelejä.",
    noLiveGamesBanner:
      "Tälle liigalle tai lajille ei löytynyt tulevia oikeita pelejä juuri nyt.",
    serverErrorBanner:
      "Palvelinvirhe otteluiden haussa. Tarkista /api/odds ja Vercel logs.",
    missingApiKeyBanner: "ODDS_API_KEY puuttuu Vercelistä.",
    sourceLabel: "Lähde",
  },
  en: {
    title: "SCORECASTER",
    subtitle: "Betting analysis and odds dashboard",
    language: "Language",
    sport: "Sport",
    league: "League",
    games: "Games",
    analysis: "Analysis",
    bankroll: "Bankroll",
    bankrollLabel: "Bankroll (€)",
    parsedBankroll: "Parsed bankroll",
    feedback: "Feedback",
    feedbackPlaceholder: "Write feedback...",
    send: "Send",
    sending: "Sending...",
    sent: "✅ Sent",
    failed: "❌ Failed to send",
    loading: "Loading...",
    noGames: "No games found",
    bestOdds: "Best odds",
    bestBet: "Best bet",
    probability: "Model probability",
    marketProbability: "Market probability",
    odds: "Odds",
    bookmaker: "Bookmaker",
    edge: "Edge",
    expectedValue: "Expected value",
    quarterKelly: "Quarter Kelly",
    suggestedStake: "Suggested stake",
    info: "Info",
    infoText:
      "Scorecaster shows games, compares odds, and displays a value bet view based on market odds and a simple model.",
    close: "Close",
    noOdds: "No odds available",
    outcome: "Outcome",
    nextAvailableBanner:
      "No games were found in this league within 3 days. Showing the next available games from this sport.",
    globalFallbackBanner:
      "No games were found in the selected league. Showing available games from the whole sport.",
    noLiveGamesBanner:
      "No real upcoming games were found for this league or sport right now.",
    serverErrorBanner:
      "Server error while loading games. Check /api/odds and Vercel logs.",
    missingApiKeyBanner: "ODDS_API_KEY is missing in Vercel.",
    sourceLabel: "Source",
  },
};

const SPORT_GROUPS = {
  fi: {
    icehockey: "Jääkiekko",
    basketball: "Koripallo",
    soccer: "Jalkapallo",
    americanfootball: "Jenkkifutis",
  },
  en: {
    icehockey: "Ice Hockey",
    basketball: "Basketball",
    soccer: "Soccer",
    americanfootball: "American Football",
  },
};

const LEAGUES = {
  icehockey: [
    { key: "icehockey_liiga", fi: "Liiga", en: "Liiga" },
    { key: "icehockey_nhl", fi: "NHL", en: "NHL" },
    { key: "icehockey_allsvenskan", fi: "Allsvenskan", en: "Allsvenskan" },
    { key: "icehockey_sweden_hockey_league", fi: "SHL", en: "SHL" },
    { key: "icehockey_finland_mestis", fi: "Mestis", en: "Mestis" },
    { key: "icehockey_germany_del", fi: "DEL", en: "DEL" },
    { key: "icehockey_switzerland_nla", fi: "National League", en: "National League" },
    { key: "icehockey_czech_extraliga", fi: "Extraliga", en: "Extraliga" },
  ],
  basketball: [
    { key: "basketball_nba", fi: "NBA", en: "NBA" },
    { key: "basketball_euroleague", fi: "EuroLeague", en: "EuroLeague" },
    { key: "basketball_ncaab", fi: "NCAA", en: "NCAA" },
  ],
  soccer: [
    { key: "soccer_epl", fi: "Valioliiga", en: "Premier League" },
    { key: "soccer_spain_la_liga", fi: "La Liga", en: "La Liga" },
    { key: "soccer_italy_serie_a", fi: "Serie A", en: "Serie A" },
    { key: "soccer_germany_bundesliga", fi: "Bundesliiga", en: "Bundesliga" },
    { key: "soccer_france_ligue_one", fi: "Ligue 1", en: "Ligue 1" },
    { key: "soccer_finland_veikkausliiga", fi: "Veikkausliiga", en: "Veikkausliiga" },
    { key: "soccer_uefa_champs_league", fi: "Mestarien liiga", en: "Champions League" },
  ],
  americanfootball: [
    { key: "americanfootball_nfl", fi: "NFL", en: "NFL" },
    { key: "americanfootball_ncaaf", fi: "NCAA", en: "NCAA Football" },
  ],
};

function getLeagueLabel(league, lang) {
  return lang === "fi" ? league.fi : league.en;
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("fi-FI");
  } catch {
    return value;
  }
}

function formatDayLabel(value, lang) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString(lang === "fi" ? "fi-FI" : "en-US", {
      weekday: "long",
      day: "numeric",
      month: "numeric",
    });
  } catch {
    return value;
  }
}

export default function Page() {
  const [lang, setLang] = useState("fi");
  const t = TEXT[lang];

  const [selectedGroup, setSelectedGroup] = useState("icehockey");
  const [selectedLeague, setSelectedLeague] = useState("icehockey_liiga");

  const [games, setGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [loading, setLoading] = useState(true);

  const [reason, setReason] = useState(null);
  const [sourceSport, setSourceSport] = useState(null);

  const [bankrollInput, setBankrollInput] = useState("1000");

  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);

  const [infoOpen, setInfoOpen] = useState(false);

  const bankroll = useMemo(() => {
    const parsed = Number(String(bankrollInput).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [bankrollInput]);

  const currentLeagues = LEAGUES[selectedGroup] || [];

  useEffect(() => {
    const valid = currentLeagues.some((league) => league.key === selectedLeague);
    if (!valid) {
      setSelectedLeague(currentLeagues[0]?.key || "");
    }
  }, [selectedGroup, selectedLeague, currentLeagues]);

  useEffect(() => {
    async function loadGames() {
      if (!selectedLeague) {
        setGames([]);
        setSelectedGameId("");
        setLoading(false);
        return;
      }

      setLoading(true);
      setReason(null);
      setSourceSport(null);

      try {
        const res = await fetch(
          `/api/odds?sport=${selectedLeague}&group=${selectedGroup}`,
          { cache: "no-store" }
        );

        const data = await res.json();

        const list = Array.isArray(data.data) ? data.data : [];
        setGames(list);
        setReason(data.reason || null);
        setSourceSport(data.sourceSport || null);
        setSelectedGameId((prev) =>
          list.some((g) => g.id === prev) ? prev : list[0]?.id || ""
        );
      } catch {
        setGames([]);
        setSelectedGameId("");
        setReason("server_error");
        setSourceSport(null);
      } finally {
        setLoading(false);
      }
    }

    loadGames();
  }, [selectedGroup, selectedLeague]);

  const groupedGames = useMemo(() => {
    return Object.entries(
      games.reduce((acc, game) => {
        const dayKey = formatDayLabel(game.commence_time, lang);
        if (!acc[dayKey]) acc[dayKey] = [];
        acc[dayKey].push(game);
        return acc;
      }, {})
    );
  }, [games, lang]);

  const selectedGame = useMemo(() => {
    return games.find((game) => game.id === selectedGameId) || null;
  }, [games, selectedGameId]);

  const bestOdds = useMemo(() => {
    return selectedGame ? getBestOdds(selectedGame) : [];
  }, [selectedGame]);

  const bestBet = useMemo(() => {
    return selectedGame ? getValueBet(selectedGame) : null;
  }, [selectedGame]);

  async function sendFeedback() {
    if (!feedback.trim()) return;

    setSendingFeedback(true);
    setFeedbackStatus("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: feedback,
          selectedSportKey: selectedLeague,
          selectedGroup,
          bankroll,
          selectedGame,
        }),
      });

      if (!res.ok) {
        throw new Error("Feedback failed");
      }

      setFeedback("");
      setFeedbackStatus(t.sent);
    } catch {
      setFeedbackStatus(t.failed);
    } finally {
      setSendingFeedback(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>{t.title}</h1>
            <p style={styles.subtitle}>{t.subtitle}</p>
          </div>

          <button type="button" style={styles.infoButton} onClick={() => setInfoOpen(true)}>
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
            <label style={styles.label}>{t.sport}</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              style={styles.input}
            >
              <option value="icehockey">{SPORT_GROUPS[lang].icehockey}</option>
              <option value="basketball">{SPORT_GROUPS[lang].basketball}</option>
              <option value="soccer">{SPORT_GROUPS[lang].soccer}</option>
              <option value="americanfootball">{SPORT_GROUPS[lang].americanfootball}</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>{t.league}</label>
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
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

        {reason === "used_next_available_game" && games.length > 0 && (
          <div style={styles.banner}>
            {t.nextAvailableBanner}
            {sourceSport ? ` — ${t.sourceLabel}: ${sourceSport}` : ""}
          </div>
        )}

        {reason === "global_fallback" && games.length > 0 && (
          <div style={styles.banner}>
            {t.globalFallbackBanner}
            {sourceSport ? ` — ${t.sourceLabel}: ${sourceSport}` : ""}
          </div>
        )}

        {reason === "empty_live_data" && games.length === 0 && (
          <div style={styles.banner}>{t.noLiveGamesBanner}</div>
        )}

        {reason === "missing_api_key" && (
          <div style={styles.banner}>{t.missingApiKeyBanner}</div>
        )}

        {reason === "server_error" && (
          <div style={styles.banner}>{t.serverErrorBanner}</div>
        )}

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>{t.games}</h2>

          {loading && <p style={styles.muted}>{t.loading}</p>}
          {!loading && games.length === 0 && <p style={styles.muted}>{t.noGames}</p>}

          <div style={styles.gamesList}>
            {groupedGames.map(([day, dayGames]) => (
              <div key={day} style={styles.dayGroup}>
                <div style={styles.dayHeader}>{day}</div>

                <div style={styles.dayGames}>
                  {dayGames.map((game) => (
                    <button
                      key={game.id || `${game.home_team}-${game.away_team}`}
                      type="button"
                      onClick={() => setSelectedGameId(game.id)}
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
                      <div style={styles.gameDate}>{formatDate(game.commence_time)}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>{t.analysis}</h2>

          {!selectedGame ? (
            <p style={styles.muted}>{t.noGames}</p>
          ) : (
            <>
              <div style={styles.analysisBox}>
                <div style={styles.analysisDay}>
                  {formatDayLabel(selectedGame.commence_time, lang)}
                </div>
                <div style={styles.analysisMatch}>
                  {selectedGame.home_team} vs {selectedGame.away_team}
                </div>
                <div style={styles.gameDate}>{formatDate(selectedGame.commence_time)}</div>
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

              <div style={{ marginTop: 14 }}>
                <div style={styles.subTitle}>{t.bestBet}</div>

                {!bestBet ? (
                  <div style={styles.muted}>{t.noOdds}</div>
                ) : (
                  <div style={styles.greenCard}>
                    <div style={styles.stack}>
                      <div style={styles.rowCard}>
                        <span>{t.outcome}</span>
                        <strong>{bestBet.outcome}</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.probability}</span>
                        <strong>{(bestBet.modelProb * 100).toFixed(1)}%</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.marketProbability}</span>
                        <strong>{(bestBet.marketProb * 100).toFixed(1)}%</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.odds}</span>
                        <strong>{bestBet.odds}</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.bookmaker}</span>
                        <strong>{bestBet.bookmaker}</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.edge}</span>
                        <strong>{(bestBet.edge * 100).toFixed(2)}%</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.expectedValue}</span>
                        <strong>{(bestBet.ev * 100).toFixed(2)}%</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.quarterKelly}</span>
                        <strong>{(bestBet.kelly * 0.25 * 100).toFixed(2)}%</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.suggestedStake}</span>
                        <strong>
                          {getStakeFromKelly(bankroll, bestBet.kelly, 0.25).toFixed(2)} €
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>{t.bankroll}</h2>

          <div style={styles.field}>
            <label style={styles.label}>{t.bankrollLabel}</label>
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
            type="button"
            onClick={sendFeedback}
            disabled={sendingFeedback}
            style={styles.button}
          >
            {sendingFeedback ? t.sending : t.send}
          </button>

          {feedbackStatus ? <div style={styles.status}>{feedbackStatus}</div> : null}
        </section>

        {infoOpen && (
          <div style={styles.modalOverlay} onClick={() => setInfoOpen(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>{t.info}</h3>
              <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>{t.infoText}</p>
              <button type="button" style={styles.button} onClick={() => setInfoOpen(false)}>
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
  page: {
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
  banner: {
    background: "#3b2a00",
    border: "1px solid #8b5e00",
    color: "#facc15",
    padding: "12px 14px",
    borderRadius: 14,
    marginBottom: 20,
    fontWeight: 700,
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
  muted: {
    color: "#94a3b8",
    fontSize: 16,
    margin: 0,
  },
  gamesList: {
    display: "grid",
    gap: 16,
  },
  dayGroup: {
    display: "grid",
    gap: 10,
  },
  dayHeader: {
    fontSize: 16,
    fontWeight: 800,
    color: "#f8fafc",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: "10px 12px",
    textTransform: "capitalize",
  },
  dayGames: {
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
  gameDate: {
    marginTop: 8,
    color: "#94a3b8",
    fontSize: 14,
  },
  analysisBox: {
    padding: 14,
    background: "#13203d",
    borderRadius: 16,
    border: "1px solid #334155",
  },
  analysisDay: {
    fontSize: 14,
    fontWeight: 700,
    color: "#93c5fd",
    marginBottom: 8,
    textTransform: "capitalize",
  },
  analysisMatch: {
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
  parsedText: {
    marginTop: 8,
    color: "#cbd5e1",
    fontSize: 16,
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
