"use client";

import Link from "next/link";
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
    noOdds: "Kertoimia ei saatavilla",
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
    outcome: "Kohde",
    topPicks: "Päivän Top 3 kohdetta",
    topPicksEmpty: "Top-kohteita ei löytynyt",
    topPickLeague: "Liiga",
    filters: "Suodattimet",
    minEdge: "Min edge (%)",
    minOdds: "Min kerroin",
    maxOdds: "Max kerroin",
    positiveEvOnly: "Vain positiivinen EV",
    resetFilters: "Nollaa suodattimet",
    simulatorPreview: "Simulaattori",
    simulatorPreviewSub: "MM-kisojen mestarisuosikit",
    openSimulator: "Avaa simulaattori",
    sourceLabel: "Datan lähde",
    sourceLive: "Live-data",
    sourceCache: "Cache-data",
    sourceCacheFallback: "Cache fallback",
    sourceDemo: "Demo-data",
    sourceEmpty: "Ei dataa",
    whyThisBet: "Miksi tämä kohde?",
    calcDetails: "Näytä laskelma",
    simpleMeaningPositive:
      "Malli pitää tätä kohdetta hieman markkinaa parempana, joten veto voi olla pelikelpoinen.",
    simpleMeaningNeutral:
      "Mallin ja markkinan arviot ovat lähellä toisiaan, joten etu on pieni.",
    simpleMeaningNegative:
      "Markkina hinnoittelee tämän kohteen vähintään yhtä hyväksi kuin malli, joten etu on heikko.",
    noteLiveVsDemo:
      "Jos data ei ole liveä, analyysi on vain suuntaa-antava.",
    quotaTitle: "Live data ei ole saatavilla",
    quotaMessage:
      "API quota on täynnä juuri nyt. Sovellus ei saanut oikeita live-kertoimia tähän liigaan.",
    emptyTitle: "Dataa ei löytynyt",
    emptyMessage:
      "Valitusta liigasta ei löytynyt käyttökelpoista dataa tällä hetkellä.",
    cacheMessage: "Näytetään viimeisin tallennettu cache-data.",
    demoMessage:
      "Näytetään demo-dataa vain testikäyttöä varten. Tätä ei pidä tulkita oikeaksi markkinadataksi.",
    liveMessage: "Näytetään tuore live-data.",
    refreshHint: "Voit kokeilla myöhemmin uudelleen tai vaihtaa liigaa.",
    backendAnalysisFailed: "Backend-analyysiä ei saatu haettua.",
    noClearValue: "Selkeää value-kohdetta ei löytynyt.",
    debugTitle: "Debug",
    valueBetList: "Value betit · Backend",
    level: "Taso",
    showDebug: "Näytä debug",
    hideDebug: "Piilota debug",
    aiRanking: "AI ranking",
    confidence: "Confidence",
    fairOdds: "Fair odds",
    noBet: "Ei pelikohde",
    strongBet: "Vahva",
    playableBet: "Pelattava",
    skipBet: "Skip",
    bankrollHistory: "Bankroll history",
    addSnapshot: "Tallenna snapshot",
    emptyHistory: "Historiaa ei vielä ole",
    clvTracking: "CLV tracking",
    trackBet: "Seuraa vetoa",
    trackedBets: "Seuratut vedot",
    noTrackedBets: "Ei seurattuja vetoja",
    takenOdds: "Otettu kerroin",
    closingOdds: "Closing odds",
    clvValue: "CLV",
    saveClosingOdds: "Tallenna closing odds",
    pending: "Odottaa",
    saved: "Tallennettu",
    remove: "Poista",
    backendTop3: "Top 3 bets · Backend",
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
    noOdds: "No odds available",
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
    outcome: "Outcome",
    topPicks: "Top 3 picks today",
    topPicksEmpty: "No top picks found",
    topPickLeague: "League",
    filters: "Filters",
    minEdge: "Min edge (%)",
    minOdds: "Min odds",
    maxOdds: "Max odds",
    positiveEvOnly: "Positive EV only",
    resetFilters: "Reset filters",
    simulatorPreview: "Simulator",
    simulatorPreviewSub: "World Championship title odds",
    openSimulator: "Open simulator",
    sourceLabel: "Data source",
    sourceLive: "Live data",
    sourceCache: "Cached data",
    sourceCacheFallback: "Cache fallback",
    sourceDemo: "Demo data",
    sourceEmpty: "No data",
    whyThisBet: "Why this pick?",
    calcDetails: "Show calculation",
    simpleMeaningPositive:
      "The model rates this outcome slightly better than the market does, so it may be playable.",
    simpleMeaningNeutral:
      "The model and market are close to each other, so the edge is small.",
    simpleMeaningNegative:
      "The market prices this outcome at least as well as the model, so the edge is weak.",
    noteLiveVsDemo:
      "If the source is not live, the analysis is only indicative.",
    quotaTitle: "Live data is unavailable",
    quotaMessage:
      "API quota is currently exhausted. The app could not fetch real live odds for this league.",
    emptyTitle: "No data found",
    emptyMessage:
      "No usable data was found for the selected league at the moment.",
    cacheMessage: "Showing the latest saved cached data.",
    demoMessage:
      "Showing demo data for testing only. Do not treat this as real market data.",
    liveMessage: "Showing fresh live data.",
    refreshHint: "You can try again later or switch league.",
    backendAnalysisFailed: "Backend analysis could not be loaded.",
    noClearValue: "No clear value bet found.",
    debugTitle: "Debug",
    valueBetList: "Value bets · Backend",
    level: "Level",
    showDebug: "Show debug",
    hideDebug: "Hide debug",
    aiRanking: "AI ranking",
    confidence: "Confidence",
    fairOdds: "Fair odds",
    noBet: "No bet",
    strongBet: "Strong",
    playableBet: "Playable",
    skipBet: "Skip",
    bankrollHistory: "Bankroll history",
    addSnapshot: "Save snapshot",
    emptyHistory: "No history yet",
    clvTracking: "CLV tracking",
    trackBet: "Track bet",
    trackedBets: "Tracked bets",
    noTrackedBets: "No tracked bets",
    takenOdds: "Taken odds",
    closingOdds: "Closing odds",
    clvValue: "CLV",
    saveClosingOdds: "Save closing odds",
    pending: "Pending",
    saved: "Saved",
    remove: "Remove",
    backendTop3: "Top 3 bets · Backend",
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
  ],
  americanfootball: [
    { key: "americanfootball_nfl", fi: "NFL", en: "NFL" },
    { key: "americanfootball_ncaaf", fi: "NCAA", en: "NCAA Football" },
  ],
};

