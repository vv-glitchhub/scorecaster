import { clamp } from "./market-consensus-engine.mjs";
import {
  getAgentRiskPolicy,
  getEffectiveAgentRiskLimits,
  normalizeAgentRiskProfile,
  publicAgentRiskPolicy
} from "./agent-risk-profile-v1.mjs";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedDecision(pick = {}) {
  if (pick.productDecision === "PLAY" || pick.decision === "PLAY" || pick.decision === "BET") return "PLAY";
  if (pick.productDecision === "SKIP" || pick.decision === "SKIP" || pick.decision === "PASS") return "SKIP";
  return "WATCH";
}

function eventKey(pick = {}) {
  return String(
    pick.gameId ||
    pick.eventId ||
    pick.id ||
    pick.match ||
    `${pick.homeTeam || ""}-${pick.awayTeam || ""}`
  ).trim().toLowerCase();
}

function leagueKey(pick = {}) {
  return String(pick.league || pick.sportKey || pick.leagueTitle || "unknown").trim().toLowerCase();
}

function probabilityFromPick(pick = {}) {
  return clamp(finite(pick.consensusProbability ?? pick.modelProbability), 0.01, 0.99);
}

function freshnessFromPick(pick = {}) {
  return pick.freshnessLabel || pick.dataQuality?.freshness || "unknown";
}

function learningCandidates(learning, pick) {
  const sportKey = pick.sportKey || pick.league;
  const marketKey = pick.marketKey || pick.market;
  return [
    sportKey ? { type: "sport", key: sportKey, data: learning?.bySport?.[sportKey] } : null,
    marketKey ? { type: "market", key: marketKey, data: learning?.byMarket?.[marketKey] } : null
  ].filter((item) => item?.data);
}

function buildLearningSignal(learning, pick) {
  const candidates = learningCandidates(learning, pick)
    .sort((a, b) => finite(b.data.bets) - finite(a.data.bets));
  const selected = candidates[0] || null;
  const segment = selected?.data || null;
  const sampleSize = finite(segment?.bets);
  const clvCount = finite(segment?.clvCount);
  const brierCount = finite(segment?.brierCount);

  if (!segment || sampleSize < 30 || (clvCount < 15 && brierCount < 20)) {
    return {
      status: "insufficient",
      adjustment: 0,
      sampleSize,
      segment: selected ? `${selected.type}:${selected.key}` : null,
      note: "Oppimista ei käytetä prioriteetin muuttamiseen ennen riittävää ja laadukasta otosta.",
      metrics: {
        roi: segment?.roi ?? null,
        averageClv: segment?.averageClv ?? null,
        brierScore: segment?.brierScore ?? null,
        calibrationGap: segment?.calibrationGap ?? null
      }
    };
  }

  const roi = finite(segment.roi);
  const averageClv = segment.averageClv === null ? null : finite(segment.averageClv);
  const brierScore = segment.brierScore === null ? null : finite(segment.brierScore);
  const calibrationGap = segment.calibrationGap === null ? null : finite(segment.calibrationGap);

  const negative =
    roi <= -0.08 ||
    (averageClv !== null && averageClv <= -0.01) ||
    (brierScore !== null && brierScore >= 0.29) ||
    (calibrationGap !== null && calibrationGap <= -0.12);
  const supportive =
    roi >= 0 &&
    averageClv !== null && averageClv >= 0.005 &&
    (brierScore === null || brierScore <= 0.25) &&
    (calibrationGap === null || Math.abs(calibrationGap) <= 0.08);

  const adjustment = negative ? -0.1 : supportive ? 0.02 : 0;
  return {
    status: negative ? "downgrade" : supportive ? "support" : "neutral",
    adjustment,
    sampleSize,
    segment: `${selected.type}:${selected.key}`,
    note: negative
      ? "Riittävä paperihistoria osoittaa tässä segmentissä heikkoa CLV:tä, ROI:ta tai kalibrointia. Agentti laskee prioriteettia mutta ei muuta todennäköisyyttä."
      : supportive
        ? "Riittävä paperihistoria tukee prosessin laatua tässä segmentissä. Vaikutus rajataan pieneen prioriteettimuutokseen."
        : "Riittävä historia ei anna tarpeeksi vahvaa syytä muuttaa prioriteettia.",
    metrics: { roi, averageClv, brierScore, calibrationGap }
  };
}

