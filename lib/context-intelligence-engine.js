import {
  calculateAverageSourceTrust,
  labelSourceTrust
} from "./source-trust-engine";

export function calculateContextScore({
  injuries = 0,
  form = 0,
  fatigue = 0,
  motivation = 0,
  lineup = 0,
  travel = 0,
  weather = 0,
  sources = []
}) {
  let score = 0;

  score += Number(form || 0) * 0.02;
  score -= Number(injuries || 0) * 0.03;
  score -= Number(fatigue || 0) * 0.015;
  score += Number(motivation || 0) * 0.015;
  score += Number(lineup || 0) * 0.02;
  score -= Number(travel || 0) * 0.01;
  score += Number(weather || 0) * 0.005;

  const sourceTrust = calculateAverageSourceTrust(sources);

  return {
    contextScore: Math.max(-0.2, Math.min(0.2, score)),
    sourceTrust,
    sourceTrustLabel: labelSourceTrust(sourceTrust),
    factors: {
      injuries,
      form,
      fatigue,
      motivation,
      lineup,
      travel,
      weather
    },
    sources
  };
}

export function summarizeContext(context) {
  const notes = [];

  if (context.factors.form > 0) notes.push("Positive recent form.");
  if (context.factors.injuries > 0) notes.push("Injury concerns detected.");
  if (context.factors.fatigue > 0) notes.push("Fatigue risk detected.");
  if (context.factors.motivation > 0) notes.push("Motivation advantage.");
  if (context.factors.lineup > 0) notes.push("Lineup news supports the pick.");
  if (context.factors.travel > 0) notes.push("Travel burden detected.");

  if (!notes.length) notes.push("No major contextual signal detected.");

  return notes;
}
