import { createHash } from "node:crypto";
import { canonicalFootballTeam, parseFootballDataHistoricalCsv } from "./zero-cost-football-model-lab-v1.mjs";

export const ZERO_COST_FOOTBALL_OPEN_DATA_LOADER_V2_VERSION = "scorecaster-zero-cost-football-open-data-loader-v2";

const STATSBOMB_REPO = "statsbomb/open-data";
const STATSBOMB_COMPETITION_ID = 2;
const STATSBOMB_SEASON_ID = 27;
const FOOTBALL_DATA_URL = "https://www.football-data.co.uk/mmz4281/1516/E0.csv";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableHashRows(rows = []) {
  const normalized = rows.map((row) => ({
    date: row.date,
    homeTeam: canonicalFootballTeam(row.homeTeam),
    awayTeam: canonicalFootballTeam(row.awayTeam),
    homeXg: Number(row.homeXg.toFixed(6)),
    awayXg: Number(row.awayXg.toFixed(6)),
    homeShots: row.homeShots,
    awayShots: row.awayShots,
    homeGoals: row.homeGoals,
    awayGoals: row.awayGoals,
    marketOdds: {
      home: row.marketOdds.home,
      draw: row.marketOdds.draw,
      away: row.marketOdds.away,
      source: row.marketOdds.source,
      timing: row.marketOdds.timing
    }
  }));
  return sha256(JSON.stringify(normalized));
}

async function fetchWithTimeout(url, { responseType = "text", timeoutMs = 30_000, headers = {} } = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Scorecaster-Football-ML-Lab/1.0",
      Accept: responseType === "json" ? "application/json" : "*/*",
      ...headers
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`Fetch failed ${response.status} ${response.statusText}: ${url}`);
  if (responseType === "json") return { value: await response.json(), headers: response.headers };
  return { value: await response.text(), headers: response.headers };
}

async function resolveStatsBombRevision() {
  const endpoint = `https://api.github.com/repos/${STATSBOMB_REPO}/commits/master`;
  const { value } = await fetchWithTimeout(endpoint, { responseType: "json", timeoutMs: 20_000 });
  const sha = String(value?.sha || "").trim();
  if (!/^[a-f0-9]{40}$/i.test(sha)) throw new Error("Unable to resolve immutable StatsBomb open-data revision");
  return sha;
}

function rawStatsBombUrl(revision, path) {
  return `https://raw.githubusercontent.com/${STATSBOMB_REPO}/${revision}/${path}`;
}

