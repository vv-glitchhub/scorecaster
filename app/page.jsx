"use client";

import { useEffect, useMemo, useState } from "react";

const TEXT = {
  fi: {
    title: "SCORECASTER",
    subtitle: "Vedonlyönnin analyysi- ja oddsinäkymä",
    language: "Kieli",
    sportGroup: "Laji",
    league: "Liiga",
    loading: "Ladataan otteluita...",
    failedToLoad: "Otteluiden lataus epäonnistui",
    fallbackBanner: "Näytetään fallback-dataa, koska API-quota on ylittynyt",
    sportsFallbackBanner: "Lajilista käyttää fallback-dataa",
    noGames: "Otteluita ei löytynyt",
    bestOdds: "Parhaat kertoimet",
    analysis: "Analyysi",
    stats: "Tilastot",
    draw: "Tasapeli",
    homeWin: "Kotivoitto",
    awayWin: "Vierasvoitto",
    bookmaker: "Vedonvälittäjä",
    bankrollTitle: "Bankroll Management",
    bankroll: "Bankroll (€)",
    kellyMode: "Kelly mode",
    stakeSuggestion: "Panossuositus",
    tracker: "Bet result tracker",
    betHistory: "Bet history",
    totalStaked: "Yhteensä panostettu",
    totalProfit: "Yhteensä voitto",
    roi: "ROI",
    markWin: "Merkitse win",
    markLose: "Merkitse lose",
    markVoid: "Merkitse void",
    quarterKelly: "Quarter Kelly",
    halfKelly: "Half Kelly",
    fullKelly: "Full Kelly",
    outcome: "Kohde",
    odds: "Kerroin",
    probability: "Todennäköisyys",
    ev: "EV",
    kellyFraction: "Kelly-osuus",
    suggestedStake: "Suositeltu panos",
    pickGame: "Valitse ottelu nähdäksesi analyysin",
    noBookmakerOdds: "Bookmaker-kertoimia ei saatavilla",
    status: "Status",
    profit: "Voitto",
    stake: "Panos",
    parsedBankroll: "Tulkittu bankroll",
    feedback: "Palaute",
    feedbackPlaceholder: "Kirjoita palaute...",
    feedbackEmail: "Sähköposti (valinnainen)",
    sendFeedback: "Lähetä palaute",
    sending: "Lähetetään...",
    sent: "✅ Lähetetty",
    sendFailed: "❌ Lähetys epäonnistui",
  },
  en: {
    title: "SCORECASTER",
    subtitle: "Betting analysis and odds dashboard",
    language: "Language",
    sportGroup: "Sport",
    league: "League",
    loading: "Loading games...",
    failedToLoad: "Failed to load games",
    fallbackBanner: "Showing fallback data because API quota is exceeded",
    sportsFallbackBanner: "Sports list is using fallback data",
    noGames: "No games found",
    bestOdds: "Best odds",
    analysis: "Analysis",
    stats: "Stats",
    draw: "Draw",
    homeWin: "Home win",
    awayWin: "Away win",
    bookmaker: "Bookmaker",
    bankrollTitle: "Bankroll Management",
    bankroll: "Bankroll (€)",
    kellyMode: "Kelly mode",
    stakeSuggestion: "Stake suggestion",
    tracker: "Bet result tracker",
    betHistory: "Bet history",
    totalStaked: "Total staked",
    totalProfit: "Total profit",
    roi: "ROI",
    markWin: "Mark win",
    markLose: "Mark lose",
    markVoid: "Mark void",
    quarterKelly: "Quarter Kelly",
    halfKelly: "Half Kelly",
    fullKelly: "Full Kelly",
    outcome: "Outcome",
    odds: "Odds",
    probability: "Probability",
    ev: "EV",
    kellyFraction: "Kelly fraction",
    suggestedStake: "Suggested stake",
    pickGame: "Select a game to see analysis",
    noBookmakerOdds: "No bookmaker odds available",
    status: "Status",
    profit: "Profit",
    stake: "Stake",
    parsedBankroll: "Parsed bankroll",
    feedback: "Feedback",
    feedbackPlaceholder: "Write feedback...",
    feedbackEmail: "Email (optional)",
    sendFeedback: "Send feedback",
    sending: "Sending...",
    sent: "✅ Sent",
    sendFailed: "❌ Failed to send",
  },
};

