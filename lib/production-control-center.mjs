const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number(v)||0));
const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const latest=(rows,metric)=>[...rows].filter(r=>r.metric===metric&&Number.isFinite(Number(r.value))).sort((a,b)=>new Date(b.observedAt||b.observed_at||0)-new Date(a.observedAt||a.observed_at||0))[0]||null;
const ageHours=(row,now=Date.now())=>row?Math.max(0,(now-new Date(row.observedAt||row.observed_at||row.collectedAt||row.collected_at||0).getTime())/36e5):Infinity;
const eventId=r=>r.eventId||r.event_id;
const sourceId=r=>r.sourceId||r.source_id;
const entityId=r=>r.entityId||r.entity_id;

export function calibrationMetrics(samples=[]){
 const settled=samples.filter(s=>[0,1].includes(Number(s.result))&&Number.isFinite(Number(s.probability)));
 if(!settled.length)return {count:0,brier:null,logLoss:null,calibrationError:null,grade:'N/A',buckets:[]};
 let brier=0,ll=0;const buckets=new Map();
 for(const s of settled){const p=clamp(s.probability,.001,.999),y=Number(s.result);brier+=(p-y)**2;ll+=-(y*Math.log(p)+(1-y)*Math.log(1-p));const k=Math.min(9,Math.floor(p*10));const b=buckets.get(k)||{from:k/10,to:(k+1)/10,count:0,predicted:0,actual:0};b.count++;b.predicted+=p;b.actual+=y;buckets.set(k,b);}
 const out=[...buckets.values()].map(b=>({...b,predicted:Number((b.predicted/b.count).toFixed(4)),actual:Number((b.actual/b.count).toFixed(4)),gap:Number(Math.abs(b.predicted/b.count-b.actual/b.count).toFixed(4))}));
 const ce=out.reduce((a,b)=>a+b.gap*b.count,0)/settled.length;const bs=brier/settled.length;
 const grade=settled.length<100?'D':bs<=.18&&ce<=.05?'A':bs<=.21&&ce<=.08?'B':bs<=.24&&ce<=.12?'C':'D';
 return {count:settled.length,brier:Number(bs.toFixed(5)),logLoss:Number((ll/settled.length).toFixed(5)),calibrationError:Number(ce.toFixed(5)),grade,buckets:out};
}

export function closingLineReport(records=[]){
 const byEvent=new Map();
 for(const r of records){const id=eventId(r);if(!id)continue;const arr=byEvent.get(id)||[];arr.push(r);byEvent.set(id,arr);}
 const events=[];
 for(const [id,rows] of byEvent){const prices=rows.filter(r=>r.metric==='best_odds'&&Number(r.value)>1).sort((a,b)=>new Date(a.observedAt||a.observed_at)-new Date(b.observedAt||b.observed_at));if(prices.length<2)continue;const open=num(prices[0].value),close=num(prices.at(-1).value);events.push({eventId:id,openingOdds:open,closingOdds:close,priceClv:Number(((open/close)-1).toFixed(4)),observations:prices.length});}
 return {count:events.length,averagePriceClv:events.length?Number((events.reduce((a,e)=>a+e.priceClv,0)/events.length).toFixed(4)):null,events:events.sort((a,b)=>Math.abs(b.priceClv)-Math.abs(a.priceClv)).slice(0,100)};
}

