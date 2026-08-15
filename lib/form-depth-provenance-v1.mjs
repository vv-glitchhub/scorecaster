export const FORM_DEPTH_PROVENANCE_VERSION = "scorecaster-form-depth-provenance-v1";

function clean(value, limit = 140) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function finiteInteger(value, max = 500) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(max, Math.trunc(number)));
}

function safeDepthRow(row = {}) {
  return {
    team: clean(row.team, 120),
    before: finiteInteger(row.before, 20),
    after: finiteInteger(row.after, 20),
    added: finiteInteger(row.added, 20),
    requested: row.requested === true,
    mode: clean(row.mode, 60) || null,
    source: clean(row.source, 100) || null,
    teamIdSource: clean(row.teamIdSource, 60) || null,
    cached: row.cached === true
  };
}

export function safeFormDepthProvenance(provider = {}) {
  const depth = provider?.teamDepth && typeof provider.teamDepth === "object"
    ? provider.teamDepth
    : null;
  if (!depth) return null;
  const rows = Array.isArray(depth.rows) ? depth.rows.map(safeDepthRow).slice(0, 2) : [];
  const addedResults = finiteInteger(depth.addedResults, 100) ?? rows.reduce((sum, row) => sum + (row.added || 0), 0);
  return {
    version: FORM_DEPTH_PROVENANCE_VERSION,
    attempted: depth.attempted === true,
    reason: clean(depth.reason, 100) || null,
    minimumResultsPerTeam: finiteInteger(depth.minimumResultsPerTeam, 10),
    addedResults,
    rows,
    completedDepth: rows.length === 2 && rows.every((row) => (row.after || 0) >= (finiteInteger(depth.minimumResultsPerTeam, 10) || 3)),
    probabilityChanged: false,
    decisionChanged: false,
    paperOnly: true
  };
}

export function attachFormDepthProvenance(pick = {}, provider = {}) {
  const depth = safeFormDepthProvenance(provider);
  if (!depth || !pick?.formRestShadow || typeof pick.formRestShadow !== "object") return pick;
  const originalProvider = pick.formRestShadow.provider && typeof pick.formRestShadow.provider === "object"
    ? pick.formRestShadow.provider
    : {};
  const source = depth.addedResults > 0
    ? `${clean(originalProvider.source || provider.source || "thesportsdb", 80)}+team-history`
    : clean(originalProvider.source || provider.source || "thesportsdb", 80);
  return {
    ...pick,
    formRestShadow: {
      ...pick.formRestShadow,
      provider: {
        ...originalProvider,
        source,
        formDepthProvenance: depth
      }
    },
    formDepthProvenance: depth
  };
}

export const FORM_DEPTH_PROVENANCE_POLICY = Object.freeze({
  probabilityChanged: false,
  decisionChanged: false,
  edgeChanged: false,
  evChanged: false,
  stakeChanged: false,
  maximumTeams: 2,
  paperOnly: true
});
