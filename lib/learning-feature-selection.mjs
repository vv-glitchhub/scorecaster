function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function selectLatestEligiblePregameFeatures(rows = [], {
  now = Date.now(),
  leagues = []
} = {}) {
  const cutoff = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const allowed = new Set((Array.isArray(leagues) ? leagues : []).map((value) => String(value || "")));
  const sorted = [...(Array.isArray(rows) ? rows : [])].sort((left, right) => {
    return (timestamp(right?.as_of) ?? -Infinity) - (timestamp(left?.as_of) ?? -Infinity);
  });
  const latest = new Map();

  for (const row of sorted) {
    const eventId = String(row?.event_id || "").trim();
    const sportKey = String(row?.sport_key || "").trim();
    const asOf = timestamp(row?.as_of);
    const kickoff = timestamp(row?.commence_time);
    if (!eventId || !allowed.has(sportKey)) continue;
    if (asOf === null || kickoff === null || kickoff >= cutoff || asOf >= kickoff) continue;
    if (row?.eligible_for_model !== true || row?.leakage_guard_passed !== true) continue;
    if (!latest.has(eventId)) latest.set(eventId, row);
  }

  return [...latest.values()];
}