export function rankDailyTop3(records=[],now=Date.now()){
 const byEvent=new Map();for(const r of records){const id=eventId(r);if(!id)continue;const arr=byEvent.get(id)||[];arr.push(r);byEvent.set(id,arr);}
 const picks=[];
 for(const [id,rows] of byEvent){const market=latest(rows,'market_probability'),model=latest(rows,'model_probability'),odds=latest(rows,'best_odds');const trust=rows.reduce((a,r)=>a+num(r.sourceTrust??r.source_trust),0)/Math.max(1,rows.length);const confidence=rows.reduce((a,r)=>a+num(r.confidence),0)/Math.max(1,rows.length);const sources=new Set(rows.map(sourceId).filter(Boolean)).size;const freshness=Math.max(0,1-Math.min(1,ageHours(rows.sort((a,b)=>new Date(b.observedAt||b.observed_at)-new Date(a.observedAt||a.observed_at))[0],now)/24));const mp=model?clamp(model.value):market?clamp(market.value):null;const mkp=market?clamp(market.value):odds?clamp(1/num(odds.value)):null;if(mp===null||mkp===null)continue;const edge=mp-mkp;const quality=.3*trust+.25*confidence+.2*freshness+.15*Math.min(1,rows.length/8)+.1*Math.min(1,sources/2);const score=100*(quality*.7+Math.min(.15,Math.abs(edge))/.15*.3);const decision=quality<.55||sources<1?'SKIP':edge>=.04&&quality>=.72?'WATCH':'CAUTION';picks.push({eventId:id,score:Number(score.toFixed(1)),decision,modelProbability:Number(mp.toFixed(4)),marketProbability:Number(mkp.toFixed(4)),edge:Number(edge.toFixed(4)),bestOdds:odds?num(odds.value):null,quality:Number(quality.toFixed(4)),sources,records:rows.length,reason:decision==='WATCH'?'Positive paper edge with sufficient data quality':decision==='CAUTION'?'Evidence is usable but edge or quality is limited':'Insufficient production evidence'});}
 return picks.sort((a,b)=>b.score-a.score).slice(0,3);
}

export function modelComparison(records=[]){
 const models=[['market_probability','Market consensus'],['model_probability','Scorecaster model'],['simulation_probability','Scenario simulation']];
 return models.map(([metric,name])=>{const rows=records.filter(r=>r.metric===metric&&Number.isFinite(Number(r.value)));const events=new Set(rows.map(eventId).filter(Boolean)).size;const confidence=rows.length?rows.reduce((a,r)=>a+num(r.confidence),0)/rows.length:0;const trust=rows.length?rows.reduce((a,r)=>a+num(r.sourceTrust??r.source_trust),0)/rows.length:0;const score=100*(.45*Math.min(1,events/20)+.3*confidence+.25*trust);return {metric,name,observations:rows.length,events,confidence:Number(confidence.toFixed(4)),trust:Number(trust.toFixed(4)),score:Number(score.toFixed(1)),grade:score>=85?'A':score>=70?'B':score>=55?'C':score>0?'D':'N/A'};});
}

export function buildProductionControlCenter({records=[],settledSamples=[],collectorHealth=null,now=Date.now()}={}){
 const top3=rankDailyTop3(records,now);const calibration=calibrationMetrics(settledSamples);const closingLine=closingLineReport(records);const models=modelComparison(records);const events=new Set(records.map(eventId).filter(Boolean)).size;const sources=new Set(records.map(sourceId).filter(Boolean)).size;const latestRow=[...records].sort((a,b)=>new Date(b.observedAt||b.observed_at||0)-new Date(a.observedAt||a.observed_at||0))[0];const freshness=latestRow?ageHours(latestRow,now):Infinity;
 const blockers=[];if(!records.length)blockers.push('no-publishable-records');if(freshness>2)blockers.push('collector-stale');if(events<3)blockers.push('insufficient-event-coverage');if(sources<1)blockers.push('no-active-source');if(calibration.count<300)blockers.push('calibration-sample-below-300');if(!closingLine.count)blockers.push('closing-line-history-missing');if(collectorHealth&&collectorHealth.status!=='healthy')blockers.push(`collector-${collectorHealth.status}`);
 return {version:'scorecaster-production-control-center-v1',generatedAt:new Date(now).toISOString(),readiness:{status:blockers.length?'blocked':'ready',score:Number((100-Math.min(100,blockers.length*14)).toFixed(0)),blockers},summary:{records:records.length,events,sources,freshnessHours:Number.isFinite(freshness)?Number(freshness.toFixed(2)):null},dailyTop3:top3,calibration,closingLine,models,safety:{paperOnly:true,productionProbabilityChanged:false,automaticBetting:false,playUpgradeAllowed:false,researchDataExcluded:true}};
}
