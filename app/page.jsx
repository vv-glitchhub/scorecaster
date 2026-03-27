"use client";

import { useEffect, useMemo, useState } from "react";
import ValueBetsSection from "./components/ValueBetsSection";

const TEXT = {
  fi: {
    title: "SCORECASTER",
    subtitle: "AI-POWERED SPORTS ANALYTICS",
    codeUpdated: "Koodi päivitetty",
    selectSport: "Valitse laji",
    selectLeague: "Valitse liiga",
    allSports: "Kaikki lajit",
    allLeagues: "Kaikki liigat",
    fetchGames: "Hae pelit",
    loading: "Ladataan...",
    noGames: "Ei pelejä löytynyt.",
    selectedMatch: "Valittu ottelu",
    factors: "Vaikuttavat tekijät",
    analyze: "Analysoi",
    recommendation: "Suositus",
    probabilities: "Todennäköisyydet",
    confidence: "Luottamus",
    bestBet: "Paras veto",
    analysis: "Analyysi",
    stats: "Tilastot",
    draw: "Tasapeli",
    selectedKey: "Valittu sportKey",
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
    markVoid: "Merkitse void"
  },
  en: {
    title: "SCORECASTER",
    subtitle: "AI-POWERED SPORTS ANALYTICS",
    codeUpdated: "Code updated",
    selectSport: "Select sport",
    selectLeague: "Select league",
    allSports: "All sports",
    allLeagues: "All leagues",
    fetchGames: "Fetch games",
    loading: "Loading...",
    noGames: "No games found.",
    selectedMatch: "Selected match",
    factors: "Key factors",
    analyze: "Analyze",
    recommendation: "Recommendation",
    probabilities: "Probabilities",
    confidence: "Confidence",
    bestBet: "Best bet",
    analysis: "Analysis",
    stats: "Stats",
    draw: "Draw",
    selectedKey: "Selected sportKey",
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
    markVoid: "Mark void"
  }
};

const SPORT_LABELS = {
  fi: {
    jalkapallo: "Jalkapallo",
    jaakiekko: "Jääkiekko",
    koripallo: "Koripallo",
    other: "Muut"
  },
  en: {
    jalkapallo: "Football",
    jaakiekko: "Ice hockey",
    koripallo: "Basketball",
    other: "Other"
  }
};

const FACTORS = {
  jalkapallo: {
    fi: ["Kotikenttäetu", "Avainpelaaja loukkaantunut", "Derby-ottelu"],
    en: ["Home advantage", "Key player injured", "Derby match"]
  },
  jaakiekko: {
    fi: ["Kotietu", "Maalivahti vireessä", "Back-to-back peli"],
    en: ["Home advantage", "Goalie in form", "Back-to-back game"]
  },
  koripallo: {
    fi: ["Kotisali tukee", "Tähti loukkaantunut", "Nopea tempo"],
    en: ["Home court boost", "Star player injured", "Fast pace"]
  },
  other: {
    fi: ["Kotietu", "Loukkaantumiset", "Motivaatio"],
    en: ["Home advantage", "Injuries", "Motivation"]
  }
};

function getBestOdds(game) {
  const best = {};

  for (const bookmaker of game.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      if (market.key !== "h2h") continue;

      for (const outcome of market.outcomes || []) {
        const current = best[outcome.name];
        if (!current || outcome.price > current.price) {
          best[outcome.name] = {
            name: outcome.name,
            price: outcome.price,
            bookmaker: bookmaker.title
          };
        }
      }
    }
  }

  return Object.values(best);
}

function labelOutcome(name, t) {
  if (name === "Draw") return t.draw;
  return name;
}

