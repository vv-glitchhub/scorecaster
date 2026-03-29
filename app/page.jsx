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
  },
};

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

  const bankroll = useMemo(() => {
    const normalized = bankrollInput.replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [bankrollInput]);

  useEffect(() => {
    async function loadSports() {
      try {
        const res = await fetch("/api/sports");
        if (!res.ok) {
          throw new Error("Failed to fetch sports");
        }

        const json = await res.json();
        const sportsData = Array.isArray(json.data) ? json.data : [];

        setSports(sportsData);
        setSportsFallback(Boolean(json.fallback));

        const firstGroup = sportsData[0]?.group || "";
        setSelectedGroup(firstGroup);

        const firstLeague = sportsData[0]?.key || "";
        setSelectedSportKey(firstLeague);
      } catch (err) {
        const fallbackSports = [
          {
            key: "icehockey_nhl",
            group: "Ice Hockey",
            title: "NHL",
          },
          {
            key: "icehockey_sweden_allsvenskan",
            group: "Ice Hockey",
            title: "Allsvenskan",
          },
          {
            key: "basketball_nba",
            group: "Basketball",
            title: "NBA",
          },
          {
            key: "soccer_epl",
            group: "Soccer",
            title: "Premier League",
          },
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
        if (!res.ok) {
          throw new Error("Failed to fetch odds");
        }

        const json = await res.json();
        const normalized = normalizeGames(json.data || []);

        setGames(normalized);
        setFallback(Boolean(json.fallback));
        setSelectedGameId((prev) => {
          const exists = normalized.some((g) => g.id === prev);
          return exists ? prev : normalized[0]?.id || "";
        });
      } catch (err) {
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
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1020",
        color: "#f8fafc",
        padding: 24,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: 1 }}>
              {t.title}
            </h1>
            <div style={{ color: "#94a3b8", marginTop: 8 }}>{t.subtitle}</div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
                {t.language}
              </div>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                style={selectStyle}
              >
                <option value="fi">Suomi</option>
                <option value="en">English</option>
              </select>
            </div>

            <div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
                {t.sportGroup}
              </div>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                style={selectStyle}
              >
                {sportGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
                {t.league}
              </div>
              <select
                value={selectedSportKey}
                onChange={(e) => setSelectedSportKey(e.target.value)}
                style={selectStyle}
              >
                {leaguesForSelectedGroup.map((league) => (
                  <option key={league.key} value={league.key}>
                    {league.title || league.key}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {sportsFallback && (
          <div
            style={{
              marginBottom: 12,
              padding: 14,
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#cbd5e1",
              borderRadius: 12,
            }}
          >
            {t.sportsFallbackBanner}
          </div>
        )}

        {fallback && (
          <div
            style={{
              marginBottom: 20,
              padding: 14,
              border: "1px solid #7c5a10",
              background: "#3a2a00",
              color: "#f5c451",
              borderRadius: 12,
            }}
          >
            ⚠ {t.fallbackBanner}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: 14,
              border: "1px solid #7f1d1d",
              background: "#3a1717",
              color: "#fecaca",
              borderRadius: 12,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 0.95fr",
            gap: 20,
          }}
        >
          <section style={panelStyle}>
            <div style={sectionTitleStyle}>{t.stats}</div>

            {loading ? (
              <div style={{ color: "#94a3b8" }}>{t.loading}</div>
            ) : games.length === 0 ? (
              <div style={{ color: "#94a3b8" }}>{t.noGames}</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {games.map((game) => {
                  const isSelected = game.id === selectedGameId;
                  const cardOdds = getBestOdds(game, t);

                  return (
                    <button
                      key={game.id}
                      onClick={() => setSelectedGameId(game.id)}
                      style={{
                        ...gameCardStyle,
                        border: isSelected ? "1px solid #22c55e" : "1px solid #1f2937",
                        background: isSelected ? "#0f172a" : "#111827",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                        {game.home} vs {game.away}
                      </div>

                      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>
                        {formatDate(game.commenceTime)}
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {cardOdds.length > 0 ? (
                          cardOdds.map((odd) => (
                            <div key={`${game.id}-${odd.name}`} style={pillStyle}>
                              <strong>{odd.name}</strong>: {odd.price}{" "}
                              <span style={{ color: "#94a3b8" }}>({odd.bookmaker})</span>
                            </div>
                          ))
                        ) : (
                          <div style={{ color: "#94a3b8" }}>{t.noBookmakerOdds}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside style={{ display: "grid", gap: 20 }}>
            <section style={panelStyle}>
              <div style={sectionTitleStyle}>{t.bankrollTitle}</div>

              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <div style={labelStyle}>{t.bankroll}</div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={bankrollInput}
                    onChange={(e) => setBankrollInput(e.target.value)}
                    style={inputStyle}
                    placeholder="1000"
                  />
                </div>

                <div>
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>
                    Parsed bankroll: {bankroll.toFixed(2)} €
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>{t.kellyMode}</div>
                  <select
                    value={riskMode}
                    onChange={(e) => setRiskMode(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="quarter">{t.quarterKelly}</option>
                    <option value="half">{t.halfKelly}</option>
                    <option value="full">{t.fullKelly}</option>
                  </select>
                </div>
              </div>
            </section>

            <section style={panelStyle}>
              <div style={sectionTitleStyle}>{t.analysis}</div>

              {!selectedGame ? (
                <div style={{ color: "#94a3b8" }}>{t.pickGame}</div>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>
                      {selectedGame.home} vs {selectedGame.away}
                    </div>
                    <div style={{ color: "#94a3b8", marginTop: 6 }}>
                      {formatDate(selectedGame.commenceTime)}
                    </div>
                  </div>

                  <div>
                    <div style={miniTitleStyle}>{t.bestOdds}</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {bestOdds.length > 0 ? (
                        bestOdds.map((odd) => (
                          <div
                            key={odd.name}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                              padding: 10,
                              border: "1px solid #1f2937",
                              borderRadius: 10,
                              background: "#0f172a",
                            }}
                          >
                            <div>{odd.name}</div>
                            <div>
                              <strong>{odd.price}</strong> · {odd.bookmaker}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: "#94a3b8" }}>{t.noBookmakerOdds}</div>
                      )}
                    </div>
                  </div>

                  {derivedResult && (
                    <div>
                      <div style={miniTitleStyle}>{t.stats}</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={statRowStyle}>
                          <span>{t.homeWin}</span>
                          <strong>{derivedResult.homeWinProb}%</strong>
                        </div>
                        <div style={statRowStyle}>
                          <span>{t.draw}</span>
                          <strong>{derivedResult.drawProb}%</strong>
                        </div>
                        <div style={statRowStyle}>
                          <span>{t.awayWin}</span>
                          <strong>{derivedResult.awayWinProb}%</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {bestCalculatedBet && stakeInfo && (
                    <div
                      style={{
                        border: "1px solid #1f8f5f",
                        borderRadius: 12,
                        padding: 14,
                        background: "#0d1f18",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 10 }}>
                        {t.stakeSuggestion}
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
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
                          {t.suggestedStake}:{" "}
                          <strong>{stakeInfo.stake.toFixed(2)} €</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section style={panelStyle}>
              <div style={sectionTitleStyle}>{t.tracker}</div>

              {bestCalculatedBet && stakeInfo ? (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                    <button onClick={() => addBetResult("win")} style={successButtonStyle}>
                      {t.markWin}
                    </button>
                    <button onClick={() => addBetResult("lose")} style={dangerButtonStyle}>
                      {t.markLose}
                    </button>
                    <button onClick={() => addBetResult("void")} style={neutralButtonStyle}>
                      {t.markVoid}
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={statRowStyle}>
                      <span>{t.totalStaked}</span>
                      <strong>{totalStaked.toFixed(2)} €</strong>
                    </div>
                    <div style={statRowStyle}>
                      <span>{t.totalProfit}</span>
                      <strong>{totalProfit.toFixed(2)} €</strong>
                    </div>
                    <div style={statRowStyle}>
                      <span>{t.roi}</span>
                      <strong>{roi.toFixed(2)}%</strong>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ color: "#94a3b8" }}>{t.pickGame}</div>
              )}

              {betHistory.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>{t.betHistory}</div>

                  <div style={{ display: "grid", gap: 8 }}>
                    {betHistory.slice(0, 10).map((bet) => (
                      <div
                        key={bet.id}
                        style={{
                          border: "1px solid #1f2937",
                          borderRadius: 10,
                          padding: 12,
                          background: "#0f172a",
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>{bet.outcome}</div>
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
          </aside>
        </div>
      </div>
    </main>
  );
}

const panelStyle = {
  background: "#111827",
  border: "1px solid #1f2937",
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
};

const sectionTitleStyle = {
  fontSize: 18,
  fontWeight: 800,
  marginBottom: 14,
};

const miniTitleStyle = {
  fontSize: 15,
  fontWeight: 700,
  marginBottom: 8,
};

const labelStyle = {
  marginBottom: 8,
  fontWeight: 600,
  color: "#cbd5e1",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#f8fafc",
  outline: "none",
};

const selectStyle = {
  minWidth: 140,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#f8fafc",
  outline: "none",
};

const gameCardStyle = {
  width: "100%",
  padding: 16,
  borderRadius: 16,
};

const pillStyle = {
  padding: "8px 10px",
  borderRadius: 999,
  background: "#0b1220",
  border: "1px solid #243042",
  fontSize: 13,
};

const statRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  border: "1px solid #1f2937",
  borderRadius: 10,
  background: "#0f172a",
};

const successButtonStyle = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #166534",
  background: "#14532d",
  color: "#dcfce7",
  cursor: "pointer",
};

const dangerButtonStyle = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #991b1b",
  background: "#7f1d1d",
  color: "#fee2e2",
  cursor: "pointer",
};

const neutralButtonStyle = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#1e293b",
  color: "#e2e8f0",
  cursor: "pointer",
};
