import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { OWNED_FOOTBALL_LEAGUES } from "../../../lib/active-market-universe.js";
import { buildVerifiedGamePerformance } from "../../../lib/verified-game-performance.mjs";
import {
  isSupabaseServiceRestricted,
  restrictedSupabaseResponse
} from "../../../lib/supabase-service-restriction.mjs";

export const dynamic = "force-dynamic";
const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};
const respond = (body,status=200)=>Response.json(body,{status,headers:HEADERS});
const CORE = new Set(OWNED_FOOTBALL_LEAGUES);
const ALL_KEYS = new Set(["sport","team","before","limit"]);

// This is a read-only, privacy-safe view of EXISTING final-score evidence.
// Nothing is acquired from an unreliable provider and nothing new is stored.
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key)=>!ALL_KEYS.has(key))) {
    return respond({ok:false,error:"Unsupported query parameter"},400);
  }
  const sport = String(params.get("sport") || "").trim();
  if (!CORE.has(sport)) return respond({ok:false,error:"Supported core football league is required"},400);
  const team = String(params.get("team") || "").trim().slice(0,120);
  const requestedLimit = Number(params.get("limit") || 100);
  if (!Number.isInteger(requestedLimit) || requestedLimit<1 || requestedLimit>200) {
    return respond({ok:false,error:"Limit must be between 1 and 200"},400);
  }
  const before = params.get("before");
  const beforeMs = before ? Date.parse(before) : Infinity;
  if (before && !Number.isFinite(beforeMs)) {
    return respond({ok:false,error:"Invalid cutoff timestamp"},400);
  }
  // Sanity limit: fixed query shape, fixed column list, bounded rows.
  const admin = getSupabaseAdmin();
  if (!admin) return respond({ok:false,error:"Game data store unavailable",paperOnly:true},503);
  try {
    let query = admin
      .from("scorecaster_event_outcomes_v1")
      .select("event_id,sport_key,home_team,away_team,commence_time,status,finality_verified,home_score,away_score,captured_at")
      .eq("sport_key",sport)
      .eq("status","final")
      .eq("finality_verified",true);
    if (before) query = query.lt("commence_time",before).lt("captured_at",before);
    const source = await query
      .order("commence_time",{ascending:false})
      .limit(Math.min(1000,requestedLimit*5));
    if (Number(source?.status)===402 || isSupabaseServiceRestricted(source?.error)) {
      return respond(restrictedSupabaseResponse("Verified game data"),503);
    }
    if (source?.error) return respond({ok:false,error:"Verified game data could not be loaded",paperOnly:true},503);

    const performance = buildVerifiedGamePerformance(source?.data || [],{
      sportKey:sport, team, before, limit:requestedLimit
    });
    return respond({
      ok:true,
      sport,team:team||null,
      before:before||null,
      ...performance,
      queryBounded:true,
      paperOnly:true,
      trainingSafeWithPointInTimeCutoff:Boolean(before)
    });
  } catch (error) {
    if (isSupabaseServiceRestricted(error)) return respond(restrictedSupabaseResponse("Verified game data"),503);
    return respond({ok:false,error:"Verified game data unavailable",paperOnly:true},503);
  }
}
