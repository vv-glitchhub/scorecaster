import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL_ID = "scorecaster-own-football-ml";
const FAMILY = "diagonal-lda-softmax";
const FEATURE_SCHEMA = "scorecaster-own-football-results-features-v1";
const CLASSES = ["home", "draw", "away"] as const;
const FEATURES = [
  "elo_diff", "home_elo", "away_elo", "home_gf", "home_ga", "away_gf", "away_ga",
  "home_home_gf", "home_home_ga", "away_away_gf", "away_away_ga", "home_form", "away_form",
  "form_advantage", "home_rest", "away_rest", "rest_advantage", "home_history", "away_history",
  "baseline_home", "baseline_draw", "baseline_away", "expected_home_goals", "expected_away_goals",
];
const EPS = 1e-12;
const MAX_SOURCE_ROWS = 3000;
const BOOTSTRAP_SAMPLES = 24;

type Outcome = {
  outcome_hash: string;
  event_id: string;
  sport_key: string;
  league: string | null;
  home_team: string;
  away_team: string;
  commence_time: string;
  home_score: number;
  away_score: number;
  source_ids: unknown;
};
type State = {
  matches:number; elo:number; gf:number; ga:number; homeGf:number; homeGa:number;
  awayGf:number; awayGa:number; form:number; lastAt:string|null;
};
type Row = { eventId:string; date:string; outcome:"home"|"draw"|"away"; features:number[]; baseline:Record<string,number> };
type Prob = { home:number; draw:number; away:number };

