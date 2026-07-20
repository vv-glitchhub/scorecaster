function clean(value, maximum = 240) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function normalized(value) {
  return clean(value, 240)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|hc|bc|club|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamMatches(candidate, expected) {
  const left = normalized(candidate);
  const right = normalized(expected);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const leftTokens = new Set(left.split(" ").filter((token) => token.length >= 3));
  const rightTokens = right.split(" ").filter((token) => token.length >= 3);
  return rightTokens.filter((token) => leftTokens.has(token)).length >= Math.min(2, rightTokens.length);
}

function productDecision(pick) {
  if (pick?.productDecision === "PLAY" || pick?.decision === "BET" || pick?.decision === "PLAY") return "PLAY";
  if (pick?.productDecision === "SKIP" || pick?.decision === "PASS" || pick?.decision === "SKIP") return "SKIP";
  return "CAUTION";
}

function selectionSide(pick, match) {
  const selection = pick?.selection || pick?.label;
  if (teamMatches(selection, match?.homeTeam)) return "home";
  if (teamMatches(selection, match?.awayTeam)) return "away";
  return null;
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function bestSignal(report, side) {
  if (!side || !Array.isArray(report?.data)) return null;
  return [...report.data]
    .map((market) => ({
      ...market,
      selectedProbability: side === "home" ? market.homeProbability : market.awayProbability
    }))
    .filter((market) => Number.isFinite(Number(market.selectedProbability)))
    .sort((left, right) => {
      const confidence = finite(right.matchConfidence) - finite(left.matchConfidence);
      if (confidence !== 0) return confidence;
      const liquidity = finite(right.liquidity) - finite(left.liquidity);
      if (liquidity !== 0) return liquidity;
      return finite(right.volume) - finite(left.volume);
    })[0] || null;
}

export function applyPolymarketSafety(pick = {}, report = {}) {
  const initialDecision = productDecision(pick);
  const side = selectionSide(pick, report?.match || {});
  const signal = bestSignal(report, side);
  const selectedProbability = signal ? finite(signal.selectedProbability, NaN) : NaN;
  const referenceProbability = finite(
    pick.consensusProbability ?? pick.modelProbability ?? pick.marketProbability ?? pick.impliedProbability,
    NaN
  );
  const difference = Number.isFinite(selectedProbability) && Number.isFinite(referenceProbability)
    ? selectedProbability - referenceProbability
    : null;

  const liquidity = finite(signal?.liquidity, 0);
  const volume = finite(signal?.volume, 0);
  const matchConfidence = finite(signal?.matchConfidence, 0);
  const marketQuality = matchConfidence >= 0.75 && (liquidity >= 1000 || volume >= 10000);
  const strongDisagreement = marketQuality && difference !== null && difference <= -0.08;
  const veryStrongDisagreement = marketQuality && difference !== null && difference <= -0.15;

  let nextDecision = initialDecision;
  const notes = [];
  if (!report?.ok || report?.mode !== "live" || !signal) {
    notes.push("No sufficiently matched live Polymarket sports market was available.");
  } else if (!marketQuality) {
    notes.push("Polymarket match or liquidity was not strong enough to affect the decision.");
  } else if (strongDisagreement) {
    notes.push(`Polymarket was ${(Math.abs(difference) * 100).toFixed(1)} percentage points below the Scorecaster consensus for the selected side.`);
    if (initialDecision === "PLAY") nextDecision = "CAUTION";
  } else {
    notes.push("Polymarket did not provide a verified downside conflict for the selected side.");
  }

  const existingReason = clean(pick.evidenceGateReason, 600);
  const polymarketReason = notes.join(" ");
  const combinedReason = [existingReason, polymarketReason].filter(Boolean).join(" ").slice(0, 1000);

  return {
    ...pick,
    agentVersion: `${pick.agentVersion || "V11-model-lab"}+polymarket-intelligence-v1`,
    productDecision: nextDecision,
    decision: nextDecision === "PLAY" ? "BET" : nextDecision === "SKIP" ? "PASS" : "WATCH",
    polymarketIntelligence: report || null,
    polymarketSignal: signal ? {
      id: signal.id || null,
      title: signal.title || null,
      url: signal.url || null,
      side,
      selectedProbability: Number(selectedProbability.toFixed(4)),
      referenceProbability: Number.isFinite(referenceProbability) ? Number(referenceProbability.toFixed(4)) : null,
      difference: difference === null ? null : Number(difference.toFixed(4)),
      matchConfidence: Number(matchConfidence.toFixed(3)),
      liquidity: Number(liquidity.toFixed(2)),
      volume: Number(volume.toFixed(2)),
      mapping: signal.mapping || null,
      strongDisagreement,
      veryStrongDisagreement,
      marketQuality
    } : null,
    polymarketUsedForUpgrade: false,
    probabilityAdjustedByPolymarket: false,
    scoreSettledByPolymarket: false,
    evidenceGateReason: combinedReason || pick.evidenceGateReason,
    sourceTrust: signal && marketQuality
      ? Math.min(finite(pick.sourceTrust, 0.65), clamp(0.55 + matchConfidence * 0.25, 0.55, 0.8))
      : pick.sourceTrust
  };
}
