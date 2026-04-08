function normalizeName(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function mapModelProbabilitiesToOutcomeNames(match, rawModel) {
  if (!match || !rawModel) return {};

  const drawValue = rawModel.draw ?? rawModel.tie ?? null;

  return {
    [match.home_team]: rawModel.home ?? null,
    [match.away_team]: rawModel.away ?? null,
    Draw: drawValue,
    draw: drawValue,
    Tie: drawValue,
    tie: drawValue,
  };
}

export function getMappedModelProbability({ outcomeName, match, rawModel }) {
  const name = normalizeName(outcomeName);

  if (!match || !rawModel) return null;

  if (name === normalizeName(match.home_team)) return rawModel.home ?? null;
  if (name === normalizeName(match.away_team)) return rawModel.away ?? null;
  if (name === "draw" || name === "tie") return rawModel.draw ?? rawModel.tie ?? null;

  return null;
}
