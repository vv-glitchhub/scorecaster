// lib/betting/outcome-mapper.js

function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function mapModelProbabilitiesToOutcomeNames(match, rawModel) {
  if (!match || !rawModel) return {};

  const mapped = {};

  if (match.home_team != null) {
    mapped[match.home_team] = rawModel.home ?? null;
  }

  if (match.away_team != null) {
    mapped[match.away_team] = rawModel.away ?? null;
  }

  // Yleisimmät draw/tie nimet
  const drawValue = rawModel.draw ?? rawModel.tie ?? null;
  mapped["Draw"] = drawValue;
  mapped["draw"] = drawValue;
  mapped["Tie"] = drawValue;
  mapped["tie"] = drawValue;

  return mapped;
}

export function getMappedModelProbability({
  outcomeName,
  match,
  rawModel,
}) {
  const name = normalizeName(outcomeName);

  if (!match || !rawModel) return null;

  if (name === normalizeName(match.home_team)) return rawModel.home ?? null;
  if (name === normalizeName(match.away_team)) return rawModel.away ?? null;
  if (name === "draw" || name === "tie") return rawModel.draw ?? rawModel.tie ?? null;

  return null;
}
