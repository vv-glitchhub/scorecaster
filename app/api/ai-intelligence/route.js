import {getSupabaseAdmin} from '../../../lib/supabase-admin';
import {buildIntelligenceReport} from '../../../lib/ai-intelligence-collector.mjs';
export const dynamic='force-dynamic';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

const mapRow=r=>({id:r.id,eventId:r.event_id,team:r.team,category:r.category,title:r.title,summary:r.summary,sourceId:r.source_id,sourceName:r.source_name,sourceType:r.source_type,sourceUrl:r.source_url,canonicalUrl:r.canonical_url,publishedAt:r.published_at,observedAt:r.observed_at,direction:Number(r.direction),severity:Number(r.severity),relevance:Number(r.relevance),confidence:Number(r.confidence),sourceTrust:Number(r.source_trust),usedBecause:r.used_because});

export async function GET(request){
 const admin=getSupabaseAdmin(); if(!admin)return reply({ok:false,error:'Database not configured'},503);
 const url=new URL(request.url); const eventId=url.searchParams.get('eventId');
 if(!eventId)return reply({ok:false,error:'eventId is required'},400);
 const baseHomeProbability=Math.max(.02,Math.min(.98,Number(url.searchParams.get('baseHomeProbability')||.5)));
 const {data,error}=await admin.from('intelligence_items').select('*').eq('event_id',eventId).order('published_at',{ascending:false}).limit(250);
 if(error){const migration=String(error.message||'').includes('intelligence_items');return reply({ok:false,error:migration?'AI intelligence migration is not active':error.message,migrationRequired:migration?'supabase/scorecaster_ai_intelligence_v1.sql':undefined},migration?503:500);}
 const report=buildIntelligenceReport({eventId,homeTeam:url.searchParams.get('homeTeam'),awayTeam:url.searchParams.get('awayTeam'),baseHomeProbability,items:(data||[]).map(mapRow)});
 return reply({ok:true,...report});
}

export async function POST(request){
 const secret=request.headers.get('x-scorecaster-collector-secret');
 if(!process.env.COLLECTOR_SECRET||secret!==process.env.COLLECTOR_SECRET)return reply({ok:false,error:'Unauthorized'},401);
 const admin=getSupabaseAdmin(); if(!admin)return reply({ok:false,error:'Database not configured'},503);
 const body=await request.json().catch(()=>null); const items=Array.isArray(body?.items)?body.items:[];
 if(!items.length||items.length>500)return reply({ok:false,error:'items must contain 1-500 signals'},400);
 const rows=items.map(x=>({event_id:x.eventId,team:x.team||null,category:x.category,title:x.title||null,summary:x.summary||null,source_id:x.sourceId,source_name:x.sourceName,source_type:x.sourceType||'unknown',source_url:x.sourceUrl||null,canonical_url:x.canonicalUrl||x.sourceUrl||null,published_at:x.publishedAt||new Date().toISOString(),direction:Number(x.direction||0),severity:Number(x.severity??.5),relevance:Number(x.relevance??.5),confidence:Number(x.confidence??.5),source_trust:Number(x.sourceTrust??.5),used_because:x.usedBecause||null,raw_payload:x.rawPayload||{}}));
 if(rows.some(r=>!r.event_id||!r.category||!r.source_id||!r.source_name))return reply({ok:false,error:'eventId, category, sourceId and sourceName are required'},400);
 const {data,error}=await admin.from('intelligence_items').upsert(rows,{onConflict:'event_id,source_id,canonical_url'}).select('id');
 if(error)return reply({ok:false,error:error.message},500);
 return reply({ok:true,accepted:data?.length||0});
}