export function buildProbabilityStressTest(pick = {}) {
  const probability = probabilityFromPick(pick);
  const confidence = clamp(finite(pick.confidence), 0, 1);
  const dispersion = clamp(finite(pick.probabilityDispersion ?? pick.dataQuality?.probabilityDispersion), 0, 0.5);
  const bookmakerCount = Math.max(0, finite(pick.bookmakerCount ?? pick.dataQuality?.bookmakerCount));
  const coveragePenalty = Math.max(0, 4 - bookmakerCount) * 0.015;
  const halfWidth = clamp(
    0.012 + dispersion * 1.4 + (1 - confidence) * 0.09 + coveragePenalty,
    0.015,
    0.2
  );
  const lower = clamp(probability - halfWidth, 0.01, 0.99);
  const upper = clamp(probability + halfWidth, 0.01, 0.99);
  const odds = finite(pick.odds);
  const baseEv = odds > 1 ? odds * probability - 1 : -1;
  const downsideEv = odds > 1 ? odds * lower - 1 : -1;
  const upsideEv = odds > 1 ? odds * upper - 1 : -1;
  const breakEvenOdds = probability > 0 ? 1 / probability : 0;
  const targetPlayOdds = probability > 0 ? 1.03 / probability : 0;
  const conservativeBreakEvenOdds = lower > 0 ? 1 / lower : 0;

  return {
    probability,
    lower,
    upper,
    halfWidth,
    baseEv,
    downsideEv,
    upsideEv,
    breakEvenOdds,
    targetPlayOdds,
    conservativeBreakEvenOdds,
    priceBuffer: odds > 1 ? odds - targetPlayOdds : 0,
    robustPositive: downsideEv > 0
  };
}

function buildVerifiedEvidence(pick, stress) {
  return [
    `No-vig-konsensus ${(stress.probability * 100).toFixed(1)} % ja epävarmuusväli ${(stress.lower * 100).toFixed(1)}–${(stress.upper * 100).toFixed(1)} %.`,
    `Paras kerroin ${finite(pick.odds).toFixed(2)} (${pick.bookmaker || "tuntematon vedonvälittäjä"}); reilu kerroin ${stress.breakEvenOdds.toFixed(2)}.`,
    `Perus-EV ${(stress.baseEv * 100).toFixed(1)} % ja stressatun alarajan EV ${(stress.downsideEv * 100).toFixed(1)} %.`,
    `${finite(pick.bookmakerCount)} vedonvälittäjää, dataconfidence ${(finite(pick.confidence) * 100).toFixed(0)} %, tuoreus ${freshnessFromPick(pick)}.`,
    `Trust score ${finite(pick.trustScore).toFixed(0)}/100 ja edge ${(finite(pick.edge) * 100).toFixed(1)} %.`
  ];
}

function buildMissingEvidence(pick = {}) {
  const missing = [];
  if (finite(pick.bookmakerCount) < 4) missing.push("vähintään neljän vedonvälittäjän kattavuus");
  if (!pick.lastUpdate && pick.dataAgeHours === undefined && pick.dataQuality?.ageHours === undefined) {
    missing.push("vahvistettu markkinadatan aikaleima");
  }
  if (!pick.lineup?.startersConfirmed && !pick.startersConfirmed) missing.push("vahvistettu aloituskokoonpano");
  if (!Array.isArray(pick.injuries) || pick.injuries.length === 0) missing.push("vahvistettu loukkaantumistieto");
  if (!Array.isArray(pick.newsItems) || pick.newsItems.length === 0) missing.push("riippumaton uutisvahvistus");
  return missing;
}

