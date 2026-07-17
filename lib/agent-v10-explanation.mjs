const DECISIONS = new Set(["PLAY", "WATCH", "SKIP"]);
const MAX_LIST_ITEMS = 6;
const FORBIDDEN_CERTAINTY = [
  "varma voitto",
  "varmasti voittaa",
  "taattu voitto",
  "takuuvoitto",
  "pelaa nyt",
  "lyö veto",
  "panosta oikeaa rahaa",
  "riskitön"
];

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function text(value, maxLength = 240, fallback = "") {
  return String(value ?? fallback)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function list(value, maxItems = MAX_LIST_ITEMS, maxLength = 220) {
  return (Array.isArray(value) ? value : [])
    .map((item) => text(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function probability(value) {
  const number = finite(value);
  return number === null ? null : Math.max(0, Math.min(1, number));
}

function bounded(value, min, max) {
  const number = finite(value);
  return number === null ? null : Math.max(min, Math.min(max, number));
}

export function sanitizeAgentExplanationInput(input = {}) {
  const source = input?.decision && typeof input.decision === "object"
    ? input.decision
    : input;
  const decision = text(source.decision, 12).toUpperCase();
  if (!DECISIONS.has(decision)) return null;

  const contract = {
    contractVersion: "agent-v10-grounded-1",
    decision,
    match: text(source.match || [source.homeTeam, source.awayTeam].filter(Boolean).join(" vs "), 180, "Ottelu"),
    selection: text(source.selection || source.label, 120, "Valinta"),
    league: text(source.leagueTitle || source.league || source.sportKey, 100, "Tuntematon liiga"),
    bookmaker: text(source.bookmaker, 100, "Tuntematon vedonvälittäjä"),
    odds: bounded(source.odds, 1.001, 10000),
    consensusProbability: probability(source.stressTest?.probability ?? source.consensusProbability ?? source.modelProbability),
    stressLower: probability(source.stressTest?.lower ?? source.uncertaintyLower),
    stressUpper: probability(source.stressTest?.upper ?? source.uncertaintyUpper),
    baseEv: bounded(source.stressTest?.baseEv ?? source.ev, -10, 100),
    downsideEv: bounded(source.stressTest?.downsideEv ?? source.downsideEv, -10, 100),
    edge: bounded(source.edge, -1, 1),
    confidence: probability(source.confidence),
    trustScore: bounded(source.trustScore, 0, 100),
    robustnessScore: probability(source.robustnessScore),
    bookmakerCount: bounded(source.bookmakerCount, 0, 1000),
    freshness: text(source.freshnessLabel || source.dataQuality?.freshness, 40, "unknown"),
    minimumPlayOdds: bounded(source.priceGuard?.minimumPlayOdds ?? source.minimumPlayOdds, 1.001, 10000),
    suggestedStake: bounded(source.suggestedStake, 0, 10000000),
    decisionReason: text(source.decisionReason, 360),
    portfolioReason: text(source.portfolioReason, 260),
    evidence: list(source.evidence),
    counterArguments: list(source.counterArguments),
    missingEvidence: list(source.missingEvidence),
    learningNote: text(source.learningSignal?.note, 300),
    learningSampleSize: bounded(source.learningSignal?.sampleSize, 0, 1000000),
    paperOnly: true
  };

  if (!contract.match || !contract.selection) return null;
  return contract;
}

export function canonicalAgentExplanationInput(contract) {
  if (!contract || typeof contract !== "object") return "";
  const keys = Object.keys(contract).sort();
  return JSON.stringify(Object.fromEntries(keys.map((key) => [key, contract[key]])));
}

export function buildDeterministicAgentExplanation(contract) {
  const reason = contract.decisionReason || (
    contract.decision === "PLAY"
      ? "Laskettu evidenssi ja riskirajat läpäisevät nykyisen päätösportin."
      : contract.decision === "WATCH"
        ? "Kohteessa on kiinnostavaa hintaevidenssiä, mutta konservatiivinen portti ei anna täyttä hyväksyntää."
        : "Kohteen hinta, data tai riskiprofiili ei täytä turvallista päätösporttia."
  );
  const counterpoint = contract.counterArguments[0]
    || contract.missingEvidence[0]
    || "Markkinakonsensus voi olla väärässä ja hintaevidenssi voi muuttua ennen tapahtuman alkua.";
  const nextChecks = contract.missingEvidence.length
    ? contract.missingEvidence.slice(0, 4).map((item) => `Vahvista ${item}.`)
    : ["Tarkista markkinadatan tuoreus ennen päätöksen käyttämistä paperiseurannassa."];

  return {
    summary: `${contract.selection}: ${contract.decision}. ${reason}`.slice(0, 480),
    strongestReason: (contract.evidence[0] || reason).slice(0, 320),
    counterpoint: counterpoint.slice(0, 320),
    nextChecks,
    limitation: "Tämä on virtuaalisen paperiseurannan päätöstuki. Se ei takaa lopputulosta eikä aseta oikean rahan vetoa.",
    mode: "deterministic-fallback"
  };
}

function containsDigits(value) {
  return /\d/.test(String(value || ""));
}

function containsForbiddenCertainty(value) {
  const normalized = String(value || "").toLowerCase();
  return FORBIDDEN_CERTAINTY.some((phrase) => normalized.includes(phrase));
}

export function validateGeneratedAgentExplanation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const summary = text(value.summary, 480);
  const strongestReason = text(value.strongestReason, 320);
  const counterpoint = text(value.counterpoint, 320);
  const nextChecks = list(value.nextChecks, 4, 220);
  const limitation = text(value.limitation, 320);
  const fields = [summary, strongestReason, counterpoint, limitation, ...nextChecks];

  if (!summary || !strongestReason || !counterpoint || !limitation) return null;
  if (!nextChecks.length) return null;
  if (fields.some(containsDigits)) return null;
  if (fields.some(containsForbiddenCertainty)) return null;

  return {
    summary,
    strongestReason,
    counterpoint,
    nextChecks,
    limitation,
    mode: "grounded-language-model"
  };
}

export const AGENT_EXPLANATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "strongestReason", "counterpoint", "nextChecks", "limitation"],
  properties: {
    summary: {
      type: "string",
      description: "Concise Finnish summary. Do not include any digits or new facts."
    },
    strongestReason: {
      type: "string",
      description: "The strongest qualitative reason from supplied evidence. Do not include digits."
    },
    counterpoint: {
      type: "string",
      description: "A serious qualitative counterargument from supplied counterarguments or missing evidence. Do not include digits."
    },
    nextChecks: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "string",
        description: "A verification step based only on missing evidence. Do not include digits."
      }
    },
    limitation: {
      type: "string",
      description: "State that this is paper-only decision support and not a guarantee. Do not include digits."
    }
  }
};