const GROUP_LABELS = {
  fi: {
    "Ice Hockey": "Jääkiekko",
    Basketball: "Koripallo",
    Soccer: "Jalkapallo",
    Baseball: "Baseball",
    "American Football": "Jenkkifutis",
    AmericanFootball: "Jenkkifutis",
    MMA: "Vapaaottelu",
  },
  en: {},
};

const LEAGUE_LABELS = {
  fi: {
    NHL: "NHL",
    NBA: "NBA",
    "Premier League": "Valioliiga",
    EPL: "Valioliiga",
    Allsvenskan: "Allsvenskan",
    Liiga: "Liiga",
    Veikkausliiga: "Veikkausliiga",
    LaLiga: "La Liga",
    "La Liga": "La Liga",
    Bundesliga: "Bundesliiga",
    SerieA: "Serie A",
    "Serie A": "Serie A",
  },
  en: {},
};

function translateGroupLabel(group, lang) {
  return GROUP_LABELS[lang]?.[group] || group;
}

function translateLeagueLabel(title, lang) {
  return LEAGUE_LABELS[lang]?.[title] || title;
}

function decimalProb(percent) {
  return Number(percent || 0) / 100;
}

function kellyFraction(prob, odds) {
  const p = Number(prob || 0);
  const o = Number(odds || 0);

  if (p <= 0 || o <= 1) return 0;

  const b = o - 1;
  const q = 1 - p;
  const kelly = (b * p - q) / b;

  return Math.max(0, kelly);
}

function getKellyMultiplier(riskMode) {
  if (riskMode === "full") return 1;
  if (riskMode === "half") return 0.5;
  return 0.25;
}

function calculateStake(probPercent, odds, bankroll, riskMode = "quarter") {
  const prob = decimalProb(probPercent);
  const rawKelly = kellyFraction(prob, odds);
  const adjustedKelly = rawKelly * getKellyMultiplier(riskMode);
  const stake = Number(bankroll || 0) * adjustedKelly;

  return {
    rawKelly,
    adjustedKelly,
    stake: Math.max(0, stake),
  };
}

function normalizeGames(apiGames) {
  if (!Array.isArray(apiGames)) return [];

  return apiGames.map((game, index) => ({
    id:
      game.id ||
      `${game.home_team || "home"}-${game.away_team || "away"}-${game.commence_time || index}`,
    home: game.home_team || "Home",
    away: game.away_team || "Away",
    sportKey: game.sport_key || "",
    commenceTime: game.commence_time || null,
    bookmakers: Array.isArray(game.bookmakers) ? game.bookmakers : [],
  }));
}

function getBestOdds(game, t) {
  if (!game || !Array.isArray(game.bookmakers)) return [];

  const best = {};

  game.bookmakers.forEach((bookmaker) => {
    const h2hMarket = bookmaker?.markets?.find((market) => market.key === "h2h");
    if (!h2hMarket?.outcomes) return;

    h2hMarket.outcomes.forEach((outcome) => {
      const key = outcome.name;
      const price = Number(outcome.price);

      if (!best[key] || price > best[key].price) {
        best[key] = {
          name: outcome.name,
          price,
          bookmaker: bookmaker.title || "-",
        };
      }
    });
  });

  return [
    best[game.home],
    best.Draw ? { ...best.Draw, name: t.draw } : null,
    best[game.away],
  ].filter(Boolean);
}

