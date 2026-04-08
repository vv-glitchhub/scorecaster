// lib/betting/outcome-mapper.js

function mapModelProbabilitiesToOutcomeNames(match, rawModel) {
  if (!match || !rawModel) return {};

  return {
    [match.home_team]: rawModel.home ?? null,
    Draw: rawModel.draw ?? rawModel.tie ?? null,
    [match.away_team]: rawModel.away ?? null,
  };
}

module.exports = {
  mapModelProbabilitiesToOutcomeNames,
};