function buildCounterArguments(pick, stress, missing, riskPolicy) {
  const targetEv = Number(riskPolicy.minEv || 0.03);
  const targetOdds = stress.probability > 0 ? (1 + targetEv) / stress.probability : stress.targetPlayOdds;
  const argumentsList = [
    `Jos todellinen todennäköisyys on epävarmuusvälin alarajalla, EV on ${(stress.downsideEv * 100).toFixed(1)} %.`,
    `Jos tarjottu kerroin laskee alle ${targetOdds.toFixed(2)}, valitun riskitason ${(targetEv * 100).toFixed(1)} % EV-raja ei enää täyty.`,
    "Vedonvälittäjien konsensus voi olla yhteisesti väärä tai perustua samaan alkuperäiseen markkinatakaajaan."
  ];
  if (missing.length) argumentsList.push(`Päätöksestä puuttuu ${missing.slice(0, 3).join(", ")}.`);
  if (freshnessFromPick(pick) === "aging") argumentsList.push("Markkinadata vanhenee ja hinta voi muuttua ennen ottelua.");
  if (freshnessFromPick(pick) === "stale") argumentsList.push("Markkinadata on vanhentunutta, joten analyysi ei ole käyttökelpoinen PLAY-päätökseen.");
  return argumentsList;
}

function calculateConservativeStake(pick, decision, bankroll, maxStakePercent, stress, kellyFraction = 0.25) {
  if (decision !== "PLAY" || !stress.robustPositive) return 0;
  const odds = finite(pick.odds);
  const p = stress.lower;
  if (odds <= 1 || p <= 0 || p >= 1) return 0;
  const b = odds - 1;
  const rawKelly = Math.max(0, ((b * p) - (1 - p)) / b);
  const boundedKelly = rawKelly * clamp(finite(kellyFraction, 0.25), 0.05, 0.5);
  const cap = bankroll * maxStakePercent / 100;
  return Number(Math.min(bankroll * boundedKelly, cap).toFixed(2));
}

