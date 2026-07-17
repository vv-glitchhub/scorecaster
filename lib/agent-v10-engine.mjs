import { clamp } from "./market-consensus-engine.mjs";
import { buildAgentV9Decision } from "./agent-v9-engine.mjs";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedText(value) {
  return String(value || "").trim().toLowerCase();
}

function eventKey(pick = {}) {
  return normalizedText(
    pick.gameId ||
    pick.eventId ||
    pick.id ||
    pick.match ||
    `${pick.homeTeam || pick.home_team || ""}-${pick.awayTeam || pick.away_team || ""}`
  );
}

function leagueKey(pick = {}) {
  return normalizedText(pick.league || pick.sportKey || pick.sport || pick.leagueTitle || "unknown");
}

function teamKeys(pick = {}) {
  return [...new Set([
    pick.homeTeam || pick.home_team,
    pick.awayTeam || pick.away_team
  ].map(normalizedText).filter(Boolean))];
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  if (typeof value === "number") return Number.isFinite(value) ? Number(value.toFixed(10)) : null;
  return value ?? null;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  const input = String(value);
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function analysisExpiry(pick, now) {
  const freshness = pick.freshnessLabel || pick.dataQuality?.freshness || "unknown";
  const ttlMinutes = freshness === "fresh" ? 10 : freshness === "aging" ? 3 : 0;
  return new Date(now + ttlMinutes * 60_000).toISOString();
}

function scenarioEv(probability, odds) {
  return odds > 1 ? odds * probability - 1 : -1;
}

export function buildDecisionScenarios(decision = {}) {
  const stress = decision.stressTest || {};
  const currentOdds = finite(decision.odds);
  const probabilityCases = [
    { key: "lower", label: "Stressialaraja", probability: finite(stress.lower) },
    { key: "central", label: "Konsensus", probability: finite(stress.probability) },
    { key: "upper", label: "Stressiyläraja", probability: finite(stress.upper) }
  ];
  const priceCases = [
    { key: "minus5", label: "Kerroin −5 %", odds: currentOdds * 0.95 },
    { key: "current", label: "Nykyinen kerroin", odds: currentOdds },
    { key: "plus5", label: "Kerroin +5 %", odds: currentOdds * 1.05 }
  ];

  return probabilityCases.map((probabilityCase) => ({
    ...probabilityCase,
    values: priceCases.map((priceCase) => ({
      ...priceCase,
      odds: Number(priceCase.odds.toFixed(3)),
      ev: Number(scenarioEv(probabilityCase.probability, priceCase.odds).toFixed(6))
    }))
  }));
}

function decisionAuditInput(pick, options) {
  return {
    policy: "agent-v10-drift-replay",
    eventId: pick.gameId || pick.eventId || pick.id || null,
    match: pick.match || null,
    selection: pick.selection || null,
    odds: finite(pick.odds),
    consensusProbability: finite(pick.consensusProbability ?? pick.modelProbability),
    edge: finite(pick.edge),
    ev: finite(pick.ev),
    confidence: finite(pick.confidence),
    trustScore: finite(pick.trustScore),
    bookmakerCount: finite(pick.bookmakerCount ?? pick.dataQuality?.bookmakerCount),
    probabilityDispersion: finite(pick.probabilityDispersion ?? pick.dataQuality?.probabilityDispersion),
    freshness: pick.freshnessLabel || pick.dataQuality?.freshness || "unknown",
    bankroll: options.bankroll,
    maxStakePercent: options.maxStakePercent,
    maxTotalExposurePercent: options.maxTotalExposurePercent,
    maxLeagueExposurePercent: options.maxLeagueExposurePercent,
    maxTeamExposurePercent: options.maxTeamExposurePercent,
    driftStatus: options.learning?.drift?.status || "insufficient"
  };
}

function buildReplay(decision, options, now) {
  const input = decisionAuditInput(decision, options);
  const output = {
    decision: decision.decision,
    priorityScore: decision.priorityScore,
    robustnessScore: decision.robustnessScore,
    suggestedStake: decision.suggestedStake,
    downsideEv: decision.stressTest?.downsideEv,
    minimumPlayOdds: decision.priceGuard?.minimumPlayOdds,
    blockers: decision.blockers
  };
  const inputHash = fnv1a(stableStringify(input));
  const outputHash = fnv1a(stableStringify(output));

  return {
    policyVersion: "V10-drift-replay",
    generatedAt: new Date(now).toISOString(),
    expiresAt: analysisExpiry(decision, now),
    inputHash,
    outputHash,
    decisionId: `v10-${inputHash}-${outputHash}`,
    input,
    output
  };
}

function applyDrift(decision, drift) {
  if (!drift || drift.status === "insufficient" || drift.status === "stable") {
    return {
      ...decision,
      driftAction: "none",
      driftReasons: drift?.reasons || [],
      driftStakeMultiplier: 1
    };
  }

  if (drift.status === "critical") {
    return {
      ...decision,
      decision: decision.decision === "SKIP" ? "SKIP" : "WATCH",
      suggestedStake: 0,
      allocatedStake: 0,
      priorityScore: clamp(finite(decision.priorityScore) - 0.2, 0, 1),
      blockers: [...(decision.blockers || []), "mallidriftin kriittinen pidättäytymisraja"],
      decisionReason: "Agent V10 pidättäytyy PLAY-päätöksestä, koska tuore paperihistoria osoittaa kriittistä laadun heikkenemistä.",
      driftAction: "abstain",
      driftReasons: drift.reasons,
      driftStakeMultiplier: 0
    };
  }

  const reducedStake = Number((finite(decision.suggestedStake) * finite(drift.stakeMultiplier, 0.5)).toFixed(2));
  return {
    ...decision,
    suggestedStake: decision.decision === "PLAY" ? reducedStake : 0,
    priorityScore: clamp(finite(decision.priorityScore) - 0.08, 0, 1),
    blockers: [...(decision.blockers || []), "mallidriftin varoitus"],
    decisionReason: decision.decision === "PLAY"
      ? "Kohde läpäisee päätösportin, mutta Agent V10 puolittaa paperipanoksen tuoreen driftivaroituksen vuoksi."
      : decision.decisionReason,
    driftAction: "reduce",
    driftReasons: drift.reasons,
    driftStakeMultiplier: finite(drift.stakeMultiplier, 0.5)
  };
}

function openPaperRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).filter((row) =>
    row.result === "pending" || row.status === "open"
  );
}