const clamp = (v:number, lo:number, hi:number) => Math.max(lo, Math.min(hi, v));
const finite = (v:unknown, fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const mean = (values:number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const key = (value:unknown) => String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ewma = (current:number, value:number, alpha:number, n:number) => n === 0 ? value : alpha * value + (1 - alpha) * current;
const expectedElo = (home:number, away:number, advantage=65) => 1 / (1 + 10 ** (-((home + advantage) - away) / 400));
const days = (from:string|null, to:string) => {
  const a=Date.parse(from||""), b=Date.parse(to||"");
  return Number.isFinite(a) && Number.isFinite(b) ? clamp((b-a)/86400000,1,45) : 7;
};
const sourceIncludes = (value:unknown, id:string) => Array.isArray(value) ? value.includes(id) : typeof value === "string" ? value.includes(id) : false;
const errorMessage = (error:unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    return [value.message, value.details, value.hint, value.code].filter(Boolean).map(String).join(" | ") || JSON.stringify(value);
  }
  return String(error);
};
function poisson(goals:number, lambda:number) {
  let f=1;
  for(let i=2;i<=goals;i++) f*=i;
  return Math.exp(-lambda)*lambda**goals/f;
}
function normalize(p:Record<string,number>):Prob {
  const values=CLASSES.map(k=>Math.max(EPS,finite(p[k])));
  const total=values.reduce((s,x)=>s+x,0)||1;
  return {home:values[0]/total,draw:values[1]/total,away:values[2]/total};
}
function poisson3(home:number,away:number):Prob {
  const p={home:0,draw:0,away:0};
  for(let hg=0;hg<=10;hg++) for(let ag=0;ag<=10;ag++) {
    const joint=poisson(hg,home)*poisson(ag,away);
    if(hg>ag)p.home+=joint; else if(hg<ag)p.away+=joint; else p.draw+=joint;
  }
  return normalize(p);
}
function state(map:Map<string,State>,name:string) {
  const k=key(name);
  if(!map.has(k)) map.set(k,{matches:0,elo:1500,gf:1.35,ga:1.35,homeGf:1.45,homeGa:1.25,awayGf:1.20,awayGa:1.50,form:1.35,lastAt:null});
  return map.get(k)!;
}
function base(home:State,away:State) {
  const hl=clamp(Math.sqrt(Math.max(EPS,home.homeGf*away.awayGa)),.15,4.5);
  const al=clamp(Math.sqrt(Math.max(EPS,away.awayGf*home.homeGa)),.15,4.2);
  const pp=poisson3(hl,al);
  const expected=expectedElo(home.elo,away.elo);
  const draw=clamp(.27-Math.abs(home.elo-away.elo)/4000,.18,.30);
  const eloProb=normalize({home:expected*(1-draw),draw,away:(1-expected)*(1-draw)});
  return {prob:normalize({home:.68*pp.home+.32*eloProb.home,draw:.68*pp.draw+.32*eloProb.draw,away:.68*pp.away+.32*eloProb.away}),hl,al};
}
function vector(home:State,away:State,date:string,b:{prob:Prob;hl:number;al:number}) {
  const hr=days(home.lastAt,date), ar=days(away.lastAt,date);
  return [(home.elo-away.elo)/400,home.elo/2000,away.elo/2000,home.gf,home.ga,away.gf,away.ga,home.homeGf,home.homeGa,away.awayGf,away.awayGa,home.form/3,away.form/3,(home.form-away.form)/3,hr/14,ar/14,(hr-ar)/14,Math.log1p(home.matches)/5,Math.log1p(away.matches)/5,b.prob.home,b.prob.draw,b.prob.away,b.hl/3,b.al/3];
}
function update(home:State,away:State,row:Outcome) {
  const hg=finite(row.home_score), ag=finite(row.away_score), expected=expectedElo(home.elo,away.elo);
  const result=hg>ag?1:hg<ag?0:.5;
  const delta=24*(1+Math.log1p(Math.abs(hg-ag))*.25)*(result-expected);
  home.elo+=delta; away.elo-=delta;
  const hp=result===1?3:result===.5?1:0, ap=result===0?3:result===.5?1:0, alpha=.22;
  home.gf=ewma(home.gf,hg,alpha,home.matches); home.ga=ewma(home.ga,ag,alpha,home.matches);
  away.gf=ewma(away.gf,ag,alpha,away.matches); away.ga=ewma(away.ga,hg,alpha,away.matches);
  home.homeGf=ewma(home.homeGf,hg,alpha,home.matches); home.homeGa=ewma(home.homeGa,ag,alpha,home.matches);
  away.awayGf=ewma(away.awayGf,ag,alpha,away.matches); away.awayGa=ewma(away.awayGa,hg,alpha,away.matches);
  home.form=ewma(home.form,hp,alpha,home.matches); away.form=ewma(away.form,ap,alpha,away.matches);
  home.matches++; away.matches++; home.lastAt=row.commence_time; away.lastAt=row.commence_time;
}
function dataset(outcomes:Outcome[]) {
  const states=new Map<string,State>(), rows:Row[]=[];
  for(const row of [...outcomes].sort((a,b)=>Date.parse(a.commence_time)-Date.parse(b.commence_time))) {
    const home=state(states,row.home_team), away=state(states,row.away_team);
    if(Math.min(home.matches,away.matches)>=5) {
      const b=base(home,away);
      rows.push({eventId:row.event_id,date:row.commence_time,outcome:row.home_score>row.away_score?"home":row.home_score<row.away_score?"away":"draw",features:vector(home,away,row.commence_time,b),baseline:b.prob});
    }
    update(home,away,row);
  }
  return rows;
}
function scaler(rows:Row[]) {
  const means=FEATURES.map((_,j)=>mean(rows.map(r=>r.features[j])));
  const stds=FEATURES.map((_,j)=>Math.sqrt(mean(rows.map(r=>(r.features[j]-means[j])**2)))||1);
  return {means,stds};
}
function transform(x:number[],s:any) { return x.map((v,j)=>(v-s.means[j])/Math.max(1e-6,s.stds[j])); }
function softmax(logits:number[],temperature=1) {
  const z=logits.map(x=>x/Math.max(.2,temperature)), max=Math.max(...z), exps=z.map(x=>Math.exp(x-max)), total=exps.reduce((s,x)=>s+x,0)||1;
  return exps.map(x=>x/total);
}
function predict(model:any,features:number[]):Prob {
  const x=transform(features,model.scaler);
  const logits=CLASSES.map((_,c)=>finite(model.bias[c])+x.reduce((sum,v,j)=>sum+v*finite(model.weights[c][j]),0));
  const p=softmax(logits,model.temperature);
  return {home:p[0],draw:p[1],away:p[2]};
}
function logLossFrom(rows:Row[],probs:Prob[]) { return mean(rows.map((r,i)=>-Math.log(clamp(probs[i][r.outcome],1e-9,1)))); }
function fit(train:Row[],validation:Row[]) {
  const s=scaler(train);
  const xs=train.map(r=>transform(r.features,s));
  const classRows=CLASSES.map(k=>train.map((r,i)=>r.outcome===k?xs[i]:null).filter(Boolean) as number[][]);
  const priors=classRows.map(rows=>Math.max(1,rows.length)/train.length);
  const mus=classRows.map(rows=>FEATURES.map((_,j)=>mean(rows.map(x=>x[j]))));
  const variances=FEATURES.map((_,j)=>{
    let ss=0,n=0;
    for(let c=0;c<CLASSES.length;c++) for(const x of classRows[c]) { ss+=(x[j]-mus[c][j])**2; n++; }
    return .85*Math.max(.08,ss/Math.max(1,n-CLASSES.length))+.15;
  });
  const weights=mus.map(mu=>mu.map((v,j)=>v/variances[j]));
  const bias=mus.map((mu,c)=>Math.log(Math.max(EPS,priors[c]))-.5*mu.reduce((sum,v,j)=>sum+v*v/variances[j],0));
  const raw={weights,bias,scaler:s,temperature:1};
  let temperature=1,best=Infinity;
  for(let i=0;i<=12;i++) {
    const t=.7+i*.05, model={...raw,temperature:t}, probs=validation.map(r=>predict(model,r.features)), loss=logLossFrom(validation,probs);
    if(loss<best){best=loss;temperature=t;}
  }
  return {...raw,temperature:Number(temperature.toFixed(4)),classMeans:mus,sharedVariances:variances,validationLogLoss:best};
}
function summary(rows:Row[],probs:Prob[]) {
  let brierSum=0,logSum=0;
  const bins=Array.from({length:15},()=>({p:0,y:0,n:0}));
  for(let i=0;i<rows.length;i++) {
    const row=rows[i], p=probs[i];
    for(const klass of CLASSES) {
      const predicted=p[klass], actual=row.outcome===klass?1:0;
      brierSum+=(predicted-actual)**2;
      const bin=Math.min(4,Math.floor(predicted*5)), idx=CLASSES.indexOf(klass)*5+bin;
      bins[idx].p+=predicted; bins[idx].y+=actual; bins[idx].n++;
    }
    logSum+=-Math.log(clamp(p[row.outcome],1e-9,1));
  }
  let calibrationWeight=0,calibrationN=0;
  for(const bin of bins) if(bin.n){calibrationWeight+=bin.n*Math.abs(bin.p/bin.n-bin.y/bin.n);calibrationN+=bin.n;}
  return {sampleSize:rows.length,brier:Number((brierSum/Math.max(1,rows.length)).toFixed(6)),logLoss:Number((logSum/Math.max(1,rows.length)).toFixed(6)),calibrationGap:Number((calibrationN?calibrationWeight/calibrationN:0).toFixed(6))};
}
function rng(seed=20260903){let s=seed>>>0;return()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};}
function quantile(values:number[],q:number){const a=[...values].sort((x,y)=>x-y),p=q*(a.length-1),lo=Math.floor(p),hi=Math.ceil(p);return lo===hi?a[lo]:a[lo]*(hi-p)+a[hi]*(p-lo);}
function bootstrap(rows:Row[],candidate:Prob[],samples=BOOTSTRAP_SAMPLES) {
  const random=rng(), bd:number[]=[], ld:number[]=[];
  for(let s=0;s<samples;s++) {
    let bb=0,mb=0,bl=0,ml=0;
    for(let i=0;i<rows.length;i++) {
      const idx=Math.floor(random()*rows.length), r=rows[idx], m=candidate[idx];
      bb+=CLASSES.reduce((sum,k)=>sum+(r.baseline[k]-(r.outcome===k?1:0))**2,0);
      mb+=CLASSES.reduce((sum,k)=>sum+(m[k]-(r.outcome===k?1:0))**2,0);
      bl+=-Math.log(clamp(r.baseline[r.outcome],1e-9,1)); ml+=-Math.log(clamp(m[r.outcome],1e-9,1));
    }
    bd.push((bb-mb)/rows.length); ld.push((bl-ml)/rows.length);
  }
  return {samples,brierImprovement95:[quantile(bd,.025),quantile(bd,.975)],logLossImprovement95:[quantile(ld,.025),quantile(ld,.975)]};
}
async function hash(value:unknown){const bytes=new TextEncoder().encode(JSON.stringify(value)),digest=await crypto.subtle.digest("SHA-256",bytes);return[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");}
async function latestArtifact(admin:any) {
  const {data,error}=await admin.from("scorecaster_model_artifacts_v1").select("model_version,training_cutoff,training_data_hash,trained_at").eq("model_id",MODEL_ID).order("trained_at",{ascending:false}).limit(1).maybeSingle();
  if(error) throw error;
  return data;
}
async function finals(admin:any) {
  const out:Outcome[]=[];
  for(let from=0;from<MAX_SOURCE_ROWS;from+=1000) {
    const {data,error}=await admin.from("scorecaster_event_outcomes_v1").select("outcome_hash,event_id,sport_key,league,home_team,away_team,commence_time,home_score,away_score,source_ids").eq("status","final").eq("finality_verified",true).lte("commence_time",new Date().toISOString()).order("commence_time",{ascending:false}).range(from,Math.min(MAX_SOURCE_ROWS-1,from+999));
    if(error) throw error;
    out.push(...((data||[]) as Outcome[]));
    if(!data||data.length<1000) break;
  }
  return out.filter(r=>sourceIncludes(r.source_ids,"openfootball_cc0")).sort((a,b)=>Date.parse(a.commence_time)-Date.parse(b.commence_time));
}

Deno.serve(async req=>{
  if(req.method!=="POST") return Response.json({ok:false,error:"POST required"},{status:405});
  const url=Deno.env.get("SUPABASE_URL"), service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!service) return Response.json({ok:false,error:"Supabase environment unavailable"},{status:503});
  const admin=createClient(url,service,{auth:{persistSession:false}}), presented=req.headers.get("x-scorecaster-cron-token")||"";
  const {data:auth}=await admin.from("scorecaster_internal_secrets_v1").select("secret_value").eq("name","own_football_trainer_cron").single();
  if(!presented||presented!==auth?.secret_value) return Response.json({ok:false,error:"Unauthorized"},{status:401});

  await admin.from("scorecaster_ml_training_runs_v1").update({status:"failed",completed_at:new Date().toISOString(),errors:[{error:"stale-run-recovered"}]}).eq("status","running").lt("started_at",new Date(Date.now()-180000).toISOString());

  let source:Outcome[]=[];
  try {
    const [artifact,loaded]=await Promise.all([latestArtifact(admin),finals(admin)]);
    source=loaded;
    const latest=source.at(-1)?.commence_time||null, cutoff=artifact?.training_cutoff||null;
    if(latest&&cutoff&&Date.parse(latest)<=Date.parse(cutoff)) return Response.json({ok:true,version:"scorecaster-own-football-trainer-v4",status:"no-new-training-data",modelId:MODEL_ID,modelVersion:artifact?.model_version||null,trainingCutoff:cutoff,latestOutcomeAt:latest,sourceRows:source.length,automaticPromotionAllowed:false,productionProbabilityChanged:false,paperOnly:true},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    return Response.json({ok:false,version:"scorecaster-own-football-trainer-v4",stage:"source-load",error:errorMessage(error),paperOnly:true},{status:500,headers:{"Cache-Control":"no-store"}});
  }

  const startedAt=new Date().toISOString();
  const {data:run,error:runError}=await admin.from("scorecaster_ml_training_runs_v1").insert({started_at:startedAt,status:"running",model_id:MODEL_ID,paper_only:true}).select("id").single();
  if(runError) return Response.json({ok:false,version:"scorecaster-own-football-trainer-v4",stage:"run-create",error:errorMessage(runError),paperOnly:true},{status:500});

  try {
    const rows=dataset(source);
    if(rows.length<1000) throw new Error(`insufficient-own-history:${rows.length}`);
    const validationStart=Math.floor(rows.length*.55), holdoutStart=Math.floor(rows.length*.70);
    const train=rows.slice(0,validationStart), validation=rows.slice(validationStart,holdoutStart), holdout=rows.slice(holdoutStart);
    const model=fit(train,validation);
    const candidateTrain=train.map(r=>predict(model,r.features)), candidateValidation=validation.map(r=>predict(model,r.features)), candidateHoldout=holdout.map(r=>predict(model,r.features));
    const baselineTrain=train.map(r=>r.baseline as Prob), baselineValidation=validation.map(r=>r.baseline as Prob), baselineHoldout=holdout.map(r=>r.baseline as Prob);
    const trainMetrics={candidate:summary(train,candidateTrain),baseline:summary(train,baselineTrain)};
    const validationMetrics={candidate:summary(validation,candidateValidation),baseline:summary(validation,baselineValidation)};
    const holdoutMetrics={candidate:summary(holdout,candidateHoldout),baseline:summary(holdout,baselineHoldout)};
    const boot=bootstrap(holdout,candidateHoldout);
    const passes={sample:holdout.length>=500,brier:holdoutMetrics.candidate.brier<holdoutMetrics.baseline.brier,logLoss:holdoutMetrics.candidate.logLoss<holdoutMetrics.baseline.logLoss,brierCi:finite(boot.brierImprovement95[0],-1)>0,logLossCi:finite(boot.logLossImprovement95[0],-1)>0,calibration:holdoutMetrics.candidate.calibrationGap<=holdoutMetrics.baseline.calibrationGap+.02};
    const review=Object.values(passes).every(Boolean), trainingDataHash=await hash(source.map(r=>r.outcome_hash));
    const artifactCore={version:"scorecaster-own-football-ml-v2",family:FAMILY,featureSchemaVersion:FEATURE_SCHEMA,featureNames:FEATURES,...model,split:{trainRows:train.length,validationRows:validation.length,holdoutRows:holdout.length,validationStart:validation[0]?.date||null,holdoutStart:holdout[0]?.date||null},source:{id:"openfootball_cc0",license:"CC0-1.0",marketFeaturesUsed:false,rollingWindowFinals:MAX_SOURCE_ROWS},safety:{shadowOnly:true,automaticPromotionAllowed:false,productionProbabilityChanged:false,marketBenchmarkRequired:true}};
    const artifactHash=await hash({trainingDataHash,artifactCore}), modelVersion=`1.1.${artifactHash.slice(0,10)}`, trainedAt=new Date().toISOString();
    const gate={status:review?"own-baseline-review-candidate":"shadow",passes,ownBaselineReviewCandidate:review,marketBenchmarkRequired:true,automaticPromotionAllowed:false,bootstrapSamples:BOOTSTRAP_SAMPLES};
    const artifact={...artifactCore,modelId:MODEL_ID,modelVersion,trainingDataHash,artifactHash};
    const {error:artifactError}=await admin.from("scorecaster_model_artifacts_v1").upsert({artifact_hash:artifactHash,model_id:MODEL_ID,model_version:modelVersion,model_family:FAMILY,feature_schema_version:FEATURE_SCHEMA,trained_at:trainedAt,training_cutoff:source.at(-1)?.commence_time||trainedAt,training_data_hash:trainingDataHash,artifact,train_metrics:trainMetrics,validation_metrics:validationMetrics,holdout_metrics:holdoutMetrics,bootstrap:boot,promotion_gate:gate,independent_from_market:true,shadow_only:true,automatic_promotion_allowed:false,production_probability_changed:false,paper_only:true},{onConflict:"model_id,model_version"});
    if(artifactError) throw artifactError;
    const {error:registryError}=await admin.from("scorecaster_model_registry_v1").upsert({model_id:MODEL_ID,model_version:modelVersion,sport_key:"soccer",model_family:FAMILY,status:review?"review-candidate":"shadow",feature_schema_version:FEATURE_SCHEMA,training_data_hash:trainingDataHash,code_commit_sha:null,training_config:{source:"openfootball_cc0",sourceLicense:"CC0-1.0",marketFeaturesUsed:false,split:"55/15/30",trainer:"supabase-edge-lda-rolling-v4",rollingWindowFinals:MAX_SOURCE_ROWS},validation_metrics:validationMetrics,holdout_metrics:holdoutMetrics,promotion_gate:gate,independent_from_market:true,automatic_promotion_allowed:false,approved_by:null,approved_at:null,paper_only:true,updated_at:trainedAt},{onConflict:"model_id,model_version"});
    if(registryError) throw registryError;
    const metrics={train:trainMetrics,validation:validationMetrics,holdout:holdoutMetrics,bootstrap:boot,promotionGate:gate};
    await admin.from("scorecaster_ml_training_runs_v1").update({completed_at:trainedAt,status:"success",model_version:modelVersion,training_rows:train.length,validation_rows:validation.length,holdout_rows:holdout.length,training_data_hash:trainingDataHash,metrics,errors:[]}).eq("id",run.id);
    return Response.json({ok:true,version:"scorecaster-own-football-trainer-v4",status:"success",model:{id:MODEL_ID,version:modelVersion,family:FAMILY,independentFromMarket:true,shadowOnly:true},dataset:{finalOutcomes:source.length,usableRows:rows.length,train:train.length,validation:validation.length,holdout:holdout.length,rollingWindowFinals:MAX_SOURCE_ROWS},metrics,automaticPromotionAllowed:false,productionProbabilityChanged:false,realMoneyActionAvailable:false,paperOnly:true},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    const message=errorMessage(error);
    await admin.from("scorecaster_ml_training_runs_v1").update({completed_at:new Date().toISOString(),status:"failed",errors:[{error:message}]}).eq("id",run.id);
    return Response.json({ok:false,version:"scorecaster-own-football-trainer-v4",stage:"training",error:message,paperOnly:true},{status:500,headers:{"Cache-Control":"no-store"}});
  }
});
