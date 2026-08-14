import {
  decisionEvidenceBoundaryText,
  sanitizeDecisionEvidenceSealV1
} from "./decision-evidence-seal-v1.mjs";

const DECISIONS = new Set(["PLAY", "WATCH", "SKIP"]);
const LANGUAGES = new Set(["fi", "en", "es"]);
const MAX_LIST_ITEMS = 6;
const FORBIDDEN_CERTAINTY = [
  "varma voitto", "varmasti voittaa", "taattu voitto", "takuuvoitto", "pelaa nyt", "lyö veto", "panosta oikeaa rahaa", "riskitön",
  "guaranteed win", "certain win", "bet now", "place a bet", "use real money", "risk-free",
  "victoria segura", "ganancia garantizada", "apuesta ahora", "haz una apuesta", "dinero real", "sin riesgo"
];
const EXTERNAL_FACT_ROOTS = [
  "loukkaant", "kokoonpan", "sää", "motivaat", "uutis", "vire", "pelikunto",
  "injur", "lineup", "weather", "motivat", "news", "form",
  "lesion", "alineaci", "tiempo", "motivaci", "noticia", "racha"
];

function language(value) {
  const normalized = String(value || "fi").toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.has(normalized) ? normalized : "fi";
}

function finite(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
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
  return (Array.isArray(value) ? value : []).map((item) => text(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function mergeLists(...values) {
  const merged = [];
  const seen = new Set();
  for (const value of values) {
    for (const item of Array.isArray(value) ? value : []) {
      const safe = text(item, 220);
      if (!safe || seen.has(safe)) continue;
      seen.add(safe);
      merged.push(safe);
      if (merged.length >= MAX_LIST_ITEMS) return merged;
    }
  }
  return merged;
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
  const source = input?.decision && typeof input.decision === "object" ? input.decision : input;
  const decision = text(source.decision, 12).toUpperCase();
  if (!DECISIONS.has(decision)) return null;
  const fusion = source.intelligenceFusionV2 && typeof source.intelligenceFusionV2 === "object"
    ? source.intelligenceFusionV2
    : {};
  const eventId = text(source.gameId || source.eventId || source.id, 180) || null;
  const selection = text(source.selection || source.label, 120, "Selection");
  const suppliedDecisionEvidenceSeal = source.decisionEvidenceSeal;
  const decisionEvidenceSeal = suppliedDecisionEvidenceSeal === null || suppliedDecisionEvidenceSeal === undefined
    ? null
    : sanitizeDecisionEvidenceSealV1(suppliedDecisionEvidenceSeal, { decision, selection, eventId });
  if (suppliedDecisionEvidenceSeal !== null && suppliedDecisionEvidenceSeal !== undefined && !decisionEvidenceSeal) {
    return null;
  }

  const contract = {
    contractVersion: "agent-v10-grounded-3",
    eventId,
    decision,
    match: text(source.match || [source.homeTeam, source.awayTeam].filter(Boolean).join(" vs "), 180, "Match"),
    selection,
    league: text(source.leagueTitle || source.league || source.sportKey, 100, "Unknown league"),
    bookmaker: text(source.bookmaker, 100, "Unknown bookmaker"),
    odds: bounded(source.odds, 1.001, 10000),
    consensusProbability: probability(source.stressTest?.probability ?? source.consensusProbability ?? source.modelProbability),
    stressLower: probability(source.stressTest?.lower ?? source.stressLower ?? source.uncertaintyLower),
    stressUpper: probability(source.stressTest?.upper ?? source.stressUpper ?? source.uncertaintyUpper),
    baseEv: bounded(source.stressTest?.baseEv ?? source.baseEv ?? source.ev, -10, 100),
    downsideEv: bounded(source.stressTest?.downsideEv ?? source.downsideEv, -10, 100),
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
      mergeLists(
        decisionEvidenceSeal ? [decisionEvidenceBoundaryText(decisionEvidenceSeal)] : [],
        fusion.explanationEvidence,
        list(source.evidence)
      ),
      "The decision is based on Scorecaster's deterministic market and risk engine."
    ),
    counterArguments: withFallback(
      mergeLists(fusion.counterArguments, list(source.counterArguments)),
      "Market consensus can be wrong or change before the event."
    ),
    missingEvidence: withFallback(
      mergeLists(fusion.missingEvidence, list(source.missingEvidence)),
      "market-data freshness immediately before the event"
    ),
    learningNote: text(source.learningSignal?.note ?? source.learningNote, 300),
    learningSampleSize: bounded(source.learningSignal?.sampleSize ?? source.learningSampleSize, 0, 1000000),
    decisionEvidenceSeal,
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

const localized = {
  fi: {
    play: "Laskettu evidenssi ja riskirajat läpäisevät nykyisen päätösportin.",
    watch: "Kohteessa on kiinnostavaa hintaevidenssiä, mutta konservatiivinen portti ei anna täyttä hyväksyntää.",
    skip: "Kohteen hinta, data tai riskiprofiili ei täytä turvallista päätösporttia.",
    verify: "Vahvista",
    limitation: "Tämä on virtuaalisen paperiseurannan päätöstuki. Se ei takaa lopputulosta eikä aseta oikean rahan vetoa."
  },
  en: {
    play: "The calculated evidence and risk limits pass the current decision gate.",
    watch: "The pick has interesting price evidence, but the conservative gate does not grant full approval.",
    skip: "The price, data or risk profile does not pass the safe decision gate.",
    verify: "Verify",
    limitation: "This is decision support for virtual paper tracking. It does not guarantee an outcome or place a real-money bet."
  },
  es: {
    play: "La evidencia calculada y los límites de riesgo superan el filtro de decisión actual.",
    watch: "El pronóstico tiene evidencia de precio interesante, pero el filtro conservador no concede aprobación completa.",
    skip: "La cuota, los datos o el perfil de riesgo no superan el filtro de decisión seguro.",
    verify: "Verifica",
    limitation: "Esto es apoyo a decisiones para seguimiento simulado. No garantiza un resultado ni realiza apuestas con dinero real."
  }
};

export function buildDeterministicAgentExplanation(contract, requestedLanguage = "fi") {
  const lang = language(requestedLanguage);
  const copy = localized[lang];
  const reason = contract.decisionReason || (contract.decision === "PLAY" ? copy.play : contract.decision === "WATCH" ? copy.watch : copy.skip);

  return {
    summary: `${contract.selection}: ${contract.decision}. ${reason}`.slice(0, 480),
    strongestReason: contract.evidence[0].slice(0, 320),
    counterpoint: contract.counterArguments[0].slice(0, 320),
    nextChecks: contract.missingEvidence.slice(0, 4).map((item) => `${copy.verify} ${item}.`),
    limitation: copy.limitation,
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

export function validateGeneratedAgentExplanation(value, contract, requestedLanguage = "fi") {
  if (!value || typeof value !== "object" || Array.isArray(value) || !contract) return null;
  const lang = language(requestedLanguage);
  const copy = localized[lang];
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
    nextChecks: checkIndexes.map((index) => `${copy.verify} ${contract.missingEvidence[index]}.`),
    limitation,
    mode: "grounded-language-model"
  };
}

export const AGENT_EXPLANATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "strongestEvidenceIndex", "counterArgumentIndex", "nextCheckIndexes", "limitation"],
  properties: {
    summary: { type: "string", description: "Concise qualitative summary in the requested language. Do not include digits, new facts or changed metrics." },
    strongestEvidenceIndex: { type: "integer", minimum: 0, maximum: 5, description: "Index of the strongest item in the supplied evidence array." },
    counterArgumentIndex: { type: "integer", minimum: 0, maximum: 5, description: "Index of the strongest item in the supplied counterArguments array." },
    nextCheckIndexes: { type: "array", minItems: 1, maxItems: 4, items: { type: "integer", minimum: 0, maximum: 5 }, description: "Indexes from the supplied missingEvidence array." },
    limitation: { type: "string", description: "State in the requested language that this is paper-only decision support and not a guarantee. Do not include digits." }
  }
};
