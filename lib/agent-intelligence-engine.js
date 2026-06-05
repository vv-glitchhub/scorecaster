import { buildIntelligence } from "./intelligence-engine";

export function enrichPickWithIntelligence({
  pick,
  intelligence
}) {
  const result =
    buildIntelligence(intelligence);

  const finalScore =
    Number(pick.finalScore || 0) +
    Number(result.totalScore || 0);

  return {
    ...pick,

    finalScore,

    intelligenceScore:
      result.totalScore,

    sourceTrust:
      result.sourceTrust,

    sourceTrustLabel:
      result.sourceTrustLabel,

    intelligenceNotes:
      result.notes,

    newsScore:
      result.newsScore,

    injuryScore:
      result.injuryScore,

    lineupScore:
      result.lineupScore
  };
}
