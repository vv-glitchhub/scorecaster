import { clamp } from "./market-consensus-engine.mjs";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function decisionFromPick(pick = {}) {
  if (pick.productDecision === "PLAY" || pick.decision === "BET") return "PLAY";
  if (pick.productDecision === "SKIP" || pick.decision === "PASS") return "SKIP";
  return "WATCH";
}

function learningSlice(learning, pick) {
  const sport = learning?.bySport?.[pick.sportKey] || learning?.bySport?.[pick.league] || null;
  const market = learning?.byMarket?.[pick.marketKey || pick.market] || null;
  const samples = [sport, market].filter(Boolean);
  const sampleSize = samples.reduce((sum, item) => sum + finite(item.bets), 0);
  if (!samples.length || sampleSize < 20) {
    return {
      sampleSize,
      adjustment: 0,
      status: "insufficient",
      note: "Oppimishistoriaa ei käytetä päätöksen vahvistamiseen ennen riittävää otosta."
    };
  }

  const weightedProfit = samples.reduce((sum, item) => sum + finite(item.profit), 0);
  const weightedWins = samples.reduce((sum, item) => sum + finite(item.winRate) * finite(item.bets), 0);
  const winRate = sampleSize ? weightedWins / sampleSize : 0;
  let adjustment = 0;
  if (weightedProfit < 0 || winRate < 0.48) adjustment = -0.08;
  if (weightedProfit > 0 && winRate >= 0.54) adjustment = 0.03;

  return {
    sampleSize,
    adjustment,
    status: adjustment < 0 ? "downgrade" : adjustment > 0 ? "support" : "neutral",
    note: adjustment < 0
      ? "Riittävä paperihistoria heikentää tämän segmentin prioriteettia."
      : adjustment > 0
        ? "Riittävä paperihistoria tukee prioriteettia, mutta ei muuta todennäköisyyttä."
        : "Paperihistoria ei muuta tämän kohteen prioriteettia."
  };
}

function missingEvidence(pick = {}) {
  const missing = [];
  if (!pick.bookmakerCount || pick.bookmakerCount < 4) missing.push("laaja vedonvälittäjäkattavuus");
  if (!pick.lastUpdate && !pick.dataAgeHours && !pick.dataQuality?.ageHours) missing.push("vahvistettu datan aikaleima");
  if (!pick.lineup?.startersConfirmed && !pick.startersConfirmed) missing.push("vahvistettu kokoonpano");
  if (!pick.injuries?.length) missing.push("vahvistettu loukkaantumistieto");
  if (!pick.newsItems?.length) missing.push("riippumaton uutisvahvistus");
  return missing;
}

function buildEvidence(pick = {}) {
  const evidence = [];
  evidence.push(`No-vig-konsensus ${(finite(pick.consensusProbability || pick.modelProbability) * 100).toFixed(1)} %.`);
  evidence.push(`Paras kerroin ${finite(pick.odds).toFixed(2)} vedonvälittäjältä ${pick.bookmaker || "tuntematon"}.`);
  evidence.push(`Edge ${(finite(pick.edge) * 100).toFixed(1)} %, EV ${(finite(pick.ev) * 100).toFixed(1)} %.`);
  evidence.push(`${finite(pick.bookmakerCount)} vedonvälittäjää, dataconfidence ${(finite(pick.confidence) * 100).toFixed(0)} %.`);
  evidence.push(`Tuoreus: ${pick.freshnessLabel || pick.dataQuality?.freshness || "tuntematon"}.`);
  return evidence;
}

function calculateStake(pick, decision, bankroll, maxStakePercent) {
  if (decision !== "PLAY") return 0;
  const probability = finite(pick.consensusProbability || pick.modelProbability);
  const odds = finite(pick.odds);
  if (probability <= 0 || probability >= 1 || odds <= 1) return 0;
  const b = odds - 1;
  const rawKelly = Math.max(0, ((b * probability) - (1 - probability)) / b);
  const quarterKelly = rawKelly * 0.25;
  const cap = bankroll * maxStakePercent / 100;
  return Number(Math.min(bankroll * quarterKelly, cap).toFixed(2));
}

export function buildAgentExcellenceDecision({
  pick = {},
  learning = null,
  bankroll = 1000,
  maxStakePercent = 1
} = {}) {
  const baseDecision = decisionFromPick(pick);
  const confidence = clamp(finite(pick.confidence), 0, 1);
  const trust = clamp(finite(pick.trustScore) / 100, 0, 1);
  const edge = finite(pick.edge);
  const ev = finite(pick.ev);
  const freshness = pick.freshnessLabel || pick.dataQuality?.freshness || "unknown";
  const learningSignal = learningSlice(learning, pick);

  let decision = baseDecision;
  const downgradeReasons = [];
  if (freshness === "stale") downgradeReasons.push("data on vanhentunutta");
  if (finite(pick.bookmakerCount) < 4) downgradeReasons.push("kattavuus on alle neljä vedonvälittäjää");
  if (confidence < 0.55) downgradeReasons.push("dataconfidence on alle 55 %");
  if (trust < 0.6) downgradeReasons.push("trust score on alle 60/100");
  if (edge < 0.02 || ev < 0.03) downgradeReasons.push("etu ei täytä PLAY-rajaa");
  if (learningSignal.adjustment < 0) downgradeReasons.push("riittävä paperihistoria on heikko tässä segmentissä");

  if (decision === "PLAY" && downgradeReasons.length) decision = "WATCH";
  if (baseDecision === "SKIP" || edge < 0.005 || ev <= 0) decision = "SKIP";

  const priorityScore = clamp(
    (decision === "PLAY" ? 0.45 : decision === "WATCH" ? 0.2 : 0) +
    clamp(edge * 4, -0.2, 0.3) +
    clamp(ev * 2, -0.2, 0.25) +
    confidence * 0.2 +
    trust * 0.15 +
    learningSignal.adjustment,
    0,
    1
  );
  const safeBankroll = clamp(finite(bankroll, 1000), 0, 10_000_000);
  const safeMaxStakePercent = clamp(finite(maxStakePercent, 1), 0.1, 5);

  return {
    ...pick,
    agentVersion: "V8-evidence",
    decision,
    baseDecision,
    priorityScore,
    suggestedStake: calculateStake(pick, decision, safeBankroll, safeMaxStakePercent),
    bankroll: safeBankroll,
    maxStakePercent: safeMaxStakePercent,
    learningSignal,
    evidence: buildEvidence(pick),
    missingEvidence: missingEvidence(pick),
    downgradeReasons,
    decisionReason: decision === "PLAY"
      ? "Konsensus, hinta, aineiston laatu ja riskirajat täyttävät Agent V8:n PLAY-portin."
      : decision === "WATCH"
        ? `Kohde vaatii varovaisuutta${downgradeReasons.length ? `: ${downgradeReasons.join(", ")}` : "."}`
        : "Kohde ei tarjoa riittävää todennettua etua tai aineiston laatua.",
    probabilityAdjustedByLearning: false,
    paperOnly: true
  };
}

export function buildAgentExcellenceDecisions(picks = [], options = {}) {
  return (Array.isArray(picks) ? picks : [])
    .map((pick) => buildAgentExcellenceDecision({ ...options, pick }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}