function exposureSnapshot(rows = []) {
  let total = 0;
  const byLeague = new Map();
  const byTeam = new Map();
  const events = new Set();

  for (const row of openPaperRows(rows)) {
    const stake = Math.max(0, finite(row.stake));
    total += stake;
    const league = leagueKey(row);
    byLeague.set(league, (byLeague.get(league) || 0) + stake);
    teamKeys(row).forEach((team) => byTeam.set(team, (byTeam.get(team) || 0) + stake));
    const event = eventKey(row);
    if (event) events.add(event);
  }

  return { total, byLeague, byTeam, events };
}

function scenarioSummary(scenarios) {
  const values = scenarios.flatMap((scenario) => scenario.values.map((value) => value.ev));
  return {
    minimumEv: values.length ? Math.min(...values) : null,
    maximumEv: values.length ? Math.max(...values) : null,
    negativeCases: values.filter((value) => value <= 0).length,
    totalCases: values.length
  };
}

export function buildAgentV10Decision({
  pick = {},
  learning = null,
  bankroll = 1000,
  maxStakePercent = 1,
  maxTotalExposurePercent = 4,
  maxLeagueExposurePercent = 2,
  maxTeamExposurePercent = 1.5,
  now = Date.now()
} = {}) {
  const v9 = buildAgentV9Decision({ pick, learning, bankroll, maxStakePercent });
  const drifted = applyDrift(v9, learning?.drift);
  const scenarios = buildDecisionScenarios(drifted);
  const replayOptions = {
    learning,
    bankroll,
    maxStakePercent,
    maxTotalExposurePercent,
    maxLeagueExposurePercent,
    maxTeamExposurePercent
  };
  const replay = buildReplay(drifted, replayOptions, now);

  return {
    ...drifted,
    agentVersion: "V10-drift-replay",
    scenarioMatrix: scenarios,
    scenarioSummary: scenarioSummary(scenarios),
    replay,
    analysisExpiresAt: replay.expiresAt,
    analysisExpired: Date.parse(replay.expiresAt) <= now,
    probabilityAdjustedByLearning: false,
    paperOnly: true
  };
}

