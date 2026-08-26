import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL_ID = "scorecaster-own-football-ml";
const FAMILY = "multinomial-softmax-regression";
const FEATURE_SCHEMA = "scorecaster-own-football-results-features-v1";
const CLASSES = ["home", "draw", "away"] as const;
const FEATURES = [
  "elo_diff", "home_elo", "away_elo",
  "home_gf", "home_ga", "away_gf", "away_ga",
  "home_home_gf", "home_home_ga", "away_away_gf", "away_away_ga",
  "home_form", "away_form", "form_advantage",
  "home_rest", "away_rest", "rest_advantage",
  "home_history", "away_history",
  "baseline_home", "baseline_draw", "baseline_away",
  "expected_home_goals", "expected_away_goals"
];
const EPS = 1e-12;

type Outcome = {
  id:string; outcome_hash:string; event_id:string; sport_key:string; league:string|null;
  home_team:string; away_team:string; commence_time:string; status:string;
  home_score:number; away_score:number; outcome:string; observed_at:string;
  finality_verified:boolean; source_ids:string[];
};
type State = {
  name:string; matches:number; elo:number; gf:number; ga:number; homeGf:number; homeGa:number;
  awayGf:number; awayGa:number; form:number; lastAt:string|null;
};
type Row = { eventId:string; date:string; outcome:"home"|"draw"|"away"; features:number[]; baseline:Record<string,number> };