export function buildAgentV9Decision({
  pick = {},
  learning = null,
  bankroll = 1000,
  maxStakePercent = 1,
  riskProfile = "balanced"
} = {}) {
  const normalizedRiskProfile = normalizeAgentRiskProfile(riskProfile);
  const riskPolicy = getAgentRiskPolicy(normalizedRiskProfile);
  const effectiveLimits = getEffectiveAgentRiskLimits({ riskProfile: normalizedRiskProfile, maxStakePercent });
  const baseDecision = normalizedDecision(pick);
  const stress = buildProbabilityStressTest(pick);
  const confidence = clamp(finite(pick.confidence), 0, 1);
  const trust = clamp(finite(pick.trustScore) / 100, 0, 1);
  const bookmakerCount = finite(pick.bookmakerCount);
  const freshness = freshnessFromPick(pick);
  const edge = finite(pick.edge);
  const ev = finite(pick.ev);
  const learningSignal = buildLearningSignal(learning, pick);
  const missingEvidence = buildMissingEvidence(pick);
  const blockers = [];

  if (freshness === "stale") blockers.push("markkinadata on vanhentunutta");
  if (bookmakerCount < 4) blockers.push("vedonvälittäjäkattavuus on alle neljä");
  if (confidence < riskPolicy.minConfidence) blockers.push(`dataconfidence on alle ${(riskPolicy.minConfidence * 100).toFixed(0)} % riskirajan`);
  if (trust < riskPolicy.minTrust) blockers.push(`trust score on alle ${(riskPolicy.minTrust * 100).toFixed(0)}/100 riskirajan`);
  if (edge < riskPolicy.minEdge || ev < riskPolicy.minEv) blockers.push("edge tai EV ei täytä valitun riskitason PLAY-rajaa");
  if (riskPolicy.requireRobustPositive && !stress.robustPositive) blockers.push("stressatun todennäköisyysalarajan EV ei ole positiivinen");
  if (stress.halfWidth > riskPolicy.maxUncertaintyHalfWidth) blockers.push("todennäköisyyden epävarmuusväli on liian leveä valitulle riskitasolle");
  if (learningSignal.adjustment < 0) blockers.push("riittävä paperihistoria heikentää segmentin laatua");

  let decision = baseDecision;
  if (baseDecision === "SKIP" || edge < 0.005 || ev <= 0 || finite(pick.odds) <= 1) decision = "SKIP";
  else if (baseDecision === "PLAY" && blockers.length) decision = "WATCH";

  const robustnessScore = clamp(
    confidence * 0.25 +
    trust * 0.25 +
    clamp(bookmakerCount / 8, 0, 1) * 0.15 +
    (stress.robustPositive ? 0.2 : 0) +
    clamp(1 - stress.halfWidth / 0.2, 0, 1) * 0.15,
    0,
    1
  );
  const priorityScore = clamp(
    (decision === "PLAY" ? 0.42 : decision === "WATCH" ? 0.16 : 0) +
    clamp(edge * 4, -0.2, 0.28) +
    clamp(stress.downsideEv * 1.5, -0.25, 0.2) +
    robustnessScore * 0.25 +
    learningSignal.adjustment,
    0,
    1
  );
  const safeBankroll = clamp(finite(bankroll, 1000), 0, 10_000_000);
  const safeMaxStakePercent = effectiveLimits.maxStakePercent;
  const evidence = buildVerifiedEvidence(pick, stress);
  const counterArguments = buildCounterArguments(pick, stress, missingEvidence, riskPolicy);
  const minimumRiskOdds = stress.probability > 0 ? (1 + riskPolicy.minEv) / stress.probability : stress.targetPlayOdds;

  return {
    ...pick,
    agentVersion: "V9-adversarial",
    decision,
    baseDecision,
    priorityScore,
    robustnessScore,
    suggestedStake: calculateConservativeStake(
      pick,
      decision,
      safeBankroll,
      safeMaxStakePercent,
      stress,
      riskPolicy.kellyFraction
    ),
    bankroll: safeBankroll,
    maxStakePercent: safeMaxStakePercent,
    riskProfile: normalizedRiskProfile,
    riskPolicy: publicAgentRiskPolicy(normalizedRiskProfile),
    learningSignal,
    stressTest: stress,
    evidence,
    missingEvidence,
    counterArguments,
    blockers,
    decisionReason: decision === "PLAY"
      ? `Kohde läpäisee ${normalizedRiskProfile}-riskiprofiilin, epävarmuusalarajan, datan laatuportin ja virtuaalisen panosrajan.`
      : decision === "WATCH"
        ? `Kohde ei läpäise kaikkia ${normalizedRiskProfile}-riskiprofiilin vastatestejä: ${blockers.join(", ") || "lisävahvistus tarvitaan"}.`
        : "Kohteella ei ole riittävää todennettua hintaetua tai käyttökelpoista aineistoa.",
    priceGuard: {
      currentOdds: finite(pick.odds),
      breakEvenOdds: stress.breakEvenOdds,
      minimumPlayOdds: Math.max(minimumRiskOdds, stress.conservativeBreakEvenOdds),
      conservativeBreakEvenOdds: stress.conservativeBreakEvenOdds,
      buffer: finite(pick.odds) - Math.max(minimumRiskOdds, stress.conservativeBreakEvenOdds)
    },
    probabilityAdjustedByLearning: false,
    probabilityAdjustedByRisk: false,
    edgeAdjustedByRisk: false,
    evAdjustedByRisk: false,
    paperOnly: true
  };
}

