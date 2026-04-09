export function normalizeOutcomeName(name) {
  const value = String(name ?? "").trim();

  if (!value) return "";
  const lower = value.toLowerCase();

  if (lower === "draw" || lower === "tie" || lower === "x") return "Draw";
  return value;
}

export function mapModelProbabilitiesToOutcomeNames(match, rawModel = {}) {
  const home = normalizeOutcomeName(match?.home_team);
  const away = normalizeOutcomeName(match?.away_team);

  const result = {};

  for (const [key, value] of Object.entries(rawModel ?? {})) {
    const normalizedKey = normalizeOutcomeName(key);
    result[normalizedKey] = value;
  }

  if (home && result[home] == null && rawModel?.home != null) {
    result[home] = rawModel.home;
  }

  if (away && result[away] == null && rawModel?.away != null) {
    result[away] = rawModel.away;
  }

  if (result.Draw == null && rawModel?.draw != null) {
    result.Draw = rawModel.draw;
  }

  const entries = Object.entries(result).filter(
    ([key, value]) => key && Number.isFinite(Number(value))
  );

  if (entries.length === 0) return {};

  const total = entries.reduce((sum, [, value]) => sum + Number(value), 0);
  if (total <= 0) return {};

  return Object.fromEntries(
    entries.map(([key, value]) => [key, Number(value) / total])
  );
}
