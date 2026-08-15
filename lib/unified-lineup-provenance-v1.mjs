import { buildUnifiedSportsDataLedger } from "./unified-sports-data-v1.mjs";
import { sanitizeUnifiedOptionalNumerics } from "./unified-optional-numeric-sanitizer-v1.mjs";

export const UNIFIED_LINEUP_PROVENANCE_VERSION = "scorecaster-unified-lineup-provenance-v1";

function clean(value, limit = 140) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function normalizeStarter(player = {}, team = null, source = null) {
  const name = clean(player.name || player.playerName, 120);
  if (!name || player.confirmed === false) return null;
  const importance = Number(player.importance);
  return {
    name,
    position: clean(player.position, 20) || null,
    confirmed: true,
    importance: Number.isFinite(importance) ? Math.max(0.25, Math.min(3, importance)) : 1,
    playerId: player.playerId ?? player.PlayerId ?? null,
    team: clean(team, 120) || null,
    source: clean(source, 100) || null
  };
}

function starterKey(player = {}) {
  if (player.playerId !== null && player.playerId !== undefined && player.playerId !== "") {
    return `id:${String(player.playerId)}`;
  }
  return `name:${clean(player.name, 120).toLowerCase()}`;
}

function mergeStarters(existing = [], additions = []) {
  const output = [];
  const seen = new Set();
  for (const player of [...existing, ...additions]) {
    const normalized = normalizeStarter(player, player.team, player.source);
    if (!normalized) continue;
    const key = starterKey(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output.slice(0, 22);
}

export function attachSportsReportStartersToContext(context = null, sportsReport = {}) {
  const rows = Array.isArray(sportsReport?.lineups) ? sportsReport.lineups : [];
  if (!rows.length) return context;

  const base = context && typeof context === "object" ? context : {};
  const data = base.data && typeof base.data === "object" ? { ...base.data } : {};
  let attached = 0;

  for (const side of ["home", "away"]) {
    const sideRows = rows.filter((row) => row?.side === side);
    if (!sideRows.length) continue;
    const providerStarters = sideRows.flatMap((row) => {
      const starters = Array.isArray(row?.startingPlayers) ? row.startingPlayers : [];
      return starters
        .map((player) => normalizeStarter(player, row.team, row.source))
        .filter(Boolean);
    });
    if (!providerStarters.length) continue;

    const existingSide = data[side] && typeof data[side] === "object" ? data[side] : {};
    const existingStarters = Array.isArray(existingSide.startingPlayers) ? existingSide.startingPlayers : [];
    const startingPlayers = mergeStarters(existingStarters, providerStarters);
    attached += providerStarters.length;
    data[side] = {
      ...existingSide,
      startingPlayers,
      startersConfirmed: existingSide.startersConfirmed === true || sideRows.some((row) => row?.startersConfirmed === true),
      lineupProvenance: {
        version: UNIFIED_LINEUP_PROVENANCE_VERSION,
        providerRows: sideRows.length,
        providerStarterCount: providerStarters.length,
        sourceFamilies: [...new Set(sideRows.map((row) => clean(row?.source, 100)).filter(Boolean))].slice(0, 8),
        probabilityChanged: false
      }
    };
  }

  if (!attached) return context;
  return {
    ...base,
    data,
    lineupProvenance: {
      version: UNIFIED_LINEUP_PROVENANCE_VERSION,
      attachedStarters: attached,
      probabilityChanged: false,
      decisionChanged: false,
      paperOnly: true
    }
  };
}

export function buildUnifiedSportsDataLedgerWithLineupProvenance({
  pick = {},
  sportsReport = {},
  secondaryOdds = null,
  context = null,
  weather = null,
  now = Date.now()
} = {}) {
  const enrichedContext = attachSportsReportStartersToContext(context, sportsReport);
  return buildUnifiedSportsDataLedger({
    pick: sanitizeUnifiedOptionalNumerics(pick),
    sportsReport: sanitizeUnifiedOptionalNumerics(sportsReport),
    secondaryOdds: sanitizeUnifiedOptionalNumerics(secondaryOdds),
    context: sanitizeUnifiedOptionalNumerics(enrichedContext),
    weather: sanitizeUnifiedOptionalNumerics(weather),
    now
  });
}

export const UNIFIED_LINEUP_PROVENANCE_POLICY = Object.freeze({
  probabilityChanged: false,
  decisionChanged: false,
  stakeChanged: false,
  maxPlayersPerSide: 22,
  requiresConfirmedPlayers: true,
  optionalNumericSanitizer: "scorecaster-unified-optional-numeric-sanitizer-v1",
  paperOnly: true
});