export function buildAgentV9Portfolio(picks = [], {
  learning = null,
  bankroll = 1000,
  maxStakePercent = 1,
  maxTotalExposurePercent = 4,
  maxLeagueExposurePercent = 2,
  riskProfile = "balanced"
} = {}) {
  const normalizedRiskProfile = normalizeAgentRiskProfile(riskProfile);
  const riskPolicy = publicAgentRiskPolicy(normalizedRiskProfile);
  const effectiveLimits = getEffectiveAgentRiskLimits({
    riskProfile: normalizedRiskProfile,
    maxStakePercent,
    maxTotalExposurePercent,
    maxLeagueExposurePercent
  });
  const safeBankroll = clamp(finite(bankroll, 1000), 0, 10_000_000);
  const totalCap = safeBankroll * effectiveLimits.maxTotalExposurePercent / 100;
  const leagueCap = safeBankroll * effectiveLimits.maxLeagueExposurePercent / 100;
  const decisions = (Array.isArray(picks) ? picks : [])
    .map((pick) => buildAgentV9Decision({
      pick,
      learning,
      bankroll: safeBankroll,
      maxStakePercent: effectiveLimits.maxStakePercent,
      riskProfile: normalizedRiskProfile
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  let totalAllocated = 0;
  const leagueAllocated = new Map();
  const usedEvents = new Set();

  const allocated = decisions.map((item) => {
    if (item.decision !== "PLAY" || item.suggestedStake <= 0) {
      return { ...item, allocatedStake: 0, portfolioReason: null };
    }

    const event = eventKey(item);
    const league = leagueKey(item);
    if (event && usedEvents.has(event)) {
      return {
        ...item,
        decision: "WATCH",
        allocatedStake: 0,
        suggestedStake: 0,
        portfolioReason: "Samasta tapahtumasta on jo yksi PLAY-valinta; korreloitunut lisävalinta estettiin.",
        blockers: [...item.blockers, "saman tapahtuman korrelaatioraja"]
      };
    }

    const remainingTotal = Math.max(0, totalCap - totalAllocated);
    const currentLeague = leagueAllocated.get(league) || 0;
    const remainingLeague = Math.max(0, leagueCap - currentLeague);
    const allocation = Number(Math.min(item.suggestedStake, remainingTotal, remainingLeague).toFixed(2));

    if (allocation <= 0) {
      return {
        ...item,
        decision: "WATCH",
        allocatedStake: 0,
        suggestedStake: 0,
        portfolioReason: remainingTotal <= 0
          ? "Koko agenttisalkun paperialtistusraja on täynnä."
          : "Tämän liigan paperialtistusraja on täynnä.",
        blockers: [...item.blockers, "portfolioaltistusraja"]
      };
    }

    usedEvents.add(event);
    totalAllocated += allocation;
    leagueAllocated.set(league, currentLeague + allocation);
    return {
      ...item,
      suggestedStake: allocation,
      allocatedStake: allocation,
      portfolioReason: allocation < item.suggestedStake
        ? "Panos pienennettiin portfolioaltistusrajaan."
        : "Panos mahtuu yksittäisen kohteen, liigan ja koko portfolion rajoihin."
    };
  });

  const counts = {
    PLAY: allocated.filter((item) => item.decision === "PLAY").length,
    WATCH: allocated.filter((item) => item.decision === "WATCH").length,
    SKIP: allocated.filter((item) => item.decision === "SKIP").length
  };

  return {
    agentVersion: "V9-adversarial-portfolio",
    decisions: allocated,
    counts,
    bankroll: safeBankroll,
    riskProfile: normalizedRiskProfile,
    riskPolicy,
    effectiveLimits,
    totalAllocated: Number(totalAllocated.toFixed(2)),
    exposurePercent: safeBankroll > 0 ? totalAllocated / safeBankroll : 0,
    totalCap: Number(totalCap.toFixed(2)),
    leagueCap: Number(leagueCap.toFixed(2)),
    leagueExposure: Object.fromEntries(
      [...leagueAllocated.entries()].map(([key, value]) => [key, Number(value.toFixed(2))])
    ),
    probabilityAdjustedByRisk: false,
    edgeAdjustedByRisk: false,
    evAdjustedByRisk: false,
    paperOnly: true
  };
}
