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
    calcExplainerTitle: "Miten tämä laskettiin?",
    calcExplainer1:
      "Markkinan todennäköisyys saadaan parhaasta kertoimesta kaavalla 1 / kerroin.",
    calcExplainer2:
      "Mallin todennäköisyys on Scorecasterin oma arvio kohteen voittomahdollisuudesta.",
    calcExplainer3:
      "Jos mallin arvio on korkeampi kuin markkinan arvio, kohteessa voi olla valuea.",
    calcExplainer4:
      "Odotusarvo kertoo, onko veto pitkällä aikavälillä teoriassa plussalla vai miinuksella.",
    calcExplainer5:
      "Quarter Kelly antaa varovaisemman panossuosituksen kuin täysi Kelly.",
    simpleMeaningPositive:
      "Malli pitää tätä kohdetta hieman markkinaa parempana, joten veto voi olla pelikelpoinen.",
    simpleMeaningNeutral:
      "Mallin ja markkinan arviot ovat lähellä toisiaan, joten etu on pieni.",
    simpleMeaningNegative:
      "Markkina hinnoittelee tämän kohteen vähintään yhtä hyväksi kuin malli, joten etu on heikko.",
    rawNumbers: "Luvut auki",
    impliedFormula: "Markkinan todennäköisyys = 1 / kerroin",
    edgeFormula: "Edge = mallin todennäköisyys - markkinan todennäköisyys",
    evFormula: "Odotusarvo = (kerroin × mallin todennäköisyys) - 1",
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
    backendModel: "Backend-malli",
    backendAnalysisFailed: "Backend-analyysiä ei saatu haettua.",
    noClearValue: "Selkeää value-kohdetta ei löytynyt.",
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
    calcExplainerTitle: "How was this calculated?",
    calcExplainer1:
      "Market probability comes from the best available odds using the formula 1 / odds.",
    calcExplainer2:
      "Model probability is Scorecaster's own estimate of this outcome winning.",
    calcExplainer3:
      "If the model estimate is higher than the market estimate, the pick may contain value.",
    calcExplainer4:
      "Expected value tells whether the bet is theoretically positive or negative over the long run.",
    calcExplainer5:
      "Quarter Kelly gives a more conservative stake suggestion than full Kelly.",
    simpleMeaningPositive:
      "The model rates this outcome slightly better than the market does, so it may be playable.",
    simpleMeaningNeutral:
      "The model and market are close to each other, so the edge is small.",
    simpleMeaningNegative:
      "The market prices this outcome at least as well as the model, so the edge is weak.",
    rawNumbers: "Open the numbers",
    impliedFormula: "Market probability = 1 / odds",
    edgeFormula: "Edge = model probability - market probability",
    evFormula: "Expected value = (odds × model probability) - 1",
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
    backendModel: "Backend model",
    backendAnalysisFailed: "Backend analysis could not be loaded.",
    noClearValue: "No clear value bet found.",
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

function getMeaningText(bestBet, t) {
  if (!bestBet) return "";
  if (bestBet.edge > 0.025 && bestBet.ev > 0) return t.simpleMeaningPositive;
  if (bestBet.edge > 0 && bestBet.ev >= 0) return t.simpleMeaningNeutral;
  return t.simpleMeaningNegative;
}