function formatVersionDate(date, lang) {
  if (!date) return "";
  return new Date(date).toLocaleString(lang === "fi" ? "fi-FI" : "en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getDefaultSportKey(category, sports) {
  if (!sports?.length) return "all";

  if (category === "jaakiekko") {
    return (
      sports.find((s) => s.key === "icehockey_nhl")?.key ||
      sports.find((s) => s.category === "jaakiekko")?.key ||
      "all"
    );
  }

  if (category === "jalkapallo") {
    return (
      sports.find((s) => s.key === "soccer_epl")?.key ||
      sports.find((s) => s.category === "jalkapallo")?.key ||
      "all"
    );
  }

  if (category === "koripallo") {
    return (
      sports.find((s) => s.key === "basketball_nba")?.key ||
      sports.find((s) => s.category === "koripallo")?.key ||
      "all"
    );
  }

  return "all";
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
  const stake = bankroll * adjustedKelly;

  return {
    rawKelly,
    adjustedKelly,
    stake: Math.max(0, stake)
  };
}

function getBestBetFromResult(result, selectedGame, t) {
  if (!result || !selectedGame) return null;

  const oddsList = getBestOdds(selectedGame);

  const homeOdds = oddsList.find((o) => o.name === selectedGame.home)?.price || 0;
  const awayOdds = oddsList.find((o) => o.name === selectedGame.away)?.price || 0;
  const drawOdds = oddsList.find((o) => o.name === "Draw")?.price || 0;

  const options = [
    {
      outcome: selectedGame.home,
      probPercent: Number(result.homeWinProb || 0),
      odds: Number(homeOdds || 0),
      bookmaker: oddsList.find((o) => o.name === selectedGame.home)?.bookmaker || "-"
    },
    {
      outcome: t.draw,
      probPercent: Number(result.drawProb || 0),
      odds: Number(drawOdds || 0),
      bookmaker: oddsList.find((o) => o.name === "Draw")?.bookmaker || "-"
    },
    {
      outcome: selectedGame.away,
      probPercent: Number(result.awayWinProb || 0),
      odds: Number(awayOdds || 0),
      bookmaker: oddsList.find((o) => o.name === selectedGame.away)?.bookmaker || "-"
    }
  ]
    .filter((o) => o.odds > 1)
    .map((o) => ({
      ...o,
      ev: decimalProb(o.probPercent) * o.odds
    }))
    .sort((a, b) => b.ev - a.ev);

  return options[0] || null;
}

export default function Page() {
  const [lang, setLang] = useState("fi");
  const t = TEXT[lang];

  const [sports, setSports] = useState([]);
  const [loadingSports, setLoadingSports] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState("jaakiekko");
  const [selectedSportKey, setSelectedSportKey] = useState("all");

  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);

  const [selectedGame, setSelectedGame] = useState(null);
  const [factors, setFactors] = useState(new Set());

  const [result, setResult] = useState(null);
  const [loadingPredict, setLoadingPredict] = useState(false);

  const [error, setError] = useState("");
  const [version, setVersion] = useState(null);

  const [bankroll, setBankroll] = useState(1000);
  const [riskMode, setRiskMode] = useState("quarter");
  const [betHistory, setBetHistory] = useState([]);

  useEffect(() => {
    async function loadSports() {
      try {
        const res = await fetch("/api/sports", { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Sports fetch failed");
        setSports(data.sports || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingSports(false);
      }
    }

    async function loadVersion() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const data = await res.json();

        if (res.ok && !data.error) {
          setVersion(data);
        }
      } catch {
        // ignore
      }
    }

    loadSports();
    loadVersion();
  }, []);

  useEffect(() => {
    if (!sports.length) return;
    setSelectedSportKey(getDefaultSportKey(selectedCategory, sports));
  }, [sports, selectedCategory]);

  const filteredSports = useMemo(() => {
    if (selectedCategory === "all") return sports;
    return sports.filter((s) => s.category === selectedCategory);
  }, [sports, selectedCategory]);

  const factorCategory =
    selectedCategory === "all" ? "other" : selectedCategory;

  const availableFactors =
    FACTORS[factorCategory]?.[lang] || FACTORS.other[lang];

  function toggleFactor(factor) {
    setFactors((prev) => {
      const next = new Set(prev);
      if (next.has(factor)) next.delete(factor);
      else next.add(factor);
      return next;
    });
  }

  async function fetchGames() {
    if (loadingGames) return;

    setLoadingGames(true);
    setError("");
    setGames([]);
    setSelectedGame(null);
    setResult(null);

    try {
      let sportKeys = [];

      if (selectedCategory === "all") {
        sportKeys =
          selectedSportKey === "all"
            ? sports.map((s) => s.key)
            : [selectedSportKey];
      } else {
        sportKeys =
          selectedSportKey === "all"
            ? filteredSports.map((s) => s.key)
            : [selectedSportKey];
      }

      const responses = await Promise.all(
        sportKeys.map(async (key) => {
          const res = await fetch(`/api/games?sportKey=${key}`, {
            cache: "no-store"
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || `Games fetch failed for ${key}`);
          }

          return {
            key,
            games: data.games || [],
            error: data.error || null
          };
        })
      );

      const mergedGames = responses.flatMap((r) => r.games);

      const uniqueGames = mergedGames.filter(
        (game, index, arr) =>
          index === arr.findIndex((g) => g.id === game.id)
      );

      uniqueGames.sort(
        (a, b) => new Date(a.commence_time) - new Date(b.commence_time)
      );

      setGames(uniqueGames);

      if (uniqueGames.length === 0) {
        setError(
          `Ei pelejä löytynyt valitulla liigalla. sportKey: ${sportKeys.join(", ")}`
        );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingGames(false);
    }
  }

  async function predict() {
    if (!selectedGame || loadingPredict) return;

    setLoadingPredict(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport: selectedCategory === "all" ? "other" : selectedCategory,
          game: selectedGame,
          selectedFactors: Array.from(factors)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Prediction failed");

      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingPredict(false);
    }
  }

  const bestCalculatedBet =
    result && selectedGame
      ? getBestBetFromResult(result, selectedGame, t)
      : null;

  const stakeInfo = bestCalculatedBet
    ? calculateStake(
        bestCalculatedBet.probPercent,
        bestCalculatedBet.odds,
        bankroll,
        riskMode
      )
    : null;

  function addBetResult(status) {
    if (!bestCalculatedBet || !stakeInfo) return;

    const stake = stakeInfo.stake;
    let profit = 0;

    if (status === "win") {
      profit = stake * (bestCalculatedBet.odds - 1);
    } else if (status === "lose") {
      profit = -stake;
    } else {
      profit = 0;
    }

    const record = {
      id: Date.now(),
      outcome: bestCalculatedBet.outcome,
      odds: bestCalculatedBet.odds,
      stake,
      status,
      profit
    };

    setBetHistory((prev) => [record, ...prev]);
    setBankroll((prev) => Number((prev + profit).toFixed(2)));
  }

  const totalStaked = betHistory.reduce((sum, b) => sum + b.stake, 0);
  const totalProfit = betHistory.reduce((sum, b) => sum + b.profit, 0);
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: 20,
        background: "#0b0b12",
        color: "#f1f1f1",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{t.subtitle}</div>
          <h1 style={{ margin: 0 }}>{t.title}</h1>

          {version?.date && (
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
              {t.codeUpdated}: {formatVersionDate(version.date, lang)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setLang("fi")}>FI</button>
          <button onClick={() => setLang("en")}>EN</button>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            border: "1px solid #ff5c7a",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word"
          }}
        >
          {error}
        </div>
      )}

      <section
        style={{
          marginBottom: 20,
          padding: 16,
          border: "1px solid #222",
          borderRadius: 8
        }}
      >
        <div style={{ marginBottom: 12, fontWeight: 700 }}>
          {t.bankrollTitle}
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>
              {t.bankroll}
            </div>
            <input
              type="number"
              value={bankroll}
              onChange={(e) => setBankroll(Number(e.target.value || 0))}
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <div>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>
              {t.kellyMode}
            </div>
            <select
              value={riskMode}
              onChange={(e) => setRiskMode(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            >
              <option value="quarter">Quarter Kelly</option>
              <option value="half">Half Kelly</option>
              <option value="full">Full Kelly</option>
            </select>
          </div>
        </div>
      </section>

      <section
        style={{
          marginBottom: 20,
          padding: 16,
          border: "1px solid #222",
          borderRadius: 8
        }}
      >
        {loadingSports ? (
          <div>{t.loading}</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 700 }}>
                {t.selectSport}
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setGames([]);
                  setSelectedGame(null);
                  setResult(null);
                  setFactors(new Set());
                  setError("");
                }}
                style={{ width: "100%", padding: 10 }}
              >
                <option value="jalkapallo">{SPORT_LABELS[lang].jalkapallo}</option>
                <option value="jaakiekko">{SPORT_LABELS[lang].jaakiekko}</option>
                <option value="koripallo">{SPORT_LABELS[lang].koripallo}</option>
                <option value="all">{t.allSports}</option>
              </select>
            </div>

            <div>
              <div style={{ marginBottom: 8, fontWeight: 700 }}>
                {t.selectLeague}
              </div>

              <select
                value={selectedSportKey}
                onChange={(e) => {
                  setSelectedSportKey(e.target.value);
                  setGames([]);
                  setSelectedGame(null);
                  setResult(null);
                  setError("");
                }}
                style={{ width: "100%", padding: 10 }}
              >
                <option value="all">{t.allLeagues}</option>

                {filteredSports.map((sport) => (
                  <option key={sport.key} value={sport.key}>
                    {sport.title}
                  </option>
                ))}
              </select>

              <div style={{ fontSize: 12, opacity: 0.65, marginTop: 8 }}>
                {t.selectedKey}: {selectedSportKey}
              </div>
            </div>

            <button onClick={fetchGames} disabled={loadingGames}>
              {loadingGames ? t.loading : t.fetchGames}
            </button>
          </div>
        )}
      </section>

      <section
        style={{
          marginBottom: 20,
          padding: 16,
          border: "1px solid #222",
          borderRadius: 8
        }}
      >
        {loadingGames ? (
          <div>{t.loading}</div>
        ) : games.length === 0 ? (
          <div>{t.noGames}</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {games.map((game) => (
              <div
                key={game.id}
                onClick={() => {
                  setSelectedGame(game);
                  setResult(null);
                }}
                style={{
                  border:
                    selectedGame?.id === game.id
                      ? "1px solid #00d4ff"
                      : "1px solid #333",
                  borderRadius: 8,
                  padding: 12,
                  cursor: "pointer"
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {game.home} vs {game.away}
                </div>

                <div style={{ fontSize: 14, opacity: 0.8 }}>
                  {game.dayLabel} · {game.league} · {game.time}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap"
                  }}
                >
                  {getBestOdds(game).map((o) => (
                    <span
                      key={o.name}
                      style={{
                        border: "1px solid #333",
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontSize: 12
                      }}
                    >
                      {labelOutcome(o.name, t)} {o.price}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedGame && (
        <>
          <section
            style={{
              marginBottom: 20,
              padding: 16,
              border: "1px solid #222",
              borderRadius: 8
            }}
          >
            <div style={{ marginBottom: 8, fontWeight: 700 }}>
              {t.selectedMatch}
            </div>
            <div>
              {selectedGame.home} vs {selectedGame.away}
            </div>
            <div style={{ fontSize: 14, opacity: 0.8 }}>
              {selectedGame.dayLabel} · {selectedGame.league} · {selectedGame.time}
            </div>
          </section>

          <section
            style={{
              marginBottom: 20,
              padding: 16,
              border: "1px solid #222",
              borderRadius: 8
            }}
          >
            <div style={{ marginBottom: 8, fontWeight: 700 }}>
              {t.factors}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {availableFactors.map((factor) => (
                <button
                  key={factor}
                  onClick={() => toggleFactor(factor)}
                  style={{
                    padding: "8px 10px",
                    border: factors.has(factor)
                      ? "1px solid #00d4ff"
                      : "1px solid #333",
                    background: factors.has(factor) ? "#11222c" : "transparent",
                    color: "#fff",
                    borderRadius: 6
                  }}
                >
                  {factor}
                </button>
              ))}
            </div>
          </section>

          <button
            onClick={predict}
            disabled={loadingPredict}
            style={{ marginBottom: 24, padding: "12px 16px" }}
          >
            {loadingPredict ? t.loading : t.analyze}
          </button>
        </>
      )}

      {result && (
        <section style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              border: "1px solid #333",
              borderRadius: 8,
              padding: 14
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {t.recommendation}
            </div>
            <div style={{ fontSize: 24 }}>{result.recommendation}</div>
            <div style={{ marginTop: 6 }}>
              {t.confidence}: {result.confidence}
            </div>
          </div>

          <div
            style={{
              border: "1px solid #333",
              borderRadius: 8,
              padding: 14
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {t.probabilities}
            </div>
            <div>{selectedGame.home}: {result.homeWinProb}%</div>
            {result.drawProb > 0 && <div>{t.draw}: {result.drawProb}%</div>}
            <div>{selectedGame.away}: {result.awayWinProb}%</div>
          </div>

          {bestCalculatedBet && stakeInfo && (
            <div
              style={{
                border: "1px solid #1f8f5f",
                borderRadius: 8,
                padding: 14
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                {t.stakeSuggestion}
              </div>

              <div>Veto: {bestCalculatedBet.outcome}</div>
              <div>Todennäköisyys: {bestCalculatedBet.probPercent}%</div>
              <div>Kerroin: {bestCalculatedBet.odds}</div>
              <div>Bookmaker: {bestCalculatedBet.bookmaker}</div>
              <div>EV: {bestCalculatedBet.ev.toFixed(2)}</div>
              <div>
                Kelly fraction: {(stakeInfo.adjustedKelly * 100).toFixed(2)}%
              </div>
              <div>
                Suositeltu panos: <strong>{stakeInfo.stake.toFixed(2)} €</strong>
              </div>
            </div>
          )}

          {result.bestBet && (
            <div
              style={{
                border: "1px solid #1f8f5f",
                borderRadius: 8,
                padding: 14
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                {t.bestBet}
              </div>
              <div>{result.bestBet.outcome}</div>
              <div>Odds: {result.bestBet.odds}</div>
              <div>Bookmaker: {result.bestBet.bookmaker}</div>
              <div>Edge: +{result.bestBet.edge}%</div>
            </div>
          )}

          <div
            style={{
              border: "1px solid #333",
              borderRadius: 8,
              padding: 14
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {t.stats}
            </div>
            <div>
              {selectedGame.home}:{" "}
              {Array.isArray(result.stats?.homeLast5)
                ? result.stats.homeLast5.join(" ")
                : "N/A"}
            </div>
            <div>
              {selectedGame.away}:{" "}
              {Array.isArray(result.stats?.awayLast5)
                ? result.stats.awayLast5.join(" ")
                : "N/A"}
            </div>
            <div>H2H: {result.stats?.h2h || "N/A"}</div>
          </div>

          <div
            style={{
              border: "1px solid #333",
              borderRadius: 8,
              padding: 14
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {t.analysis}
            </div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {result.analysis}
            </div>
          </div>

          {bestCalculatedBet && stakeInfo && (
            <div
              style={{
                border: "1px solid #333",
                borderRadius: 8,
                padding: 14
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                {t.tracker}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <button onClick={() => addBetResult("win")}>{t.markWin}</button>
                <button onClick={() => addBetResult("lose")}>{t.markLose}</button>
                <button onClick={() => addBetResult("void")}>{t.markVoid}</button>
              </div>

              <div>{t.totalStaked}: {totalStaked.toFixed(2)} €</div>
              <div>{t.totalProfit}: {totalProfit.toFixed(2)} €</div>
              <div>{t.roi}: {roi.toFixed(2)}%</div>
            </div>
          )}

          {betHistory.length > 0 && (
            <div
              style={{
                border: "1px solid #333",
                borderRadius: 8,
                padding: 14
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                {t.betHistory}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {betHistory.slice(0, 10).map((bet) => (
                  <div
                    key={bet.id}
                    style={{
                      border: "1px solid #333",
                      borderRadius: 8,
                      padding: 10
                    }}
                  >
                    <div>{bet.outcome}</div>
                    <div>Odds: {bet.odds}</div>
                    <div>Stake: {bet.stake.toFixed(2)} €</div>
                    <div>Status: {bet.status}</div>
                    <div>Profit: {bet.profit.toFixed(2)} €</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <ValueBetsSection />
    </main>
  );
}