function getDefaultProbs(game, t) {
  const bestOdds = getBestOdds(game, t);

  const homeOdds = bestOdds.find((o) => o.name === game.home)?.price;
  const awayOdds = bestOdds.find((o) => o.name === game.away)?.price;
  const drawOdds = bestOdds.find((o) => o.name === t.draw)?.price;

  const probs = [
    homeOdds ? 1 / homeOdds : 0,
    drawOdds ? 1 / drawOdds : 0,
    awayOdds ? 1 / awayOdds : 0,
  ];

  const total = probs.reduce((sum, p) => sum + p, 0);

  if (total <= 0) {
    return {
      homeWinProb: 50,
      drawProb: 0,
      awayWinProb: 50,
    };
  }

  return {
    homeWinProb: Number(((probs[0] / total) * 100).toFixed(1)),
    drawProb: Number(((probs[1] / total) * 100).toFixed(1)),
    awayWinProb: Number(((probs[2] / total) * 100).toFixed(1)),
  };
}

function getBestBetFromGame(game, t) {
  if (!game) return null;

  const oddsList = getBestOdds(game, t);
  const probs = getDefaultProbs(game, t);

  const homeOdds = oddsList.find((o) => o.name === game.home)?.price || 0;
  const awayOdds = oddsList.find((o) => o.name === game.away)?.price || 0;
  const drawOdds = oddsList.find((o) => o.name === t.draw)?.price || 0;

  const options = [
    {
      outcome: game.home,
      probPercent: Number(probs.homeWinProb || 0),
      odds: Number(homeOdds || 0),
      bookmaker: oddsList.find((o) => o.name === game.home)?.bookmaker || "-",
    },
    {
      outcome: t.draw,
      probPercent: Number(probs.drawProb || 0),
      odds: Number(drawOdds || 0),
      bookmaker: oddsList.find((o) => o.name === t.draw)?.bookmaker || "-",
    },
    {
      outcome: game.away,
      probPercent: Number(probs.awayWinProb || 0),
      odds: Number(awayOdds || 0),
      bookmaker: oddsList.find((o) => o.name === game.away)?.bookmaker || "-",
    },
  ]
    .filter((o) => o.odds > 1)
    .map((o) => ({
      ...o,
      ev: decimalProb(o.probPercent) * o.odds,
    }))
    .sort((a, b) => b.ev - a.ev);

  return options[0] || null;
}

function formatDate(dateString) {
  if (!dateString) return "-";

  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
}

