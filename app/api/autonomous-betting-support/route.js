import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildAutonomousBettingBoard } from "../../../lib/autonomous-betting-support.mjs";

export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const reply=(body,status=200)=>Response.json(body,{status,headers});
const integer=(v,f,min,max)=>{const n=Number.parseInt(String(v||""),10);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):f;};

function settledFromRows(rows=[]){
 const byEvent=new Map();
 for(const row of rows){const id=row.event_id;if(!id)continue;const current=byEvent.get(id)||{};if(row.metric==="result"||row.metric==="event_result")current.result=Number(row.value);if(row.metric==="model_probability")current.probability=Number(row.value);if(row.metric==="clv"||row.metric==="price_clv")current.clv=Number(row.value);byEvent.set(id,current);}
 return [...byEvent.values()].filter(s=>[0,1].includes(s.result)&&Number.isFinite(s.probability));
}

export async function GET(request){
 const admin=getSupabaseAdmin();
 if(!admin)return reply({ok:false,error:"Production database is not configured"},503);
 const url=new URL(request.url);
 const allowed=new Set(["hours","limit","bankroll"]);
 if([...url.searchParams.keys()].some(k=>!allowed.has(k)))return reply({ok:false,error:"Unsupported query parameter"},400);
 const hours=integer(url.searchParams.get("hours"),168,6,8760);
 const limit=integer(url.searchParams.get("limit"),10000,100,10000);
 const bankroll=integer(url.searchParams.get("bankroll"),1000,10,1000000);
 const since=new Date(Date.now()-hours*3600000).toISOString();
 try{
  const [{data,error},run]=await Promise.all([
   admin.from("collector_records").select("source_id,event_id,entity_id,sport,league,metric,value,unit,observed_at,collected_at,confidence,source_trust,payload").eq("publishable",true).gte("collected_at",since).order("observed_at",{ascending:false}).limit(limit),
   admin.from("collector_runs").select("status,started_at,completed_at,accepted_count,rejected_count,publishable_count").order("started_at",{ascending:false}).limit(1).maybeSingle()
  ]);
  if(error)throw error;if(run.error)throw run.error;
  const records=(data||[]).map(r=>({sourceId:r.source_id,eventId:r.event_id,entityId:r.entity_id,sport:r.sport,league:r.league,metric:r.metric,value:r.value===null?null:Number(r.value),unit:r.unit,observedAt:r.observed_at,collectedAt:r.collected_at,confidence:Number(r.confidence||0),sourceTrust:Number(r.source_trust||0),payload:r.payload||{}}));
  const last=run.data;
  const collectorHealth=last?{status:last.status==="failed"?"degraded":Date.now()-new Date(last.started_at).getTime()>90*60000?"stale":"healthy",lastRun:last}:{status:"not-activated",lastRun:null};
  return reply({ok:true,filters:{hours,limit,bankroll},...buildAutonomousBettingBoard({records,bankroll,settled:settledFromRows(data||[]),collectorHealth})});
 }catch(error){
  const text=String(error?.message||error).toLowerCase();
  const migration=text.includes("collector_")&&(text.includes("does not exist")||text.includes("schema cache"));
  return reply({ok:false,error:migration?"Collector migration is not active":process.env.NODE_ENV==="production"?"Autonomous betting support could not be loaded":String(error),migrationRequired:migration?"supabase/scorecaster_collector_v1.sql":undefined},migration?503:500);
 }
}