function getSourceMeta(source, t) {
  if (source === "live") {
    return {
      label: t.sourceLive,
      tone: "live",
      description: t.liveMessage,
    };
  }

  if (source === "cache" || source === "cache_fallback") {
    return {
      label: source === "cache" ? t.sourceCache : t.sourceCacheFallback,
      tone: "cache",
      description: t.cacheMessage,
    };
  }

  if (source === "demo") {
    return {
      label: t.sourceDemo,
      tone: "demo",
      description: t.demoMessage,
    };
  }

  return {
    label: t.sourceEmpty,
    tone: "empty",
    description: "",
  };
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
    async function loadGames() {
      if (!selectedLeague) {
        setGames([]);
        setSelectedGameId("");
        setLoading(false);
        setOddsSource("empty");
        setOddsEmpty(true);
        setQuotaExceeded(false);
        setOddsMessage("");
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
      } catch {
        setGames([]);
        setOddsSource("empty");
        setOddsEmpty(true);
        setQuotaExceeded(false);
        setOddsMessage("");
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

      return true;
    });
  }, [topPicks, minEdge, minOdds, maxOdds, positiveEvOnly]);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const valueBet = getValueBet(game);
      if (!valueBet) return false;

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
  }, [selectedGame, oddsEmpty, t.backendAnalysisFailed]);

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

  const showQuotaWarning = !loading && quotaExceeded && oddsEmpty;
  const showEmptyWarning = !loading && oddsEmpty && !quotaExceeded;

  const recommendedSide = analysisData?.analysis?.recommendedSide || null;
  const recommendedOutcomeLabel =
    recommendedSide === "home"
      ? selectedGame?.home_team
      : recommendedSide === "away"
      ? selectedGame?.away_team
      : null;

  const recommendedModelProbability =
    recommendedSide === "home"
      ? analysisData?.analysis?.homeWinProbability
      : recommendedSide === "away"
      ? analysisData?.analysis?.awayWinProbability
      : null;

  const recommendedMarketProbability =
    recommendedSide === "home"
      ? analysisData?.analysis?.marketHomeProbability
      : recommendedSide === "away"
      ? analysisData?.analysis?.marketAwayProbability
      : null;

  const recommendedOdds =
    recommendedSide === "home"
      ? analysisData?.analysis?.bestHomeOdds
      : recommendedSide === "away"
      ? analysisData?.analysis?.bestAwayOdds
      : null;

  const recommendedEdge =
    recommendedSide === "home"
      ? analysisData?.analysis?.edgeHome
      : recommendedSide === "away"
      ? analysisData?.analysis?.edgeAway
      : null;

  const recommendedEv =
    recommendedSide === "home"
      ? analysisData?.analysis?.evHome
      : recommendedSide === "away"
      ? analysisData?.analysis?.evAway
      : null;

  const recommendedKelly =
    recommendedSide === "home"
      ? analysisData?.analysis?.kellyHome
      : recommendedSide === "away"
      ? analysisData?.analysis?.kellyAway
      : null;

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

        <section style={styles.card}>
          <div style={styles.cardHeaderInline}>
            <div>
              <h2 style={styles.cardTitle}>{t.simulatorPreview}</h2>
              <p style={styles.cardSub}>{t.simulatorPreviewSub}</p>
            </div>
            <div style={{ ...styles.sourceBadge, ...styles.sourceBadgeCache }}>
              Preview
            </div>
          </div>

          {simLoading && <p style={styles.muted}>{t.loading}</p>}

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

          <Link href="/simulator" style={styles.linkButton}>
            {t.openSimulator}
          </Link>
        </section>

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

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>{t.filters}</h2>

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
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>{t.topPicks}</h2>

          {topPicksLoading && <p style={styles.muted}>{t.loading}</p>}
          {!topPicksLoading && filteredTopPicks.length === 0 && (
            <p style={styles.muted}>{t.topPicksEmpty}</p>
          )}

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
                    <div style={styles.rowCard}>
                      <span>{t.outcome}</span>
                      <strong>{pick.outcome}</strong>
                    </div>
                    <div style={styles.rowCard}>
                      <span>{t.odds}</span>
                      <strong>{pick.odds}</strong>
                    </div>
                    <div style={styles.rowCard}>
                      <span>{t.bookmaker}</span>
                      <strong>{pick.bookmaker}</strong>
                    </div>
                    <div style={styles.rowCard}>
                      <span>{t.edge}</span>
                      <strong>{(pick.edge * 100).toFixed(2)}%</strong>
                    </div>
                    <div style={styles.rowCard}>
                      <span>{t.expectedValue}</span>
                      <strong>{(pick.ev * 100).toFixed(2)}%</strong>
                    </div>
                    <div style={styles.rowCard}>
                      <span>{t.suggestedStake}</span>
                      <strong>
                        {getStakeFromKelly(bankroll, pick.kelly, 0.25).toFixed(2)} €
                      </strong>
                    </div>
                  </div>
                </details>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeaderInline}>
            <h2 style={styles.cardTitle}>{t.games}</h2>
            <div
              style={{
                ...styles.sourceBadge,
                ...(sourceMeta.tone === "live"
                  ? styles.sourceBadgeLive
                  : sourceMeta.tone === "cache"
                  ? styles.sourceBadgeCache
                  : sourceMeta.tone === "demo"
                  ? styles.sourceBadgeDemo
                  : styles.sourceBadgeEmpty),
              }}
            >
              {t.sourceLabel}: {sourceMeta.label}
            </div>
          </div>

          {sourceMeta.description ? (
            <p style={styles.noteText}>{sourceMeta.description}</p>
          ) : null}

          {oddsMessage ? <p style={styles.noteText}>{oddsMessage}</p> : null}

          {showQuotaWarning && (
            <WarningBox
              title={t.quotaTitle}
              message={t.quotaMessage}
              hint={t.refreshHint}
            />
          )}

          {showEmptyWarning && (
            <WarningBox
              title={t.emptyTitle}
              message={t.emptyMessage}
              hint={t.refreshHint}
            />
          )}

          {loading && <p style={styles.muted}>{t.loading}</p>}

          {!loading && !oddsEmpty && filteredGames.length === 0 && (
            <p style={styles.muted}>{t.noGames}</p>
          )}

          {!oddsEmpty && (
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
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeaderInline}>
            <h2 style={styles.cardTitle}>{t.analysis}</h2>
            <div
              style={{
                ...styles.sourceBadge,
                ...(sourceMeta.tone === "live"
                  ? styles.sourceBadgeLive
                  : sourceMeta.tone === "cache"
                  ? styles.sourceBadgeCache
                  : sourceMeta.tone === "demo"
                  ? styles.sourceBadgeDemo
                  : styles.sourceBadgeEmpty),
              }}
            >
              {sourceMeta.label}
            </div>
          </div>

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
                <div style={styles.subTitle}>
                  {t.bestBet} · {t.backendModel}
                </div>

                {analysisLoading ? (
                  <div style={styles.muted}>{t.loading}</div>
                ) : analysisError ? (
                  <WarningBox
                    title={t.bestBet}
                    message={analysisError}
                    hint={t.noteLiveVsDemo}
                  />
                ) : !analysisData?.analysis ? (
                  <div style={styles.muted}>{t.noOdds}</div>
                ) : (
                  <>
                    <div style={styles.transparentBox}>
                      <div style={styles.transparentTitle}>{t.whyThisBet}</div>
                      <p style={styles.transparentText}>
                        {recommendedSide === "home"
                          ? `${selectedGame.home_team} näyttää mallin mukaan markkinaa paremmalta kohteelta.`
                          : recommendedSide === "away"
                          ? `${selectedGame.away_team} näyttää mallin mukaan markkinaa paremmalta kohteelta.`
                          : t.noClearValue}
                      </p>
                    </div>

                    <div style={styles.greenCard}>
                      <div style={styles.stack}>
                        <div style={styles.rowCard}>
                          <span>{t.outcome}</span>
                          <strong>{recommendedOutcomeLabel || "-"}</strong>
                        </div>
                        <div style={styles.rowCard}>
                          <span>{t.probability}</span>
                          <strong>
                            {recommendedModelProbability != null
                              ? `${(recommendedModelProbability * 100).toFixed(1)}%`
                              : "-"}
                          </strong>
                        </div>
                        <div style={styles.rowCard}>
                          <span>{t.marketProbability}</span>
                          <strong>
                            {recommendedMarketProbability != null
                              ? `${(recommendedMarketProbability * 100).toFixed(1)}%`
                              : "-"}
                          </strong>
                        </div>
                        <div style={styles.rowCard}>
                          <span>{t.odds}</span>
                          <strong>
                            {recommendedOdds != null
                              ? recommendedOdds.toFixed(2)
                              : "-"}
                          </strong>
                        </div>
                        <div style={styles.rowCard}>
                          <span>{t.edge}</span>
                          <strong>
                            {recommendedEdge != null
                              ? `${(recommendedEdge * 100).toFixed(2)}%`
                              : "-"}
                          </strong>
                        </div>
                        <div style={styles.rowCard}>
                          <span>{t.expectedValue}</span>
                          <strong>
                            {recommendedEv != null
                              ? `${(recommendedEv * 100).toFixed(2)}%`
                              : "-"}
                          </strong>
                        </div>
                        <div style={styles.rowCard}>
                          <span>{t.quarterKelly}</span>
                          <strong>
                            {recommendedKelly != null
                              ? `${(recommendedKelly * 0.25 * 100).toFixed(2)}%`
                              : "-"}
                          </strong>
                        </div>
                        <div style={styles.rowCard}>
                          <span>{t.suggestedStake}</span>
                          <strong>
                            {recommendedKelly != null
                              ? `${(bankroll * recommendedKelly * 0.25).toFixed(2)} €`
                              : "-"}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <details style={styles.details}>
                      <summary style={styles.summary}>{t.calcDetails}</summary>
                      <div style={styles.detailsContent}>
                        <div style={styles.calcBox}>
                          <div style={styles.calcTitle}>{t.calcExplainerTitle}</div>
                          <ul style={styles.calcList}>
                            <li>{t.calcExplainer1}</li>
                            <li>{t.calcExplainer2}</li>
                            <li>{t.calcExplainer3}</li>
                            <li>{t.calcExplainer4}</li>
                            <li>{t.calcExplainer5}</li>
                          </ul>
                        </div>

                        {recommendedSide ? (
                          <div style={styles.calcBox}>
                            <div style={styles.calcTitle}>{t.rawNumbers}</div>
                            <div style={styles.formulaLine}>
                              {t.impliedFormula}:{" "}
                              <strong>
                                1 / {recommendedOdds?.toFixed(2)} ={" "}
                                {((recommendedMarketProbability || 0) * 100).toFixed(2)}%
                              </strong>
                            </div>
                            <div style={styles.formulaLine}>
                              {t.edgeFormula}:{" "}
                              <strong>
                                {((recommendedModelProbability || 0) * 100).toFixed(2)}% -{" "}
                                {((recommendedMarketProbability || 0) * 100).toFixed(2)}% ={" "}
                                {((recommendedEdge || 0) * 100).toFixed(2)}%
                              </strong>
                            </div>
                            <div style={styles.formulaLine}>
                              {t.evFormula}:{" "}
                              <strong>
                                ({recommendedOdds?.toFixed(2)} ×{" "}
                                {(recommendedModelProbability || 0).toFixed(4)}) - 1 ={" "}
                                {((recommendedEv || 0) * 100).toFixed(2)}%
                              </strong>
                            </div>
                          </div>
                        ) : (
                          <div style={styles.calcBox}>
                            <div style={styles.calcTitle}>{t.rawNumbers}</div>
                            <div style={styles.formulaLine}>{t.noClearValue}</div>
                          </div>
                        )}
                      </div>
                    </details>
                  </>
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={styles.subTitle}>{t.bestBet} · Legacy</div>

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
                  </>
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
    marginTop: 14,
    padding: "12px 16px",
    borderRadius: 12,
    background: "#1e293b",
    color: "#ffffff",
    border: "1px solid #334155",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  card: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  cardHeaderInline: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  cardTitle: {
    margin: "0 0 10px 0",
    fontSize: 24,
    fontWeight: 800,
  },
  cardSub: {
    margin: "0 0 16px 0",
    color: "#94a3b8",
    fontSize: 14,
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
  linkButton: {
    display: "inline-block",
    marginTop: 14,
    padding: "12px 16px",
    borderRadius: 12,
    background: "#16a34a",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 800,
  },
  topPickCard: {
    padding: 14,
    borderRadius: 16,
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
  gameTitleText: {
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
  greenCard: {
    border: "1px solid #166534",
    borderRadius: 16,
    padding: 14,
    background: "#0d1f18",
  },
  legacyCard: {
    border: "1px solid #334155",
    borderRadius: 16,
    padding: 14,
    background: "#101827",
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
  sourceBadge: {
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
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
    padding: 14,
    borderRadius: 14,
    background: "#111827",
    border: "1px solid #334155",
  },
  transparentTitle: {
    fontSize: 16,
    fontWeight: 800,
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
    borderRadius: 14,
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
  calcBox: {
    border: "1px solid #334155",
    borderRadius: 14,
    padding: 14,
    background: "#111827",
  },
  calcTitle: {
    fontSize: 16,
    fontWeight: 800,
    marginBottom: 8,
  },
  calcList: {
    margin: 0,
    paddingLeft: 18,
    color: "#cbd5e1",
    lineHeight: 1.7,
  },
  formulaLine: {
    color: "#cbd5e1",
    lineHeight: 1.7,
    marginBottom: 8,
  },
  noteText: {
    margin: "0 0 14px 0",
    color: "#94a3b8",
    fontSize: 14,
  },
  warningBox: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    background: "#3b0a0a",
    border: "1px solid #7f1d1d",
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 800,
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
};
