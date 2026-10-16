import { GET as getGameData } from "../game-data/route";

export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

// No default 5/10 form, attack or defense: those were placeholders, not
// empirical measurements. Verified W/D/L and goals come from real results.
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const team = String(params.get("team") || "").trim().slice(0,120);
  const sport = String(params.get("sport") || "").trim();
  const before = params.get("before");
  if (!team || !sport) return Response.json({
    ok:false, status:"insufficient-input", error:"Team and canonical sport key are required",
    evidenceSource:null
  },{status:400,headers:HEADERS});

  const query = new URLSearchParams({sport,team,limit:"50"});
  if (before) query.set("before",before);
  // Reuse the bounded, provenance-aware SQL handler rather than making a
  // protected same-origin fetch or an independent non-verified results query.
  const response = await getGameData(new Request(new URL(`/api/game-data?${query}`,request.url),{method:"GET"}));
  const payload = await response.json().catch(()=>null);
  if (!response.ok || payload?.ok !== true) {
    return Response.json({
      ok:false,team,sport,status:"unavailable",last5:[],
      formScore:null,attackRating:null,defenseRating:null,
      evidenceSource:"scorecaster_event_outcomes_v1",
      errorCode:payload?.errorCode||"verified-history-unavailable",
      paperOnly:true
    },{status:response.status===400?400:503,headers:HEADERS});
  }
  const games = (payload.teamMatches||[]).slice(0,5);
  const known = games.length;
  return Response.json({
    ok:true,team,sport,status:known>=3?"verified-form":"thin-verified-history",
    last5:games.map((m)=>m.result),
    matchesVerified:known,
    formScore:known?Number((games.reduce((sum,m)=>sum+m.points,0)/(known*3)*10).toFixed(3)):null,
    // Goal rates are empirical game outcomes, NOT standalone power ratings.
    goalsForPerGame:known?Number((games.reduce((s,m)=>s+m.goalsFor,0)/known).toFixed(3)):null,
    goalsAgainstPerGame:known?Number((games.reduce((s,m)=>s+m.goalsAgainst,0)/known).toFixed(3)):null,
    attackRating:null,defenseRating:null,momentum:known>=3?"observed-results":"unverified",
    historyGames:games.map(({eventId,kickoffAt,result,goalsFor,goalsAgainst})=>({
      eventId,kickoffAt,result,goalsFor,goalsAgainst
    })),
    evidenceSource:"scorecaster_event_outcomes_v1",
    statsBeyondResultsAvailable:false,productionProbabilityChanged:false,
    paperOnly:true
  },{headers:HEADERS});
}