function getLeagueLabel(league, lang) {
  return lang === "fi" ? league.fi : league.en;
}

function formatDate(value, lang = "fi") {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString(lang === "fi" ? "fi-FI" : "en-US");
  } catch {
    return value;
  }
}

function formatDayLabel(value, lang) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString(
      lang === "fi" ? "fi-FI" : "en-US",
      {
        weekday: "long",
        day: "numeric",
        month: "numeric",
      }
    );
  } catch {
    return value;
  }
}

function parseNumberInput(value, fallback = null) {
  if (value === "" || value == null) return fallback;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getMeaningText(bestBet, t) {
  if (!bestBet) return "";
  if (bestBet.edge > 0.025 && bestBet.ev > 0) return t.simpleMeaningPositive;
  if (bestBet.edge > 0 && bestBet.ev >= 0) return t.simpleMeaningNeutral;
  return t.simpleMeaningNegative;
}

function getSourceMeta(source, t) {
  if (source === "live") {
    return { label: t.sourceLive, tone: "live", description: t.liveMessage };
  }
  if (source === "cache" || source === "cache_fallback") {
    return {
      label: source === "cache" ? t.sourceCache : t.sourceCacheFallback,
      tone: "cache",
      description: t.cacheMessage,
    };
  }
  if (source === "demo") {
    return { label: t.sourceDemo, tone: "demo", description: t.demoMessage };
  }
  return { label: t.sourceEmpty, tone: "empty", description: "" };
}

function getLevel(edge, t) {
  if (edge > 0.05) return t.strongBet;
  if (edge > 0.015) return t.playableBet;
  return t.skipBet;
}

function getConfidenceScore(bet) {
  if (!bet) return 0;
  const edge = Math.max(0, Number(bet.edge || 0));
  const ev = Math.max(0, Number(bet.ev || 0));
  const probability = Number(
    bet.modelProb ?? bet.modelProbability ?? 0
  );

  const score =
    edge * 700 +
    ev * 300 +
    probability * 35;

  return Math.round(clamp(score, 0, 99));
}

function getFairOdds(probability) {
  const p = Number(probability || 0);
  if (!p || p <= 0) return null;
  return 1 / p;
}

function getValueBetCardStyle(level, edge) {
  if (edge > 0.05) {
    return {
      border: "2px solid #22c55e",
      background: "linear-gradient(135deg, #052e16, #020617)",
      boxShadow: "0 0 20px rgba(34,197,94,0.15)",
    };
  }
  if (edge > 0.015) {
    return {
      border: "2px solid #facc15",
      background: "#1e1b0a",
    };
  }
  return {
    border: "1px solid #334155",
    background: "#101827",
    opacity: 0.75,
  };
}

function getClvFromOdds(takenOdds, closingOdds) {
  const taken = Number(takenOdds);
  const closing = Number(closingOdds);
  if (!Number.isFinite(taken) || !Number.isFinite(closing) || taken <= 0 || closing <= 0) {
    return null;
  }
  return ((taken / closing) - 1) * 100;
}

function WarningBox({ title, message, hint }) {
  return (
    <div style={styles.warningBox}>
      <div style={styles.warningTitle}>{title}</div>
      <div style={styles.warningText}>{message}</div>
      {hint ? <div style={styles.warningHint}>{hint}</div> : null}
    </div>
  );
}

function SectionCard({ title, subtitle, rightSlot, children }) {
  return (
    <section style={styles.card}>
      {(title || subtitle || rightSlot) && (
        <div style={styles.cardHeaderInline}>
          <div>
            {title ? <h2 style={styles.cardTitle}>{title}</h2> : null}
            {subtitle ? <p style={styles.cardSub}>{subtitle}</p> : null}
          </div>
          {rightSlot || null}
        </div>
      )}
      {children}
    </section>
  );
}

function SourceBadge({ meta, labelPrefix }) {
  const toneStyle =
    meta.tone === "live"
      ? styles.sourceBadgeLive
      : meta.tone === "cache"
      ? styles.sourceBadgeCache
      : meta.tone === "demo"
      ? styles.sourceBadgeDemo
      : styles.sourceBadgeEmpty;

  return (
    <div style={{ ...styles.sourceBadge, ...toneStyle }}>
      {labelPrefix ? `${labelPrefix}: ` : ""}
      {meta.label}
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div style={styles.rowCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function Page() {
  const [lang, setLang] = useState("fi");
  const t = TEXT[lang];

  const [selectedGroup, setSelectedGroup] = useState("icehockey");
  const [selectedLeague, setSelectedLeague] = useState("icehockey_liiga");

  const [games, setGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [loading, setLoading] = useState(true);

  const [oddsSource, setOddsSource] = useState("empty");
  const [oddsEmpty, setOddsEmpty] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [oddsMessage, setOddsMessage] = useState("");
  const [oddsDebug, setOddsDebug] = useState(null);

  const [topPicks, setTopPicks] = useState([]);
  const [topPicksLoading, setTopPicksLoading] = useState(true);

  const [simPreview, setSimPreview] = useState([]);
  const [simLoading, setSimLoading] = useState(true);

  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  const [bankrollInput, setBankrollInput] = useState("1000");
  const [minEdgeInput, setMinEdgeInput] = useState("");
  const [minOddsInput, setMinOddsInput] = useState("");
  const [maxOddsInput, setMaxOddsInput] = useState("");
  const [positiveEvOnly, setPositiveEvOnly] = useState(true);

  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);

  const [infoOpen, setInfoOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  const [bankrollHistory, setBankrollHistory] = useState([]);
  const [trackedBets, setTrackedBets] = useState([]);
  const [closingOddsInputs, setClosingOddsInputs] = useState({});

  const bankroll = useMemo(() => {
    const parsed = Number(String(bankrollInput).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [bankrollInput]);

  const minEdge = useMemo(() => parseNumberInput(minEdgeInput, 0), [minEdgeInput]);
  const minOdds = useMemo(() => parseNumberInput(minOddsInput, null), [minOddsInput]);
  const maxOdds = useMemo(() => parseNumberInput(maxOddsInput, null), [maxOddsInput]);

  const currentLeagues = LEAGUES[selectedGroup] || [];

  useEffect(() => {
    const valid = currentLeagues.some((league) => league.key === selectedLeague);
    if (!valid) {
      setSelectedLeague(currentLeagues[0]?.key || "");
    }
  }, [selectedGroup, selectedLeague, currentLeagues]);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem("scorecaster_bankroll_history");
      const savedTrackedBets = localStorage.getItem("scorecaster_tracked_bets");
      if (savedHistory) setBankrollHistory(JSON.parse(savedHistory));
      if (savedTrackedBets) setTrackedBets(JSON.parse(savedTrackedBets));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("scorecaster_bankroll_history", JSON.stringify(bankrollHistory));
    } catch {}
  }, [bankrollHistory]);

  useEffect(() => {
    try {
      localStorage.setItem("scorecaster_tracked_bets", JSON.stringify(trackedBets));
    } catch {}
  }, [trackedBets]);

  useEffect(() => {
    async function loadGames() {
      if (!selectedLeague) {
        setGames([]);
        setSelectedGameId("");
        setLoading(false);
        setOddsSource("empty");
        setOddsEmpty(true);
        setQuotaExceeded(false);
        setOddsMessage("");
        setOddsDebug(null);
        return;
      }

      setLoading(true);

      try {
        const res = await fetch(
          `/api/odds?sport=${selectedLeague}&group=${selectedGroup}`,
          { cache: "no-store" }
        );

        const data = await res.json();
        const list = Array.isArray(data.data) ? data.data : [];

        setGames(list);
        setOddsSource(data.source || "empty");
        setOddsEmpty(Boolean(data.empty));
        setQuotaExceeded(Boolean(data.quotaExceeded));
        setOddsMessage(data.message || "");
        setOddsDebug(data.debug || null);
      } catch {
        setGames([]);
        setOddsSource("empty");
        setOddsEmpty(true);
        setQuotaExceeded(false);
        setOddsMessage("");
        setOddsDebug(null);
      } finally {
        setLoading(false);
      }
    }

    loadGames();
  }, [selectedGroup, selectedLeague]);

  useEffect(() => {
    async function loadTopPicks() {
      setTopPicksLoading(true);

      try {
        const res = await fetch(`/api/top-picks?group=${selectedGroup}`, {
          cache: "no-store",
        });
        const data = await res.json();
        setTopPicks(Array.isArray(data.data) ? data.data : []);
      } catch {
        setTopPicks([]);
      } finally {
        setTopPicksLoading(false);
      }
    }

    loadTopPicks();
  }, [selectedGroup]);

  useEffect(() => {
    async function loadSimulatorPreview() {
      setSimLoading(true);

      try {
        const res = await fetch("/api/simulator", { cache: "no-store" });
        const data = await res.json();
        const rows = Array.isArray(data.results) ? data.results.slice(0, 5) : [];
        setSimPreview(rows);
      } catch {
        setSimPreview([]);
      } finally {
        setSimLoading(false);
      }
    }

    loadSimulatorPreview();
  }, []);

  const filteredTopPicks = useMemo(() => {
    return topPicks.filter((pick) => {
      const edgePercent = (pick.edge || 0) * 100;
      const odds = Number(pick.odds || 0);
      const ev = Number(pick.ev || 0);

      if (edgePercent < minEdge) return false;
      if (minOdds != null && odds < minOdds) return false;
      if (maxOdds != null && odds > maxOdds) return false;
      if (positiveEvOnly && ev <= 0) return false;
      if (ev <= -0.02) return false;

      return true;
    });
  }, [topPicks, minEdge, minOdds, maxOdds, positiveEvOnly]);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const valueBet = getValueBet(game);
      if (!valueBet) return true;
      const edgePercent = (valueBet.edge || 0) * 100;
      const odds = Number(valueBet.odds || 0);
      const ev = Number(valueBet.ev || 0);

      if (edgePercent < minEdge) return false;
      if (minOdds != null && odds < minOdds) return false;
      if (maxOdds != null && odds > maxOdds) return false;
      if (positiveEvOnly && ev <= 0) return false;

      return true;
    });
  }, [games, minEdge, minOdds, maxOdds, positiveEvOnly]);

  useEffect(() => {
    setSelectedGameId((prev) =>
      filteredGames.some((g) => g.id === prev) ? prev : filteredGames[0]?.id || ""
    );
  }, [filteredGames]);

  const groupedGames = useMemo(() => {
    return Object.entries(
      filteredGames.reduce((acc, game) => {
        const dayKey = formatDayLabel(game.commence_time, lang);
        if (!acc[dayKey]) acc[dayKey] = [];
        acc[dayKey].push(game);
        return acc;
      }, {})
    );
  }, [filteredGames, lang]);

  const selectedGame = useMemo(() => {
    return filteredGames.find((game) => game.id === selectedGameId) || null;
  }, [filteredGames, selectedGameId]);

  const bestOdds = useMemo(() => {
    return selectedGame ? getBestOdds(selectedGame) : [];
  }, [selectedGame]);

  const bestBet = useMemo(() => {
    return selectedGame ? getValueBet(selectedGame) : null;
  }, [selectedGame]);

  const sourceMeta = useMemo(() => getSourceMeta(oddsSource, t), [oddsSource, t]);

  useEffect(() => {
    async function loadAnalysis() {
      if (!selectedGame || oddsEmpty) {
        setAnalysisData(null);
        setAnalysisError("");
        return;
      }

      setAnalysisLoading(true);
      setAnalysisError("");

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            match: selectedGame,
            bankroll,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Analyze failed");
        }

        setAnalysisData(data);
      } catch {
        setAnalysisData(null);
        setAnalysisError(t.backendAnalysisFailed);
      } finally {
        setAnalysisLoading(false);
      }
    }

    loadAnalysis();
  }, [selectedGame, oddsEmpty, bankroll, t.backendAnalysisFailed]);

  function resetFilters() {
    setMinEdgeInput("");
    setMinOddsInput("");
    setMaxOddsInput("");
    setPositiveEvOnly(true);
  }

  async function sendFeedback() {
    if (!feedback.trim()) return;

    setSendingFeedback(true);
    setFeedbackStatus("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: feedback,
          selectedSportKey: selectedLeague,
          selectedGroup,
          bankroll,
          selectedGame,
        }),
      });

      if (!res.ok) throw new Error("Feedback failed");

      setFeedback("");
      setFeedbackStatus(t.sent);
    } catch {
      setFeedbackStatus(t.failed);
    } finally {
      setSendingFeedback(false);
    }
  }

  function addBankrollSnapshot() {
    if (!Number.isFinite(bankroll) || bankroll <= 0) return;
    setBankrollHistory((prev) => [
      {
        id: `${Date.now()}`,
        value: bankroll,
        date: new Date().toISOString(),
      },
      ...prev.slice(0, 19),
    ]);
  }

  function trackBet(bet, match) {
    if (!bet || !match) return;

    const tracked = {
      id: `${match.id || `${match.home_team}-${match.away_team}`}-${bet.outcome || bet.outcomeName}-${Date.now()}`,
      matchLabel: `${match.home_team} vs ${match.away_team}`,
      outcome: bet.outcome || bet.outcomeName || "-",
      bookmaker: bet.bookmaker || "-",
      takenOdds: Number(bet.odds || 0),
      closingOdds: null,
      clv: null,
      date: new Date().toISOString(),
    };

    setTrackedBets((prev) => [tracked, ...prev]);
  }

  function saveClosingOdds(trackedId) {
    const input = parseNumberInput(closingOddsInputs[trackedId], null);
    if (!input || input <= 0) return;

    setTrackedBets((prev) =>
      prev.map((bet) => {
        if (bet.id !== trackedId) return bet;
        return {
          ...bet,
          closingOdds: input,
          clv: getClvFromOdds(bet.takenOdds, input),
        };
      })
    );
  }

  function removeTrackedBet(trackedId) {
    setTrackedBets((prev) => prev.filter((bet) => bet.id !== trackedId));
  }

  const showQuotaWarning = !loading && quotaExceeded && oddsEmpty;
  const showEmptyWarning = !loading && oddsEmpty && !quotaExceeded;

  const backendValueBets = Array.isArray(analysisData?.valueBets)
    ? analysisData.valueBets
        .filter((bet) => bet && typeof bet.edge === "number")
        .sort((a, b) => b.edge - a.edge)
    : [];

  const backendTop3 = useMemo(() => {
    const source =
      Array.isArray(analysisData?.topPicks) && analysisData.topPicks.length > 0
        ? analysisData.topPicks
        : backendValueBets;

    return source
      .map((bet) => {
        const modelProbability = Number(
          bet.modelProb ?? bet.modelProbability ?? 0
        );
        const confidence = getConfidenceScore({
          ...bet,
          modelProb: modelProbability,
        });

        return {
          ...bet,
          outcomeName: bet.outcome || bet.outcomeName || "-",
          modelProbability,
          marketProbability: Number(
            bet.marketProb ?? bet.marketProbability ?? 0
          ),
          confidence,
          fairOdds: getFairOdds(modelProbability),
        };
      })
      .sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return Number(b.edge || 0) - Number(a.edge || 0);
      })
      .slice(0, 3);
  }, [analysisData, backendValueBets]);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.heroCard}>
          <div style={styles.heroGlowOne} />
          <div style={styles.heroGlowTwo} />

          <div style={styles.headerRow}>
            <div style={{ position: "relative", zIndex: 1 }}>
              <h1 style={styles.title}>{t.title}</h1>
              <p style={styles.subtitle}>{t.subtitle}</p>
            </div>

            <button type="button" style={styles.infoButton} onClick={() => setInfoOpen(true)}>
              ?
            </button>
          </div>
        </section>

        <SectionCard
          title={t.simulatorPreview}
          subtitle={t.simulatorPreviewSub}
          rightSlot={<div style={{ ...styles.sourceBadge, ...styles.sourceBadgeCache }}>Preview</div>}
        >
          {simLoading ? <p style={styles.muted}>{t.loading}</p> : null}

          {!simLoading && simPreview.length > 0 ? (
            <div style={styles.stack}>
              {simPreview.map((team, index) => (
                <div key={team.team} style={styles.rowCard}>
                  <span>
                    #{index + 1} {team.team}
                  </span>
                  <strong>{(team.championProbability * 100).toFixed(2)}%</strong>
                </div>
              ))}
            </div>
          ) : null}

          <Link href="/simulator" style={styles.linkButton}>
            {t.openSimulator}
          </Link>
        </SectionCard>

        <SectionCard title="Controls">
          <div style={styles.controlsGrid}>
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
          </div>
        </SectionCard>

        <SectionCard title={t.filters}>
          <div style={styles.filterGrid}>
            <div style={styles.field}>
              <label style={styles.label}>{t.minEdge}</label>
              <input
                type="text"
                inputMode="decimal"
                value={minEdgeInput}
                onChange={(e) => setMinEdgeInput(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>{t.minOdds}</label>
              <input
                type="text"
                inputMode="decimal"
                value={minOddsInput}
                onChange={(e) => setMinOddsInput(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>{t.maxOdds}</label>
              <input
                type="text"
                inputMode="decimal"
                value={maxOddsInput}
                onChange={(e) => setMaxOddsInput(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={positiveEvOnly}
              onChange={(e) => setPositiveEvOnly(e.target.checked)}
            />
            <span>{t.positiveEvOnly}</span>
          </label>

          <button type="button" style={styles.secondaryButton} onClick={resetFilters}>
            {t.resetFilters}
          </button>
        </SectionCard>

        <SectionCard title={t.topPicks}>
          {topPicksLoading ? <p style={styles.muted}>{t.loading}</p> : null}

          {!topPicksLoading && filteredTopPicks.length === 0 ? (
            <p style={styles.muted}>{t.topPicksEmpty}</p>
          ) : null}

          <div style={styles.stack}>
            {filteredTopPicks.map((pick) => (
              <div key={pick.id} style={styles.topPickCard}>
                <div style={styles.topPickLeague}>
                  {t.topPickLeague}: {pick.leagueLabel}
                </div>
                <div style={styles.topPickMatch}>
                  {pick.home_team} vs {pick.away_team}
                </div>
                <div style={styles.gameDate}>{formatDate(pick.commence_time, lang)}</div>

                <div style={styles.transparentBox}>
                  <div style={styles.transparentTitle}>{t.whyThisBet}</div>
                  <p style={styles.transparentText}>
                    {pick.ev > 0 ? t.simpleMeaningPositive : t.simpleMeaningNegative}
                  </p>
                </div>

                <details style={styles.details}>
                  <summary style={styles.summary}>{t.calcDetails}</summary>
                  <div style={styles.detailsContent}>
                    <StatRow label={t.outcome} value={pick.outcome} />
                    <StatRow label={t.odds} value={pick.odds} />
                    <StatRow label={t.bookmaker} value={pick.bookmaker} />
                    <StatRow label={t.edge} value={`${(pick.edge * 100).toFixed(2)}%`} />
                    <StatRow label={t.expectedValue} value={`${(pick.ev * 100).toFixed(2)}%`} />
                    <StatRow
                      label={t.suggestedStake}
                      value={`${getStakeFromKelly(bankroll, pick.kelly, 0.25).toFixed(2)} €`}
                    />
                  </div>
                </details>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={t.games}
          subtitle={sourceMeta.description || undefined}
          rightSlot={<SourceBadge meta={sourceMeta} labelPrefix={t.sourceLabel} />}
        >
          {oddsMessage ? <p style={styles.noteText}>{oddsMessage}</p> : null}

          {showQuotaWarning ? (
            <WarningBox
              title={t.quotaTitle}
              message={t.quotaMessage}
              hint={t.refreshHint}
            />
          ) : null}

          {showEmptyWarning ? (
            <WarningBox
              title={t.emptyTitle}
              message={t.emptyMessage}
              hint={t.refreshHint}
            />
          ) : null}

          {loading ? <p style={styles.muted}>{t.loading}</p> : null}

          {!loading && !oddsEmpty && filteredGames.length === 0 ? (
            <p style={styles.muted}>{t.noGames}</p>
          ) : null}

          {!oddsEmpty ? (
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
                        <div style={styles.gameTitleText}>
                          {game.home_team} vs {game.away_team}
                        </div>

                        <div style={styles.gameDate}>
                          {formatDate(game.commence_time, lang)}
                        </div>

                        {getBestOdds(game)?.length > 0 ? (
                          <div style={styles.gameOddsPreview}>
                            {getBestOdds(game)
                              .map((o) => `${o.name} ${o.price}`)
                              .join(" • ")}
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title={t.analysis}
          rightSlot={<SourceBadge meta={sourceMeta} />}
        >
          {oddsEmpty ? (
            <WarningBox
              title={quotaExceeded ? t.quotaTitle : t.emptyTitle}
              message={quotaExceeded ? t.quotaMessage : t.emptyMessage}
              hint={t.refreshHint}
            />
          ) : !selectedGame ? (
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
                <div style={styles.gameDate}>
                  {formatDate(selectedGame.commence_time, lang)}
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
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
                <div style={styles.subTitle}>{t.backendTop3}</div>

                {analysisLoading ? (
                  <div style={styles.muted}>{t.loading}</div>
                ) : backendTop3.length === 0 ? (
                  <div style={styles.muted}>{t.noClearValue}</div>
                ) : (
                  <div style={styles.stack}>
                    {backendTop3.map((bet, index) => {
                      const level = getLevel(Number(bet.edge || 0), t);
                      const confidence = getConfidenceScore(bet);
                      const fairOdds = getFairOdds(
                        Number(bet.modelProbability ?? bet.modelProb ?? 0)
                      );

                      return (
                        <div
                          key={`${bet.outcomeName}-${index}`}
                          style={{
                            ...styles.topAiCard,
                            ...getValueBetCardStyle(level, Number(bet.edge || 0)),
                          }}
                        >
                          <div style={styles.topAiHeader}>
                            <div style={styles.topAiRank}>#{index + 1}</div>
                            <div style={styles.topAiOutcome}>{bet.outcomeName}</div>
                            <div style={styles.confidenceBadge}>{confidence}/100</div>
                          </div>

                          <div style={styles.stack}>
                            <StatRow label={t.bookmaker} value={bet.bookmaker || "-"} />
                            <StatRow label={t.odds} value={Number(bet.odds || 0).toFixed(2)} />
                            <StatRow
                              label={t.probability}
                              value={`${(Number(bet.modelProbability || 0) * 100).toFixed(1)}%`}
                            />
                            <StatRow
                              label={t.marketProbability}
                              value={`${(Number(bet.marketProbability || 0) * 100).toFixed(1)}%`}
                            />
                            <StatRow label={t.edge} value={`${(Number(bet.edge || 0) * 100).toFixed(2)}%`} />
                            <StatRow label={t.expectedValue} value={`${(Number(bet.ev || 0) * 100).toFixed(2)}%`} />
                            <StatRow label={t.confidence} value={`${confidence}/100`} />
                            <StatRow label={t.fairOdds} value={fairOdds ? fairOdds.toFixed(2) : "-"} />
                            <StatRow label={t.level} value={level} />
                          </div>

                          <button
                            type="button"
                            style={styles.secondaryButton}
                            onClick={() => trackBet(bet, selectedGame)}
                          >
                            {t.trackBet}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={styles.subTitle}>{t.valueBetList}</div>

                {analysisLoading ? (
                  <div style={styles.muted}>{t.loading}</div>
                ) : analysisError ? (
                  <WarningBox
                    title={t.valueBetList}
                    message={analysisError}
                    hint={t.noteLiveVsDemo}
                  />
                ) : backendValueBets.length === 0 ? (
                  <div style={styles.muted}>{t.noClearValue}</div>
                ) : (
                  <div style={styles.stack}>
                    {backendValueBets.map((bet, index) => {
                      const modelProbability = Number(
                        bet.modelProb ?? bet.modelProbability ?? 0
                      );
                      const marketProbability = Number(
                        bet.marketProb ?? bet.marketProbability ?? 0
                      );
                      const level = getLevel(Number(bet.edge || 0), t);
                      const confidence = getConfidenceScore({
                        ...bet,
                        modelProb: modelProbability,
                      });
                      const fairOdds = getFairOdds(modelProbability);

                      return (
                        <div
                          key={`${bet.outcome || bet.outcomeName}-${index}`}
                          style={{
                            ...styles.legacyCard,
                            ...getValueBetCardStyle(level, Number(bet.edge || 0)),
                          }}
                        >
                          <StatRow label={t.outcome} value={bet.outcome || bet.outcomeName || "-"} />
                          <StatRow label={t.bookmaker} value={bet.bookmaker || "-"} />
                          <StatRow label={t.odds} value={Number(bet.odds || 0).toFixed(2)} />
                          <StatRow label={t.probability} value={`${(modelProbability * 100).toFixed(1)}%`} />
                          <StatRow label={t.marketProbability} value={`${(marketProbability * 100).toFixed(1)}%`} />
                          <StatRow label={t.edge} value={`${(Number(bet.edge || 0) * 100).toFixed(2)}%`} />
                          <StatRow label={t.expectedValue} value={`${(Number(bet.ev || 0) * 100).toFixed(2)}%`} />
                          <StatRow label={t.quarterKelly} value={`${(Number(bet.kelly || 0) * 0.25 * 100).toFixed(2)}%`} />
                          <StatRow label={t.suggestedStake} value={`${Number(bet.stake || 0).toFixed(2)} €`} />
                          <StatRow label={t.confidence} value={`${confidence}/100`} />
                          <StatRow label={t.fairOdds} value={fairOdds ? fairOdds.toFixed(2) : "-"} />
                          <StatRow label={t.level} value={level} />

                          <button
                            type="button"
                            style={styles.secondaryButton}
                            onClick={() => trackBet(bet, selectedGame)}
                          >
                            {t.trackBet}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={styles.subTitle}>{t.bestBet}</div>

                {!bestBet ? (
                  <div style={styles.muted}>{t.noOdds}</div>
                ) : (
                  <>
                    <div style={styles.transparentBox}>
                      <div style={styles.transparentTitle}>{t.whyThisBet}</div>
                      <p style={styles.transparentText}>
                        {getMeaningText(bestBet, t)}
                      </p>
                    </div>

                    <div style={styles.legacyCard}>
                      <div style={styles.stack}>
                        <StatRow label={t.outcome} value={bestBet.outcome} />
                        <StatRow label={t.probability} value={`${(bestBet.modelProb * 100).toFixed(1)}%`} />
                        <StatRow label={t.marketProbability} value={`${(bestBet.marketProb * 100).toFixed(1)}%`} />
                        <StatRow label={t.odds} value={bestBet.odds} />
                        <StatRow label={t.bookmaker} value={bestBet.bookmaker} />
                        <StatRow label={t.edge} value={`${(bestBet.edge * 100).toFixed(2)}%`} />
                        <StatRow label={t.expectedValue} value={`${(bestBet.ev * 100).toFixed(2)}%`} />
                        <StatRow label={t.quarterKelly} value={`${(bestBet.kelly * 0.25 * 100).toFixed(2)}%`} />
                        <StatRow label={t.suggestedStake} value={`${getStakeFromKelly(bankroll, bestBet.kelly, 0.25).toFixed(2)} €`} />
                        <StatRow label={t.confidence} value={`${getConfidenceScore(bestBet)}/100`} />
                        <StatRow label={t.fairOdds} value={getFairOdds(bestBet.modelProb)?.toFixed(2) || "-"} />
                        <StatRow label={t.level} value={getLevel(bestBet.edge, t)} />
                      </div>

                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => trackBet(bestBet, selectedGame)}
                      >
                        {t.trackBet}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard
          title={t.bankroll}
          rightSlot={
            <button type="button" style={styles.secondaryButton} onClick={addBankrollSnapshot}>
              {t.addSnapshot}
            </button>
          }
        >
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
        </SectionCard>

        <SectionCard title={t.bankrollHistory}>
          {bankrollHistory.length === 0 ? (
            <p style={styles.muted}>{t.emptyHistory}</p>
          ) : (
            <div style={styles.stack}>
              {bankrollHistory.map((item) => (
                <div key={item.id} style={styles.rowCard}>
                  <span>{formatDate(item.date, lang)}</span>
                  <strong>{Number(item.value).toFixed(2)} €</strong>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title={t.clvTracking}>
          <div style={styles.subTitle}>{t.trackedBets}</div>

          {trackedBets.length === 0 ? (
            <p style={styles.muted}>{t.noTrackedBets}</p>
          ) : (
            <div style={styles.stack}>
              {trackedBets.map((bet) => (
                <div key={bet.id} style={styles.legacyCard}>
                  <div style={styles.trackTitle}>{bet.matchLabel}</div>
                  <div style={styles.trackSub}>{bet.outcome}</div>

                  <div style={styles.stack}>
                    <StatRow label={t.bookmaker} value={bet.bookmaker} />
                    <StatRow label={t.takenOdds} value={Number(bet.takenOdds).toFixed(2)} />
                    <StatRow
                      label={t.closingOdds}
                      value={bet.closingOdds ? Number(bet.closingOdds).toFixed(2) : t.pending}
                    />
                    <StatRow
                      label={t.clvValue}
                      value={
                        bet.clv == null
                          ? t.pending
                          : `${bet.clv > 0 ? "+" : ""}${bet.clv.toFixed(2)}%`
                      }
                    />
                  </div>

                  <div style={styles.clvInputRow}>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={t.closingOdds}
                      value={closingOddsInputs[bet.id] || ""}
                      onChange={(e) =>
                        setClosingOddsInputs((prev) => ({
                          ...prev,
                          [bet.id]: e.target.value,
                        }))
                      }
                      style={styles.input}
                    />

                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() => saveClosingOdds(bet.id)}
                    >
                      {t.saveClosingOdds}
                    </button>

                    <button
                      type="button"
                      style={styles.dangerButton}
                      onClick={() => removeTrackedBet(bet.id)}
                    >
                      {t.remove}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title={t.feedback}>
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
        </SectionCard>

        <SectionCard
          title={t.debugTitle}
          rightSlot={
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setDebugOpen((v) => !v)}
            >
              {debugOpen ? t.hideDebug : t.showDebug}
            </button>
          }
        >
          {debugOpen ? (
            oddsDebug ? (
              <pre style={styles.debugBox}>
                {JSON.stringify(oddsDebug, null, 2)}
              </pre>
            ) : (
              <p style={styles.muted}>No debug data</p>
            )
          ) : (
            <p style={styles.muted}>Debug on piilotettu normaalikäytössä.</p>
          )}
        </SectionCard>

        {infoOpen ? (
          <div style={styles.modalOverlay} onClick={() => setInfoOpen(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>{t.info}</h3>
              <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>{t.infoText}</p>
              <button type="button" style={styles.button} onClick={() => setInfoOpen(false)}>
                {t.close}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, #07143c 0%, #020617 45%, #01030b 100%)",
    color: "#ffffff",
    padding: 16,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    maxWidth: 760,
    margin: "0 auto",
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    background: "#08183E",
    border: "1px solid #1e293b",
    borderRadius: 28,
    padding: 20,
    marginBottom: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  heroGlowOne: {
    position: "absolute",
    top: -50,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 999,
    background: "rgba(56,189,248,0.18)",
    filter: "blur(60px)",
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: -40,
    left: -20,
    width: 140,
    height: 140,
    borderRadius: 999,
    background: "rgba(37,99,235,0.18)",
    filter: "blur(60px)",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    position: "relative",
    zIndex: 1,
  },
  title: {
    fontSize: 52,
    lineHeight: 0.95,
    fontWeight: 900,
    margin: "0 0 12px 0",
    letterSpacing: "0.08em",
    fontFamily:
      '"Space Grotesk", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background: "linear-gradient(90deg, #ffffff, #93c5fd)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    margin: "0 0 6px 0",
    color: "#94a3b8",
    fontSize: 18,
    maxWidth: 560,
  },
  infoButton: {
    width: 48,
    height: 48,
    borderRadius: 999,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#fff",
    fontSize: 22,
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 4,
    flexShrink: 0,
  },
  card: {
    background: "rgba(15, 23, 42, 0.92)",
    border: "1px solid #1e293b",
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
    backdropFilter: "blur(10px)",
  },
  cardHeaderInline: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  cardTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 900,
  },
  cardSub: {
    margin: "8px 0 0 0",
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 1.5,
  },
  subTitle: {
    margin: "0 0 10px 0",
    fontSize: 18,
    fontWeight: 800,
  },
  muted: {
    color: "#94a3b8",
    fontSize: 16,
    margin: 0,
  },
  controlsGrid: {
    display: "grid",
    gap: 12,
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
    borderRadius: 16,
    border: "1px solid #334155",
    background: "#0b1730",
    color: "#ffffff",
    fontSize: 16,
    boxSizing: "border-box",
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    color: "#cbd5e1",
    fontSize: 15,
  },
  secondaryButton: {
    padding: "12px 16px",
    borderRadius: 14,
    background: "#1e293b",
    color: "#ffffff",
    border: "1px solid #334155",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
  },
  dangerButton: {
    padding: "12px 16px",
    borderRadius: 14,
    background: "#3b0a0a",
    color: "#ffffff",
    border: "1px solid #7f1d1d",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
  },
  stack: {
    display: "grid",
    gap: 10,
  },
  rowCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 16px",
    border: "1px solid #22304a",
    borderRadius: 16,
    background: "#0b1730",
  },
  linkButton: {
    display: "inline-block",
    marginTop: 14,
    padding: "14px 20px",
    borderRadius: 16,
    background: "#16a34a",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 17,
  },
  topPickCard: {
    padding: 14,
    borderRadius: 18,
    background: "#13203d",
    border: "1px solid #334155",
  },
  topPickLeague: {
    fontSize: 13,
    fontWeight: 700,
    color: "#93c5fd",
    marginBottom: 8,
  },
  topPickMatch: {
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.3,
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
    borderRadius: 14,
    padding: "12px 14px",
    textTransform: "capitalize",
  },
  dayGames: {
    display: "grid",
    gap: 12,
  },
  gameCard: {
    padding: 18,
    borderRadius: 18,
    background: "#13203d",
    color: "#fff",
    textAlign: "left",
    cursor: "pointer",
  },
  gameTitleText: {
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.3,
  },
  gameDate: {
    marginTop: 8,
    color: "#94a3b8",
    fontSize: 14,
  },
  gameOddsPreview: {
    marginTop: 6,
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 1.5,
  },
  analysisBox: {
    padding: 16,
    background: "#13203d",
    borderRadius: 20,
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
    fontWeight: 900,
  },
  legacyCard: {
    border: "1px solid #334155",
    borderRadius: 18,
    padding: 14,
    background: "#101827",
  },
  topAiCard: {
    borderRadius: 18,
    padding: 14,
  },
  topAiHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  topAiRank: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "#0b1730",
    border: "1px solid #334155",
    fontWeight: 900,
  },
  topAiOutcome: {
    fontSize: 20,
    fontWeight: 900,
    flex: 1,
  },
  confidenceBadge: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "#1d4ed8",
    color: "#fff",
    fontWeight: 900,
    fontSize: 14,
  },
  parsedText: {
    marginTop: 10,
    color: "#cbd5e1",
    fontSize: 16,
  },
  textarea: {
    width: "100%",
    minHeight: 140,
    padding: "14px 16px",
    borderRadius: 18,
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
    borderRadius: 16,
    background: "#16a34a",
    color: "#ffffff",
    border: "none",
    fontSize: 18,
    fontWeight: 800,
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
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 50,
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 24,
    padding: 22,
  },
  sourceBadge: {
    padding: "8px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
    border: "1px solid",
    whiteSpace: "nowrap",
  },
  sourceBadgeLive: {
    background: "#052e16",
    color: "#86efac",
    borderColor: "#166534",
  },
  sourceBadgeCache: {
    background: "#1e293b",
    color: "#93c5fd",
    borderColor: "#334155",
  },
  sourceBadgeDemo: {
    background: "#3f1d1d",
    color: "#fca5a5",
    borderColor: "#7f1d1d",
  },
  sourceBadgeEmpty: {
    background: "#3b2a00",
    color: "#facc15",
    borderColor: "#8b5e00",
  },
  transparentBox: {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    background: "#111827",
    border: "1px solid #334155",
  },
  transparentTitle: {
    fontSize: 16,
    fontWeight: 900,
    marginBottom: 8,
  },
  transparentText: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.6,
    fontSize: 15,
  },
  details: {
    marginTop: 14,
    border: "1px solid #334155",
    borderRadius: 16,
    background: "#0b1730",
    overflow: "hidden",
  },
  summary: {
    cursor: "pointer",
    padding: "14px 16px",
    fontWeight: 800,
    color: "#fff",
  },
  detailsContent: {
    padding: "0 16px 16px 16px",
    display: "grid",
    gap: 14,
  },
  noteText: {
    margin: "0 0 14px 0",
    color: "#94a3b8",
    fontSize: 14,
  },
  warningBox: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    background: "#3b0a0a",
    border: "1px solid #7f1d1d",
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#fecaca",
    marginBottom: 8,
  },
  warningText: {
    color: "#fee2e2",
    lineHeight: 1.6,
    fontSize: 15,
  },
  warningHint: {
    marginTop: 8,
    color: "#fca5a5",
    fontSize: 14,
  },
  debugBox: {
    marginTop: 6,
    padding: 12,
    borderRadius: 14,
    background: "#111827",
    border: "1px solid #334155",
    color: "#93c5fd",
    fontSize: 12,
    overflowX: "auto",
  },
  trackTitle: {
    fontSize: 18,
    fontWeight: 900,
    marginBottom: 6,
  },
  trackSub: {
    color: "#94a3b8",
    marginBottom: 12,
  },
  clvInputRow: {
    display: "grid",
    gap: 10,
    marginTop: 12,
  },
};