export function buildAgentV10Portfolio(picks = [], {
  learning = null,
  openBets = [],
  bankroll = 1000,
  maxStakePercent = 1,
  maxTotalExposurePercent = 4,
  maxLeagueExposurePercent = 2,
  maxTeamExposurePercent = 1.5,
  now = Date.now()
} = {}) {
  const safeBankroll = clamp(finite(bankroll, 1000), 0, 10_000_000);
  const totalCap = safeBankroll * clamp(finite(maxTotalExposurePercent, 4), 0.5, 20) / 100;
  const leagueCap = safeBankroll * clamp(finite(maxLeagueExposurePercent, 2), 0.25, 10) / 100;
  const teamCap = safeBankroll * clamp(finite(maxTeamExposurePercent, 1.5), 0.25, 10) / 100;
  const existing = exposureSnapshot(openBets);

  let totalAllocated = existing.total;
  const leagueAllocated = new Map(existing.byLeague);
  const teamAllocated = new Map(existing.byTeam);
  const usedEvents = new Set(existing.events);

  const decisions = (Array.isArray(picks) ? picks : [])
    .map((pick) => buildAgentV10Decision({
      pick,
      learning,
      bankroll: safeBankroll,
      maxStakePercent,
      maxTotalExposurePercent,
      maxLeagueExposurePercent,
      maxTeamExposurePercent,
      now
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const allocated = decisions.map((item) => {
    if (item.analysisExpired && item.decision !== "SKIP") {
      return {
        ...item,
        decision: "WATCH",
        suggestedStake: 0,
        allocatedStake: 0,
        portfolioReason: "Analyysin voimassaoloaika päättyi; päivitä agentti ennen paperiseurantaa.",
        blockers: [...(item.blockers || []), "analyysi on vanhentunut"]
      };
    }

    if (item.decision !== "PLAY" || item.suggestedStake <= 0) {
      return { ...item, allocatedStake: 0, portfolioReason: item.portfolioReason || null };
    }

    const event = eventKey(item);
    const league = leagueKey(item);
    const teams = teamKeys(item);
    if (event && usedEvents.has(event)) {
      return {
        ...item,
        decision: "WATCH",
        allocatedStake: 0,
        suggestedStake: 0,
        portfolioReason: "Samasta tapahtumasta on jo avoin tai suunniteltu PLAY-valinta.",
        blockers: [...(item.blockers || []), "saman tapahtuman korrelaatioraja"]
      };
    }

    const remainingTotal = Math.max(0, totalCap - totalAllocated);
    const currentLeague = leagueAllocated.get(league) || 0;
    const remainingLeague = Math.max(0, leagueCap - currentLeague);
    const remainingTeams = teams.map((team) => Math.max(0, teamCap - (teamAllocated.get(team) || 0)));
    const remainingTeam = remainingTeams.length ? Math.min(...remainingTeams) : teamCap;
    const allocation = Number(Math.min(item.suggestedStake, remainingTotal, remainingLeague, remainingTeam).toFixed(2));

    if (allocation <= 0) {
      const reason = remainingTotal <= 0
        ? "Koko paperiportfolion altistusraja on täynnä."
        : remainingLeague <= 0
          ? "Tämän liigan altistusraja on täynnä."
          : "Yhden joukkueen altistusraja on täynnä.";
      return {
        ...item,
        decision: "WATCH",
        allocatedStake: 0,
        suggestedStake: 0,
        portfolioReason: reason,
        blockers: [...(item.blockers || []), "portfolioaltistusraja"]
      };
    }

    if (event) usedEvents.add(event);
    totalAllocated += allocation;
    leagueAllocated.set(league, currentLeague + allocation);
    teams.forEach((team) => teamAllocated.set(team, (teamAllocated.get(team) || 0) + allocation));

    return {
      ...item,
      suggestedStake: allocation,
      allocatedStake: allocation,
      portfolioReason: allocation < finite(item.suggestedStake)
        ? "Panos pienennettiin avoimien ja uusien paperialtistusten yhteiseen rajaan."
        : "Panos mahtuu avoimien vetojen jälkeen tapahtuma-, joukkue-, liiga- ja kokonaisrajoihin."
    };
  });

  const counts = {
    PLAY: allocated.filter((item) => item.decision === "PLAY").length,
    WATCH: allocated.filter((item) => item.decision === "WATCH").length,
    SKIP: allocated.filter((item) => item.decision === "SKIP").length
  };
  const plannedNewExposure = allocated.reduce((sum, item) => sum + finite(item.allocatedStake), 0);

  return {
    agentVersion: "V10-drift-replay-portfolio",
    decisions: allocated,
    counts,
    bankroll: safeBankroll,
    existingOpenExposure: Number(existing.total.toFixed(2)),
    plannedNewExposure: Number(plannedNewExposure.toFixed(2)),
    totalAllocated: Number(totalAllocated.toFixed(2)),
    exposurePercent: safeBankroll > 0 ? totalAllocated / safeBankroll : 0,
    totalCap: Number(totalCap.toFixed(2)),
    leagueCap: Number(leagueCap.toFixed(2)),
    teamCap: Number(teamCap.toFixed(2)),
    drift: learning?.drift || null,
    leagueExposure: Object.fromEntries(
      [...leagueAllocated.entries()].map(([key, value]) => [key, Number(value.toFixed(2))])
    ),
    teamExposure: Object.fromEntries(
      [...teamAllocated.entries()].map(([key, value]) => [key, Number(value.toFixed(2))])
    ),
    paperOnly: true
  };
}