export default function Page() {
  const [sports, setSports] = useState([]);
  const [sportsFallback, setSportsFallback] = useState(false);

  const [lang, setLang] = useState("fi");
  const t = TEXT[lang];

  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedSportKey, setSelectedSportKey] = useState("");

  const [games, setGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [bankrollInput, setBankrollInput] = useState("1000");
  const [riskMode, setRiskMode] = useState("quarter");
  const [betHistory, setBetHistory] = useState([]);

  const [feedback, setFeedback] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");

  const bankroll = useMemo(() => {
    const normalized = bankrollInput.replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [bankrollInput]);

  useEffect(() => {
    async function loadSports() {
      try {
        const res = await fetch("/api/sports");
        if (!res.ok) throw new Error("Failed to fetch sports");

        const json = await res.json();
        const sportsData = Array.isArray(json.data) ? json.data : [];

        setSports(sportsData);
        setSportsFallback(Boolean(json.fallback));

        const firstGroup = sportsData[0]?.group || "";
        const firstLeague = sportsData[0]?.key || "";

        setSelectedGroup(firstGroup);
        setSelectedSportKey(firstLeague);
      } catch {
        const fallbackSports = [
          { key: "icehockey_nhl", group: "Ice Hockey", title: "NHL" },
          { key: "icehockey_liiga", group: "Ice Hockey", title: "Liiga" },
          { key: "basketball_nba", group: "Basketball", title: "NBA" },
          { key: "soccer_epl", group: "Soccer", title: "Premier League" },
        ];

        setSports(fallbackSports);
        setSportsFallback(true);
        setSelectedGroup(fallbackSports[0].group);
        setSelectedSportKey(fallbackSports[0].key);
      }
    }

    loadSports();
  }, []);

  const sportGroups = useMemo(() => {
    return [...new Set(sports.map((sport) => sport.group).filter(Boolean))];
  }, [sports]);

  const leaguesForSelectedGroup = useMemo(() => {
    return sports.filter((sport) => sport.group === selectedGroup);
  }, [sports, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup && sportGroups.length > 0) {
      setSelectedGroup(sportGroups[0]);
      return;
    }

    if (leaguesForSelectedGroup.length > 0) {
      const exists = leaguesForSelectedGroup.some((league) => league.key === selectedSportKey);
      if (!exists) {
        setSelectedSportKey(leaguesForSelectedGroup[0].key);
      }
    } else {
      setSelectedSportKey("");
    }
  }, [selectedGroup, leaguesForSelectedGroup, selectedSportKey, sportGroups]);

  useEffect(() => {
    async function loadOdds() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/odds?sport=${selectedSportKey}`);
        if (!res.ok) throw new Error("Failed to fetch odds");

        const json = await res.json();
        const normalized = normalizeGames(json.data || []);

        setGames(normalized);
        setFallback(Boolean(json.fallback));
        setSelectedGameId((prev) => {
          const exists = normalized.some((g) => g.id === prev);
          return exists ? prev : normalized[0]?.id || "";
        });
      } catch {
        setError(t.failedToLoad);
        setGames([]);
        setFallback(false);
      } finally {
        setLoading(false);
      }
    }

    if (selectedSportKey) {
      loadOdds();
    } else {
      setGames([]);
      setSelectedGameId("");
      setLoading(false);
    }
  }, [selectedSportKey, t.failedToLoad]);

  const selectedGame = useMemo(
    () => games.find((g) => g.id === selectedGameId) || null,
    [games, selectedGameId]
  );

  const bestOdds = useMemo(
    () => (selectedGame ? getBestOdds(selectedGame, t) : []),
    [selectedGame, t]
  );

  const derivedResult = useMemo(
    () => (selectedGame ? getDefaultProbs(selectedGame, t) : null),
    [selectedGame, t]
  );

  const bestCalculatedBet = useMemo(
    () => (selectedGame ? getBestBetFromGame(selectedGame, t) : null),
    [selectedGame, t]
  );

  const stakeInfo = useMemo(() => {
    if (!bestCalculatedBet) return null;

    return calculateStake(
      bestCalculatedBet.probPercent,
      bestCalculatedBet.odds,
      bankroll,
      riskMode
    );
  }, [bestCalculatedBet, bankroll, riskMode]);

  async function sendFeedback() {
    try {
      setFeedbackStatus(t.sending);

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: feedback,
          email: feedbackEmail,
          selectedSportKey,
          selectedGroup,
          selectedGame,
          bankroll,
        }),
      });

      if (!res.ok) throw new Error();

      setFeedback("");
      setFeedbackEmail("");
      setFeedbackStatus(t.sent);
    } catch {
      setFeedbackStatus(t.sendFailed);
    }
  }

  function addBetResult(status) {
    if (!bestCalculatedBet || !stakeInfo) return;

    const stake = stakeInfo.stake;
    let profit = 0;

    if (status === "win") {
      profit = stake * (bestCalculatedBet.odds - 1);
    } else if (status === "lose") {
      profit = -stake;
    }

    const record = {
      id: Date.now(),
      outcome: bestCalculatedBet.outcome,
      odds: bestCalculatedBet.odds,
      stake,
      status,
      profit,
    };

    setBetHistory((prev) => [record, ...prev]);
    setBankrollInput((prev) => {
      const current = Number(prev.replace(",", ".")) || 0;
      return String(Number((current + profit).toFixed(2)));
    });
  }

  const totalStaked = betHistory.reduce((sum, bet) => sum + bet.stake, 0);
  const totalProfit = betHistory.reduce((sum, bet) => sum + bet.profit, 0);
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>{t.title}</h1>
            <div style={styles.subtitle}>{t.subtitle}</div>
          </div>

          <div style={styles.filters}>
            <div style={styles.fieldWrap}>
              <div style={styles.label}>{t.language}</div>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                style={styles.select}
              >
                <option value="fi">Suomi</option>
                <option value="en">English</option>
              </select>
            </div>

            <div style={styles.fieldWrap}>
              <div style={styles.label}>{t.sportGroup}</div>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                style={styles.select}
              >
                {sportGroups.map((group) => (
                  <option key={group} value={group}>
                    {translateGroupLabel(group, lang)}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.fieldWrap}>
              <div style={styles.label}>{t.league}</div>
              <select
                value={selectedSportKey}
                onChange={(e) => setSelectedSportKey(e.target.value)}
                style={styles.select}
              >
                {leaguesForSelectedGroup.map((league) => (
                  <option key={league.key} value={league.key}>
                    {translateLeagueLabel(league.title || league.key, lang)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {sportsFallback && <div style={styles.infoBanner}>{t.sportsFallbackBanner}</div>}
        {fallback && <div style={styles.warnBanner}>⚠ {t.fallbackBanner}</div>}
        {error && <div style={styles.errorBanner}>{error}</div>}

        <section style={styles.stack}>
          <section style={styles.panel}>
            <div style={styles.sectionTitle}>{t.stats}</div>

            {loading ? (
              <div style={styles.muted}>{t.loading}</div>
            ) : games.length === 0 ? (
              <div style={styles.muted}>{t.noGames}</div>
            ) : (
              <div style={styles.gamesList}>
                {games.map((game) => {
                  const isSelected = game.id === selectedGameId;
                  const cardOdds = getBestOdds(game, t);

                  return (
                    <button
                      key={game.id}
                      onClick={() => setSelectedGameId(game.id)}
                      style={{
                        ...styles.gameCard,
                        background: isSelected ? "#1d4ed8" : "#1e3a8a",
                        border: isSelected ? "2px solid #22c55e" : "1px solid #3b82f6",
                      }}
                    >
                      <div style={styles.gameTitle}>
                        {game.home} vs {game.away}
                      </div>

                      <div style={styles.gameDate}>{formatDate(game.commenceTime)}</div>

                      <div style={styles.pills}>
                        {cardOdds.length > 0 ? (
                          cardOdds.map((odd) => (
                            <div key={`${game.id}-${odd.name}`} style={styles.pill}>
                              <strong>{odd.name}</strong>: {odd.price}{" "}
                              <span style={{ color: "#334155" }}>({odd.bookmaker})</span>
                            </div>
                          ))
                        ) : (
                          <div style={{ color: "#dbeafe" }}>{t.noBookmakerOdds}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionTitle}>{t.bankrollTitle}</div>

            <div style={styles.fieldWrap}>
              <div style={styles.label}>{t.bankroll}</div>
              <input
                type="text"
                inputMode="decimal"
                value={bankrollInput}
                onChange={(e) => setBankrollInput(e.target.value)}
                style={styles.input}
                placeholder="1000"
              />
            </div>

            <div style={styles.muted}>
              {t.parsedBankroll}: {bankroll.toFixed(2)} €
            </div>

            <div style={{ height: 12 }} />

            <div style={styles.fieldWrap}>
              <div style={styles.label}>{t.kellyMode}</div>
              <select
                value={riskMode}
                onChange={(e) => setRiskMode(e.target.value)}
                style={styles.select}
              >
                <option value="quarter">{t.quarterKelly}</option>
                <option value="half">{t.halfKelly}</option>
                <option value="full">{t.fullKelly}</option>
              </select>
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionTitle}>{t.analysis}</div>

            {!selectedGame ? (
              <div style={styles.muted}>{t.pickGame}</div>
            ) : (
              <div style={styles.contentStack}>
                <div>
                  <div style={styles.analysisTitle}>
                    {selectedGame.home} vs {selectedGame.away}
                  </div>
                  <div style={styles.muted}>{formatDate(selectedGame.commenceTime)}</div>
                </div>

                <div>
                  <div style={styles.subTitle}>{t.bestOdds}</div>
                  <div style={styles.contentStack}>
                    {bestOdds.length > 0 ? (
                      bestOdds.map((odd) => (
                        <div key={odd.name} style={styles.rowCard}>
                          <div>{odd.name}</div>
                          <div>
                            <strong>{odd.price}</strong> · {odd.bookmaker}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={styles.muted}>{t.noBookmakerOdds}</div>
                    )}
                  </div>
                </div>

                {derivedResult && (
                  <div>
                    <div style={styles.subTitle}>{t.stats}</div>
                    <div style={styles.contentStack}>
                      <div style={styles.rowCard}>
                        <span>{t.homeWin}</span>
                        <strong>{derivedResult.homeWinProb}%</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.draw}</span>
                        <strong>{derivedResult.drawProb}%</strong>
                      </div>
                      <div style={styles.rowCard}>
                        <span>{t.awayWin}</span>
                        <strong>{derivedResult.awayWinProb}%</strong>
                      </div>
                    </div>
                  </div>
                )}

                {bestCalculatedBet && stakeInfo && (
                  <div style={styles.greenCard}>
                    <div style={styles.subTitle}>{t.stakeSuggestion}</div>
                    <div style={styles.contentStack}>
                      <div>
                        {t.outcome}: <strong>{bestCalculatedBet.outcome}</strong>
                      </div>
                      <div>
                        {t.probability}: <strong>{bestCalculatedBet.probPercent}%</strong>
                      </div>
                      <div>
                        {t.odds}: <strong>{bestCalculatedBet.odds}</strong>
                      </div>
                      <div>
                        {t.bookmaker}: <strong>{bestCalculatedBet.bookmaker}</strong>
                      </div>
                      <div>
                        {t.ev}: <strong>{bestCalculatedBet.ev.toFixed(2)}</strong>
                      </div>
                      <div>
                        {t.kellyFraction}:{" "}
                        <strong>{(stakeInfo.adjustedKelly * 100).toFixed(2)}%</strong>
                      </div>
                      <div>
                        {t.suggestedStake}: <strong>{stakeInfo.stake.toFixed(2)} €</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionTitle}>{t.tracker}</div>

            {bestCalculatedBet && stakeInfo ? (
              <>
                <div style={styles.buttonRow}>
                  <button onClick={() => addBetResult("win")} style={styles.successButton}>
                    {t.markWin}
                  </button>
                  <button onClick={() => addBetResult("lose")} style={styles.dangerButton}>
                    {t.markLose}
                  </button>
                  <button onClick={() => addBetResult("void")} style={styles.neutralButton}>
                    {t.markVoid}
                  </button>
                </div>

                <div style={styles.contentStack}>
                  <div style={styles.rowCard}>
                    <span>{t.totalStaked}</span>
                    <strong>{totalStaked.toFixed(2)} €</strong>
                  </div>
                  <div style={styles.rowCard}>
                    <span>{t.totalProfit}</span>
                    <strong>{totalProfit.toFixed(2)} €</strong>
                  </div>
                  <div style={styles.rowCard}>
                    <span>{t.roi}</span>
                    <strong>{roi.toFixed(2)}%</strong>
                  </div>
                </div>
              </>
            ) : (
              <div style={styles.muted}>{t.pickGame}</div>
            )}

            {betHistory.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={styles.subTitle}>{t.betHistory}</div>
                <div style={styles.contentStack}>
                  {betHistory.slice(0, 10).map((bet) => (
                    <div key={bet.id} style={styles.rowBlock}>
                      <div style={{ fontWeight: 700 }}>{bet.outcome}</div>
                      <div>{t.odds}: {bet.odds}</div>
                      <div>{t.stake}: {bet.stake.toFixed(2)} €</div>
                      <div>{t.status}: {bet.status}</div>
                      <div>{t.profit}: {bet.profit.toFixed(2)} €</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionTitle}>{t.feedback}</div>

            <textarea
              placeholder={t.feedbackPlaceholder}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              style={styles.textarea}
            />

            <div style={{ height: 12 }} />

            <input
              placeholder={t.feedbackEmail}
              value={feedbackEmail}
              onChange={(e) => setFeedbackEmail(e.target.value)}
              style={styles.input}
            />

            <div style={{ height: 12 }} />

            <button onClick={sendFeedback} style={styles.primaryButton}>
              {t.sendFeedback}
            </button>

            {feedbackStatus && <div style={{ ...styles.muted, marginTop: 12 }}>{feedbackStatus}</div>}
          </section>
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0b1020",
    color: "#f8fafc",
    padding: 16,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    maxWidth: 720,
    margin: "0 auto",
  },
  header: {
    display: "grid",
    gap: 20,
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 56,
    lineHeight: 0.95,
    fontWeight: 900,
    letterSpacing: 1,
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 10,
    fontSize: 16,
  },
  filters: {
    display: "grid",
    gap: 14,
  },
  fieldWrap: {
    display: "grid",
    gap: 6,
  },
  label: {
    fontSize: 14,
    color: "#cbd5e1",
    fontWeight: 600,
  },
  select: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#f8fafc",
    outline: "none",
    fontSize: 16,
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#f8fafc",
    outline: "none",
    fontSize: 16,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: 120,
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#f8fafc",
    outline: "none",
    fontSize: 16,
    boxSizing: "border-box",
    resize: "vertical",
  },
  stack: {
    display: "grid",
    gap: 16,
  },
  panel: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 14,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 10,
  },
  muted: {
    color: "#94a3b8",
    fontSize: 16,
  },
  gamesList: {
    display: "grid",
    gap: 14,
  },
  gameCard: {
    width: "100%",
    padding: 18,
    borderRadius: 20,
    color: "#f8fafc",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
    textAlign: "left",
  },
  gameTitle: {
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 8,
    color: "#ffffff",
  },
  gameDate: {
    fontSize: 14,
    color: "#dbeafe",
    marginBottom: 12,
  },
  pills: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  pill: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    border: "1px solid #93c5fd",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 600,
  },
  contentStack: {
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
    background: "#0f172a",
  },
  rowBlock: {
    border: "1px solid #1f2937",
    borderRadius: 14,
    padding: 12,
    background: "#0f172a",
    display: "grid",
    gap: 4,
  },
  greenCard: {
    border: "1px solid #1f8f5f",
    borderRadius: 16,
    padding: 16,
    background: "#0d1f18",
  },
  buttonRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  successButton: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid #166534",
    background: "#14532d",
    color: "#dcfce7",
    cursor: "pointer",
    fontSize: 16,
  },
  dangerButton: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid #991b1b",
    background: "#7f1d1d",
    color: "#fee2e2",
    cursor: "pointer",
    fontSize: 16,
  },
  neutralButton: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: 16,
  },
  primaryButton: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "none",
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
  },
  infoBanner: {
    marginBottom: 12,
    padding: 14,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#cbd5e1",
    borderRadius: 14,
  },
  warnBanner: {
    marginBottom: 12,
    padding: 14,
    border: "1px solid #7c5a10",
    background: "#3a2a00",
    color: "#f5c451",
    borderRadius: 14,
  },
  errorBanner: {
    marginBottom: 12,
    padding: 14,
    border: "1px solid #7f1d1d",
    background: "#3a1717",
    color: "#fecaca",
    borderRadius: 14,
  },
  analysisTitle: {
    fontSize: 24,
    fontWeight: 800,
    lineHeight: 1.2,
  },
};
