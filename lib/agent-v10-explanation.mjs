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
const EXTERNAL_FACT_ROOTS = [
  "loukkaant",
  "kokoonpan",
  "sää",
  "motivaat",
  "uutis",
  "vire",
  "pelikunto"
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

function withFallback(items, fallback) {
  return items.length ? items : [fallback];
}

export function sanitizeAgentExplanationInput(input = {}) {
  const source = input?.decision && typeof input.decision === "object"
    ? input.decision
    : input;
  const decision = text(source.decision, 12).toUpperCase();
  if (!DECISIONS.has(decision)) return null;

  const contract = {
    contractVersion: "agent-v10-grounded-2",
    decision,
    match: text(source.match || [source.homeTeam, source.awayTeam].filter(Boolean).join(" vs "), 180, "Ottelu"),
    selection: text(source.selection || source.label, 120, "Valinta"),
    league: text(source.leagueTitle || source.league || source.sportKey, 100, "Tuntematon liiga"),
    bookmaker: text(source.bookmaker, 100, "Tuntematon vedonvälittäjä"),
    odds: bounded(source.odds, 1.001, 10000),
    consensusProbability: probability(
      source.stressTest?.probability ?? source.consensusProbability ?? source.modelProbability
    ),
    stressLower: probability(
      source.stressTest?.lower ?? source.stressLower ?? source.uncertaintyLower
    ),
    stressUpper: probability(
      source.stressTest?.upper ?? source.stressUpper ?? source.uncertaintyUpper
    ),
    baseEv: bounded(
      source.stressTest?.baseEv ?? source.baseEv ?? source.ev,
      -10,
      100
    ),
    downsideEv: bounded(
      source.stressTest?.downsideEv ?? source.downsideEv,
      -10,
      100
    ),
    edge: bounded(source.edge, -1, 1),
    confidence: probability(source.confidence),
    trustScore: bounded(source.trustScore, 0, 100),
    robustnessScore: probability(source.robustnessScore),
    bookmakerCount: bounded(source.bookmakerCount, 0, 1000),
    freshness: text(source.freshnessLabel || source.dataQuality?.freshness || source.freshness, 40, "unknown"),
    minimumPlayOdds: bounded(source.priceGuard?.minimumPlayOdds ?? source.minimumPlayOdds, 1.001, 10000),
    suggestedStake: bounded(source.suggestedStake, 0, 10000000),
    decisionReason: text(source.decisionReason, 360),
    portfolioReason: text(source.portfolioReason, 260),
    evidence: withFallback(
      list(source.evidence),
      "Päätös perustuu Scorecasterin deterministiseen markkina- ja riskimoottoriin."
    ),
    counterArguments: withFallback(
      list(source.counterArguments),
      "Markkinakonsensus voi olla väärässä tai muuttua ennen tapahtumaa."
    ),
    missingEvidence: withFallback(
      list(source.missingEvidence),
      "markkinadatan tuoreus juuri ennen tapahtumaa"
    ),
    learningNote: text(source.learningSignal?.note ?? source.learningNote, 300),
    learningSampleSize: bounded(
      source.learningSignal?.sampleSize ?? source.learningSampleSize,
      0,
      1000000
    ),
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

  return {
    summary: `${contract.selection}: ${contract.decision}. ${reason}`.slice(0, 480),
    strongestReason: contract.evidence[0].slice(0, 320),
    counterpoint: contract.counterArguments[0].slice(0, 320),
    nextChecks: contract.missingEvidence.slice(0, 4).map((item) => `Vahvista ${item}.`),
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

function containsUnsupportedExternalFact(value, contract) {
  const normalized = String(value || "").toLowerCase();
  const source = canonicalAgentExplanationInput(contract).toLowerCase();
  return EXTERNAL_FACT_ROOTS.some((root) => normalized.includes(root) && !source.includes(root));
}

function validIndex(value, items) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < items.length ? index : null;
}

export function validateGeneratedAgentExplanation(value, contract) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !contract) return null;

  const summary = text(value.summary, 480);
  const limitation = text(value.limitation, 320);
  const evidenceIndex = validIndex(value.strongestEvidenceIndex, contract.evidence);
  const counterIndex = validIndex(value.counterArgumentIndex, contract.counterArguments);
  const checkIndexes = [...new Set(Array.isArray(value.nextCheckIndexes) ? value.nextCheckIndexes : [])]
    .map((item) => validIndex(item, contract.missingEvidence))
    .filter((item) => item !== null)
    .slice(0, 4);

  if (!summary || !limitation) return null;
  if (evidenceIndex === null || counterIndex === null || !checkIndexes.length) return null;
  if ([summary, limitation].some(containsDigits)) return null;
  if ([summary, limitation].some(containsForbiddenCertainty)) return null;
  if ([summary, limitation].some((field) => containsUnsupportedExternalFact(field, contract))) return null;

  return {
    summary,
    strongestReason: contract.evidence[evidenceIndex].slice(0, 320),
    counterpoint: contract.counterArguments[counterIndex].slice(0, 320),
    nextChecks: checkIndexes.map((index) => `Vahvista ${contract.missingEvidence[index]}.`),
    limitation,
    mode: "grounded-language-model"
  };
}

export const AGENT_EXPLANATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "strongestEvidenceIndex", "counterArgumentIndex", "nextCheckIndexes", "limitation"],
  properties: {
    summary: {
      type: "string",
      description: "Concise Finnish qualitative summary. Do not include digits, new facts or changed metrics."
    },
    strongestEvidenceIndex: {
      type: "integer",
      minimum: 0,
      maximum: 5,
      description: "Index of the strongest item in the supplied evidence array."
    },
    counterArgumentIndex: {
      type: "integer",
      minimum: 0,
      maximum: 5,
      description: "Index of the strongest item in the supplied counterArguments array."
    },
    nextCheckIndexes: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "integer",
        minimum: 0,
        maximum: 5
      },
      description: "Indexes from the supplied missingEvidence array."
    },
    limitation: {
      type: "string",
      description: "State in Finnish that this is paper-only decision support and not a guarantee. Do not include digits."
    }
  }
};