const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const finite=(v:unknown,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const mean=(v:number[])=>v.length?v.reduce((s,x)=>s+x,0)/v.length:0;
const teamKey=(v:unknown)=>String(v||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const outcomeClass=(h:number,a:number):"home"|"draw"|"away"=>h>a?"home":h<a?"away":"draw";
const ewma=(cur:number,val:number,alpha:number,count:number)=>count===0?val:alpha*val+(1-alpha)*cur;
const expectedElo=(h:number,a:number,adv=65)=>1/(1+10**(-((h+adv)-a)/400));
const daysBetween=(a:string|null,b:string)=>{const x=Date.parse(a||"");const y=Date.parse(b||"");return Number.isFinite(x)&&Number.isFinite(y)?clamp((y-x)/86400000,1,45):7;};
function poisson(g:number,l:number){let f=1;for(let i=2;i<=g;i++)f*=i;return Math.exp(-l)*l**g/f;}
function normalize(p:Record<string,number>){const vals=CLASSES.map(k=>Math.max(EPS,finite(p[k])));const t=vals.reduce((s,x)=>s+x,0)||1;return{home:vals[0]/t,draw:vals[1]/t,away:vals[2]/t};}
function poisson3(h:number,a:number){const p={home:0,draw:0,away:0};for(let hg=0;hg<=10;hg++)for(let ag=0;ag<=10;ag++){const j=poisson(hg,h)*poisson(ag,a);if(hg>ag)p.home+=j;else if(hg<ag)p.away+=j;else p.draw+=j;}return normalize(p);}
function getState(map:Map<string,State>,name:string){const k=teamKey(name);if(!map.has(k))map.set(k,{name,matches:0,elo:1500,gf:1.35,ga:1.35,homeGf:1.45,homeGa:1.25,awayGf:1.20,awayGa:1.50,form:1.35,lastAt:null});return map.get(k)!;}
function baseline(home:State,away:State){const hl=clamp(Math.sqrt(Math.max(EPS,home.homeGf*away.awayGa)),0.15,4.5);const al=clamp(Math.sqrt(Math.max(EPS,away.awayGf*home.homeGa)),0.15,4.2);const pp=poisson3(hl,al);const eh=expectedElo(home.elo,away.elo);const d=clamp(0.27-Math.abs(home.elo-away.elo)/4000,0.18,0.30);const ep=normalize({home:eh*(1-d),draw:d,away:(1-eh)*(1-d)});return{prob:normalize({home:.68*pp.home+.32*ep.home,draw:.68*pp.draw+.32*ep.draw,away:.68*pp.away+.32*ep.away}),hl,al};}
function featureVector(home:State,away:State,commence:string,b:{prob:Record<string,number>;hl:number;al:number}){const hr=daysBetween(home.lastAt,commence);const ar=daysBetween(away.lastAt,commence);return[
  (home.elo-away.elo)/400, home.elo/2000, away.elo/2000,
  home.gf, home.ga, away.gf, away.ga,
  home.homeGf, home.homeGa, away.awayGf, away.awayGa,
  home.form/3, away.form/3, (home.form-away.form)/3,
  hr/14, ar/14, (hr-ar)/14,
  Math.log1p(home.matches)/5, Math.log1p(away.matches)/5,
  b.prob.home,b.prob.draw,b.prob.away,b.hl/3,b.al/3
];}
function update(home:State,away:State,row:Outcome){const hg=finite(row.home_score);const ag=finite(row.away_score);const exp=expectedElo(home.elo,away.elo);const actual=hg>ag?1:hg<ag?0:.5;const delta=24*(1+Math.log1p(Math.abs(hg-ag))*.25)*(actual-exp);home.elo+=delta;away.elo-=delta;const hp=actual===1?3:actual===.5?1:0;const ap=actual===0?3:actual===.5?1:0;const alpha=.22;home.gf=ewma(home.gf,hg,alpha,home.matches);home.ga=ewma(home.ga,ag,alpha,home.matches);away.gf=ewma(away.gf,ag,alpha,away.matches);away.ga=ewma(away.ga,hg,alpha,away.matches);home.homeGf=ewma(home.homeGf,hg,alpha,home.matches);home.homeGa=ewma(home.homeGa,ag,alpha,home.matches);away.awayGf=ewma(away.awayGf,ag,alpha,away.matches);away.awayGa=ewma(away.awayGa,hg,alpha,away.matches);home.form=ewma(home.form,hp,alpha,home.matches);away.form=ewma(away.form,ap,alpha,away.matches);home.matches++;away.matches++;home.lastAt=row.commence_time;away.lastAt=row.commence_time;}
function buildDataset(outcomes:Outcome[]){const states=new Map<string,State>();const rows:Row[]=[];for(const row of [...outcomes].sort((a,b)=>Date.parse(a.commence_time)-Date.parse(b.commence_time))){const home=getState(states,row.home_team);const away=getState(states,row.away_team);if(Math.min(home.matches,away.matches)>=5){const base=baseline(home,away);rows.push({eventId:row.event_id,date:row.commence_time,outcome:outcomeClass(row.home_score,row.away_score),features:featureVector(home,away,row.commence_time,base),baseline:base.prob});}update(home,away,row);}return rows;}
function classIndex(v:string){return Math.max(0,CLASSES.indexOf(v as any));}
function softmax(logits:number[],temperature=1){const scaled=logits.map(x=>x/Math.max(.2,temperature));const m=Math.max(...scaled);const ex=scaled.map(x=>Math.exp(x-m));const t=ex.reduce((s,x)=>s+x,0)||1;return ex.map(x=>x/t);}
function stats(train:Row[]){const means=FEATURES.map((_,j)=>mean(train.map(r=>r.features[j])));const stds=FEATURES.map((_,j)=>Math.sqrt(mean(train.map(r=>(r.features[j]-means[j])**2)))||1);return{means,stds};}
function transform(features:number[],s:{means:number[];stds:number[]}){return features.map((x,j)=>(x-s.means[j])/Math.max(1e-6,s.stds[j]));}
function logits(weights:number[][],bias:number[],x:number[]){return CLASSES.map((_,c)=>bias[c]+x.reduce((sum,v,j)=>sum+v*weights[c][j],0));}
function predict(model:any,features:number[]){const x=transform(features,model.scaler);const p=softmax(logits(model.weights,model.bias,x),model.temperature||1);return{home:p[0],draw:p[1],away:p[2]};}
function logLoss(rows:Row[],field:(r:Row)=>Record<string,number>){return mean(rows.map(r=>-Math.log(clamp(field(r)[r.outcome],1e-9,1))));}
function brier(rows:Row[],field:(r:Row)=>Record<string,number>){return mean(rows.map(r=>CLASSES.reduce((s,k)=>s+(field(r)[k]-(r.outcome===k?1:0))**2,0)));}
function calibration(rows:Row[],field:(r:Row)=>Record<string,number>){let total=0,n=0;for(const k of CLASSES)for(let b=0;b<10;b++){const lo=b/10,hi=(b+1)/10;const sub=rows.filter(r=>{const p=field(r)[k];return p>=lo&&(b===9?p<=hi:p<hi)});if(!sub.length)continue;const pred=mean(sub.map(r=>field(r)[k]));const actual=mean(sub.map(r=>r.outcome===k?1:0));total+=sub.length*Math.abs(pred-actual);n+=sub.length;}return n?total/n:null;}
function fit(train:Row[],validation:Row[]){const scaler=stats(train);const p=FEATURES.length;let weights=CLASSES.map(()=>Array(p).fill(0));const counts=CLASSES.map(k=>Math.max(1,train.filter(r=>r.outcome===k).length));const total=counts.reduce((s,x)=>s+x,0);let bias=counts.map(x=>Math.log(x/total));let best={loss:Infinity,weights:structuredClone(weights),bias:[...bias],epoch:0};let stale=0;const batchSize=192;for(let epoch=0;epoch<140;epoch++){const lr=.055/Math.sqrt(1+epoch*.08);for(let start=0;start<train.length;start+=batchSize){const batch=train.slice(start,start+batchSize);const gw=CLASSES.map(()=>Array(p).fill(0));const gb=Array(CLASSES.length).fill(0);for(const row of batch){const x=transform(row.features,scaler);const probs=softmax(logits(weights,bias,x));const target=classIndex(row.outcome);for(let c=0;c<CLASSES.length;c++){const err=probs[c]-(c===target?1:0);gb[c]+=err;for(let j=0;j<p;j++)gw[c][j]+=err*x[j];}}for(let c=0;c<CLASSES.length;c++){bias[c]-=lr*gb[c]/batch.length;for(let j=0;j<p;j++)weights[c][j]-=lr*(gw[c][j]/batch.length+.0015*weights[c][j]);}}
    const raw={weights,bias,scaler,temperature:1};const loss=logLoss(validation,r=>predict(raw,r.features));if(loss+1e-7<best.loss){best={loss,weights:structuredClone(weights),bias:[...bias],epoch};stale=0;}else if(++stale>=18)break;
  }
  let temperature=1,bestTemp=Infinity;const base={weights:best.weights,bias:best.bias,scaler,temperature:1};for(let i=0;i<=50;i++){const t=.55+i*.03;const candidate={...base,temperature:t};const loss=logLoss(validation,r=>predict(candidate,r.features));if(loss<bestTemp){bestTemp=loss;temperature=t;}}
  return{weights:best.weights,bias:best.bias,scaler,temperature:Number(temperature.toFixed(4)),selectedEpoch:best.epoch+1,validationLogLoss:bestTemp};
}
function summarize(rows:Row[],field:(r:Row)=>Record<string,number>){return{sampleSize:rows.length,brier:Number(brier(rows,field).toFixed(6)),logLoss:Number(logLoss(rows,field).toFixed(6)),calibrationGap:Number((calibration(rows,field)??0).toFixed(6))};}
function rng(seed=20260826){let s=seed>>>0;return()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};}
function quantile(values:number[],q:number){const a=[...values].sort((x,y)=>x-y);if(!a.length)return null;const pos=clamp(q,0,1)*(a.length-1);const lo=Math.floor(pos),hi=Math.ceil(pos);return lo===hi?a[lo]:a[lo]*(hi-pos)+a[hi]*(pos-lo);}
function bootstrap(rows:Row[],model:any,samples=500){const random=rng();const bd:number[]=[];const ld:number[]=[];for(let s=0;s<samples;s++){let bb=0,mb=0,bl=0,ml=0;for(let i=0;i<rows.length;i++){const r=rows[Math.floor(random()*rows.length)];const mp=predict(model,r.features);bb+=CLASSES.reduce((x,k)=>x+(r.baseline[k]-(r.outcome===k?1:0))**2,0);mb+=CLASSES.reduce((x,k)=>x+(mp[k]-(r.outcome===k?1:0))**2,0);bl+=-Math.log(clamp(r.baseline[r.outcome],1e-9,1));ml+=-Math.log(clamp(mp[r.outcome],1e-9,1));}bd.push((bb-mb)/rows.length);ld.push((bl-ml)/rows.length);}return{samples,brierImprovement95:[quantile(bd,.025),quantile(bd,.975)],logLossImprovement95:[quantile(ld,.025),quantile(ld,.975)]};}
async function sha256(value:unknown){const bytes=new TextEncoder().encode(JSON.stringify(value));const hash=await crypto.subtle.digest("SHA-256",bytes);return[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");}
async function fetchAll(admin:any){const rows:any[]=[];for(let from=0;from<30000;from+=1000){const{data,error}=await admin.from("scorecaster_event_outcomes_v1").select("id,outcome_hash,event_id,sport_key,league,home_team,away_team,commence_time,status,home_score,away_score,outcome,observed_at,finality_verified,source_ids").eq("status","final").eq("finality_verified",true).lte("commence_time",new Date().toISOString()).order("commence_time",{ascending:true}).range(from,from+999);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<1000)break;}return rows as Outcome[];}

Deno.serve(async(req)=>{
  if(req.method!=="POST")return Response.json({ok:false,error:"POST required"},{status:405});
  const url=Deno.env.get("SUPABASE_URL");const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!url||!service)return Response.json({ok:false,error:"Supabase environment unavailable"},{status:503});
  const admin=createClient(url,service,{auth:{persistSession:false}});const presented=req.headers.get("x-scorecaster-cron-token")||"";const{data:auth}=await admin.from("scorecaster_internal_secrets_v1").select("secret_value").eq("name","own_football_trainer_cron").single();if(!presented||presented!==auth?.secret_value)return Response.json({ok:false,error:"Unauthorized"},{status:401});
  const startedAt=new Date().toISOString();const{data:run,error:runError}=await admin.from("scorecaster_ml_training_runs_v1").insert({started_at:startedAt,status:"running",model_id:MODEL_ID,paper_only:true}).select("id").single();if(runError)return Response.json({ok:false,error:runError.message},{status:500});
  try{
    const finals=await fetchAll(admin);const dataset=buildDataset(finals);if(dataset.length<1000)throw new Error(`insufficient-own-history:${dataset.length}`);
    const holdoutStart=Math.floor(dataset.length*.70);const validationStart=Math.floor(dataset.length*.55);const train=dataset.slice(0,validationStart);const validation=dataset.slice(validationStart,holdoutStart);const holdout=dataset.slice(holdoutStart);
    const core=fit(train,validation);const model={version:"scorecaster-own-football-ml-v1",family:FAMILY,featureSchemaVersion:FEATURE_SCHEMA,featureNames:FEATURES,...core};
    const candidate=(r:Row)=>predict(model,r.features);const baselineField=(r:Row)=>r.baseline;
    const trainMetrics={candidate:summarize(train,candidate),baseline:summarize(train,baselineField)};const validationMetrics={candidate:summarize(validation,candidate),baseline:summarize(validation,baselineField)};const holdoutMetrics={candidate:summarize(holdout,candidate),baseline:summarize(holdout,baselineField)};const boot=bootstrap(holdout,model,500);
    const passes={sample:holdout.length>=500,brier:holdoutMetrics.candidate.brier<holdoutMetrics.baseline.brier,logLoss:holdoutMetrics.candidate.logLoss<holdoutMetrics.baseline.logLoss,brierCi:finite(boot.brierImprovement95[0],-1)>0,logLossCi:finite(boot.logLossImprovement95[0],-1)>0,calibration:holdoutMetrics.candidate.calibrationGap<=holdoutMetrics.baseline.calibrationGap+.02};
    const ownBaselineReviewCandidate=Object.values(passes).every(Boolean);const trainingDataHash=await sha256(finals.map(r=>r.outcome_hash));const artifactCore={...model,split:{trainRows:train.length,validationRows:validation.length,holdoutRows:holdout.length,validationStart:validation[0]?.date||null,holdoutStart:holdout[0]?.date||null},source:{id:"openfootball_cc0",license:"CC0-1.0",marketFeaturesUsed:false},safety:{shadowOnly:true,automaticPromotionAllowed:false,productionProbabilityChanged:false,marketBenchmarkRequired:true}};const artifactHash=await sha256({trainingDataHash,artifactCore});const modelVersion=`1.0.${artifactHash.slice(0,10)}`;const trainedAt=new Date().toISOString();const gate={status:ownBaselineReviewCandidate?"own-baseline-review-candidate":"shadow",passes,ownBaselineReviewCandidate,marketBenchmarkRequired:true,automaticPromotionAllowed:false};
    const artifact={...artifactCore,modelId:MODEL_ID,modelVersion,trainingDataHash,artifactHash};
    const{error:artifactError}=await admin.from("scorecaster_model_artifacts_v1").upsert({artifact_hash:artifactHash,model_id:MODEL_ID,model_version:modelVersion,model_family:FAMILY,feature_schema_version:FEATURE_SCHEMA,trained_at:trainedAt,training_cutoff:finals.at(-1)?.commence_time||trainedAt,training_data_hash:trainingDataHash,artifact,train_metrics:trainMetrics,validation_metrics:validationMetrics,holdout_metrics:holdoutMetrics,bootstrap:boot,promotion_gate:gate,independent_from_market:true,shadow_only:true,automatic_promotion_allowed:false,production_probability_changed:false,paper_only:true},{onConflict:"model_id,model_version"});if(artifactError)throw artifactError;
    const{error:registryError}=await admin.from("scorecaster_model_registry_v1").upsert({model_id:MODEL_ID,model_version:modelVersion,sport_key:"soccer",model_family:FAMILY,status:ownBaselineReviewCandidate?"review-candidate":"shadow",feature_schema_version:FEATURE_SCHEMA,training_data_hash:trainingDataHash,code_commit_sha:null,training_config:{source:"openfootball_cc0",sourceLicense:"CC0-1.0",marketFeaturesUsed:false,split:"55/15/30",trainer:"supabase-edge"},validation_metrics:validationMetrics,holdout_metrics:holdoutMetrics,promotion_gate:gate,independent_from_market:true,automatic_promotion_allowed:false,approved_by:null,approved_at:null,paper_only:true,updated_at:trainedAt},{onConflict:"model_id,model_version"});if(registryError)throw registryError;
    const metrics={train:trainMetrics,validation:validationMetrics,holdout:holdoutMetrics,bootstrap:boot,promotionGate:gate};await admin.from("scorecaster_ml_training_runs_v1").update({completed_at:trainedAt,status:"success",model_version:modelVersion,training_rows:train.length,validation_rows:validation.length,holdout_rows:holdout.length,training_data_hash:trainingDataHash,metrics,errors:[]}).eq("id",run.id);
    return Response.json({ok:true,version:"scorecaster-own-football-trainer-v1",model:{id:MODEL_ID,version:modelVersion,family:FAMILY,independentFromMarket:true,shadowOnly:true},dataset:{finalOutcomes:finals.length,usableRows:dataset.length,train:train.length,validation:validation.length,holdout:holdout.length},metrics,automaticPromotionAllowed:false,productionProbabilityChanged:false,realMoneyActionAvailable:false,paperOnly:true},{headers:{"Cache-Control":"no-store"}});
  }catch(error){const completedAt=new Date().toISOString();await admin.from("scorecaster_ml_training_runs_v1").update({completed_at:completedAt,status:"failed",errors:[{error:error instanceof Error?error.message:String(error)}]}).eq("id",run.id);return Response.json({ok:false,version:"scorecaster-own-football-trainer-v1",error:error instanceof Error?error.message:String(error),paperOnly:true},{status:500});}
});