function dateDistanceDays(left, right) {
  const a = Date.parse(`${left}T00:00:00Z`);
  const b = Date.parse(`${right}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
  return Math.abs(a - b) / 86_400_000;
}

function summarizeMatchShots(events = [], homeName, awayName) {
  const homeKey = canonicalFootballTeam(homeName);
  const awayKey = canonicalFootballTeam(awayName);
  let homeXg = 0;
  let awayXg = 0;
  let homeShots = 0;
  let awayShots = 0;
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type?.name !== "Shot") continue;
    const xg = Number(event?.shot?.statsbomb_xg);
    if (!Number.isFinite(xg) || xg < 0) continue;
    const team = canonicalFootballTeam(event?.team?.name);
    if (team === homeKey) {
      homeXg += xg;
      homeShots += 1;
    } else if (team === awayKey) {
      awayXg += xg;
      awayShots += 1;
    }
  }
  return { homeXg, awayXg, homeShots, awayShots, shots: homeShots + awayShots };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function pairMarketRow(match, marketRows = []) {
  const home = canonicalFootballTeam(match.homeTeam);
  const away = canonicalFootballTeam(match.awayTeam);
  const candidates = marketRows
    .filter((row) => canonicalFootballTeam(row.homeTeam) === home && canonicalFootballTeam(row.awayTeam) === away)
    .map((row) => ({ row, distance: dateDistanceDays(match.date, row.date) }))
    .filter((item) => item.distance <= 2)
    .sort((left, right) => left.distance - right.distance);
  return candidates[0]?.row || null;
}

export async function loadZeroCostFootballMlDataset(options = {}) {
  const retrievedAt = new Date().toISOString();
  const revision = options.statsBombRevision || await resolveStatsBombRevision();
  const matchesUrl = rawStatsBombUrl(revision, `data/matches/${STATSBOMB_COMPETITION_ID}/${STATSBOMB_SEASON_ID}.json`);
  const [{ value: matches, headers: matchesHeaders }, { value: footballDataCsv, headers: oddsHeaders }] = await Promise.all([
    fetchWithTimeout(matchesUrl, { responseType: "json", timeoutMs: 30_000 }),
    fetchWithTimeout(FOOTBALL_DATA_URL, { responseType: "text", timeoutMs: 30_000 })
  ]);

  const statsBombMatches = (Array.isArray(matches) ? matches : []).map((match) => ({
    matchId: Number(match.match_id),
    date: String(match.match_date || "").slice(0, 10),
    homeTeam: String(match?.home_team?.home_team_name || "").trim(),
    awayTeam: String(match?.away_team?.away_team_name || "").trim(),
    homeGoals: Number(match.home_score),
    awayGoals: Number(match.away_score)
  })).filter((match) => Number.isFinite(match.matchId) && match.date && match.homeTeam && match.awayTeam && Number.isFinite(match.homeGoals) && Number.isFinite(match.awayGoals));

  const footballDataRows = parseFootballDataHistoricalCsv(footballDataCsv);
  const eventHashes = [];
  const xgMatches = await mapWithConcurrency(statsBombMatches, Number(options.concurrency) || 8, async (match) => {
    const eventUrl = rawStatsBombUrl(revision, `data/events/${match.matchId}.json`);
    const { value: text } = await fetchWithTimeout(eventUrl, { responseType: "text", timeoutMs: 45_000 });
    eventHashes.push(`${match.matchId}:${sha256(text)}`);
    const events = JSON.parse(text);
    const shotSummary = summarizeMatchShots(events, match.homeTeam, match.awayTeam);
    return { ...match, ...shotSummary };
  });

  const paired = [];
  const unmatched = [];
  for (const match of xgMatches) {
    const market = pairMarketRow(match, footballDataRows);
    if (!market) {
      unmatched.push({ matchId: match.matchId, date: match.date, homeTeam: match.homeTeam, awayTeam: match.awayTeam });
      continue;
    }
    paired.push({
      matchId: match.matchId,
      date: match.date,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeXg: match.homeXg,
      awayXg: match.awayXg,
      homeShots: match.homeShots,
      awayShots: match.awayShots,
      shots: match.shots,
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
      marketOdds: market.marketOdds,
      marketDate: market.date
    });
  }

  eventHashes.sort();
  const manifest = {
    version: ZERO_COST_FOOTBALL_OPEN_DATA_LOADER_V2_VERSION,
    retrievedAt,
    experiment: "EPL 2015/2016 chronology-safe football ML challenger",
    statsBomb: {
      repository: STATSBOMB_REPO,
      revision,
      competitionId: STATSBOMB_COMPETITION_ID,
      seasonId: STATSBOMB_SEASON_ID,
      competition: "Premier League",
      season: "2015/2016",
      matchesUrl,
      matchesCount: statsBombMatches.length,
      matchesEtag: matchesHeaders.get("etag") || null,
      eventBundleHash: sha256(eventHashes.join("\n")),
      featuresExtracted: ["xg", "shot-count"],
      researchOnly: true,
      productionUseAllowed: false,
      commercialDeploymentAllowed: false,
      attributionRequired: true
    },
    footballData: {
      url: FOOTBALL_DATA_URL,
      rows: footballDataRows.length,
      contentHash: sha256(footballDataCsv),
      etag: oddsHeaders.get("etag") || null,
      marketRole: "benchmark-only-for-independent-ml",
      freeHistoricalAnalysisSource: true,
      rawRedistributionByScorecaster: false
    },
    pairing: {
      pairedRows: paired.length,
      unmatchedRows: unmatched.length,
      allowedDateDistanceDays: 2,
      teamAliasesApplied: true
    },
    immutableInputHash: stableHashRows(paired),
    researchBoundary: {
      zeroCostResearchExperiment: true,
      mayInformPurchaseDecision: true,
      mayFeedProductionPredictions: false,
      mayUpgradePlayDecision: false,
      rawExternalDatasetStoredInRepository: false
    }
  };

  return { rows: paired, unmatched, manifest };
}
