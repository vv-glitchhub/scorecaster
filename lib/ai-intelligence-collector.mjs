const clamp=(v,min=-1,max=1)=>Math.max(min,Math.min(max,Number(v)||0));
const round=(v,d=4)=>Number.isFinite(Number(v))?Number(Number(v).toFixed(d)):null;
const ts=v=>new Date(v||0).getTime();

export const INTELLIGENCE_CATEGORIES={
 news:{label:'Uutiset',maxAbsImpact:.035,halfLifeHours:18},
 injury:{label:'Loukkaantumiset',maxAbsImpact:.09,halfLifeHours:36},
 lineup:{label:'Kokoonpanot',maxAbsImpact:.075,halfLifeHours:12},
 travel:{label:'Matkustaminen',maxAbsImpact:.025,halfLifeHours:48},
 rest:{label:'Lepoajat',maxAbsImpact:.035,halfLifeHours:48},
 weather:{label:'Sää',maxAbsImpact:.045,halfLifeHours:8},
 coach:{label:'Valmentajien kommentit',maxAbsImpact:.025,halfLifeHours:16},
 official:{label:'Viralliset julkaisut',maxAbsImpact:.06,halfLifeHours:18},
 market:{label:'Markkinamuutokset',maxAbsImpact:.05,halfLifeHours:3}
};

const SOURCE_POLICY={official:1,league:.95,injury_service:.9,weather_service:.9,reputable_news:.82,odds_market:.88,team_reporter:.76,unknown:.45};

function freshness(row,now){
 const cfg=INTELLIGENCE_CATEGORIES[row.category]||INTELLIGENCE_CATEGORIES.news;
 const age=Math.max(0,(now-ts(row.publishedAt||row.observedAt))/36e5);
 return Math.pow(.5,age/cfg.halfLifeHours);
}

function normalizedTrust(row){
 const policy=SOURCE_POLICY[row.sourceType]??SOURCE_POLICY.unknown;
 return clamp((Number(row.sourceTrust)||policy)*policy,0,1);
}

function dedupe(items){
 const seen=new Set();
 return items.filter(item=>{const key=item.canonicalUrl||`${item.category}|${item.team||''}|${item.title||item.summary||''}`.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
}

export function scoreIntelligenceItem(row,now=Date.now()){
 const cfg=INTELLIGENCE_CATEGORIES[row.category]||INTELLIGENCE_CATEGORIES.news;
 const trust=normalizedTrust(row);
 const fresh=freshness(row,now);
 const relevance=clamp(row.relevance??.6,0,1);
 const confidence=clamp(row.confidence??.6,0,1);
 const severity=clamp(row.severity??.5,0,1);
 const direction=clamp(row.direction??0,-1,1);
 const contradictionPenalty=clamp(row.contradictionPenalty??0,0,.75);
 const raw=direction*cfg.maxAbsImpact*severity*relevance*confidence*trust*fresh*(1-contradictionPenalty);
 return {...row,impactProbability:round(raw),impactPercentagePoints:round(raw*100,2),freshness:round(fresh),effectiveTrust:round(trust),usedBecause:row.usedBecause||`${cfg.label}: lähde on riittävän tuore, luotettava ja otteluun liittyvä.`};
}

export function buildIntelligenceReport({eventId,homeTeam,awayTeam,items=[],baseHomeProbability=.5,now=Date.now()}={}){
 const scored=dedupe(items).map(x=>scoreIntelligenceItem(x,now)).filter(x=>Math.abs(x.impactProbability)>=.0005);
 const contradictions=[];
 for(let i=0;i<scored.length;i++)for(let j=i+1;j<scored.length;j++){
  const a=scored[i],b=scored[j];
  if(a.category===b.category&&a.team&&a.team===b.team&&Math.sign(a.direction)!==Math.sign(b.direction))contradictions.push({a:a.id||a.title,b:b.id||b.title,category:a.category});
 }
 const byCategory={};
 for(const item of scored){
  byCategory[item.category]??={category:item.category,label:(INTELLIGENCE_CATEGORIES[item.category]||{}).label||item.category,impactProbability:0,items:[]};
  byCategory[item.category].impactProbability+=item.impactProbability;
  byCategory[item.category].items.push(item);
 }
 const categoryBreakdown=Object.values(byCategory).map(x=>({...x,impactProbability:round(x.impactProbability),impactPercentagePoints:round(x.impactProbability*100,2)})).sort((a,b)=>Math.abs(b.impactProbability)-Math.abs(a.impactProbability));
 const totalImpact=categoryBreakdown.reduce((n,x)=>n+x.impactProbability,0);
 const adjustedHomeProbability=clamp(Number(baseHomeProbability)+totalImpact,.02,.98);
 const strongest=[...scored].sort((a,b)=>Math.abs(b.impactProbability)-Math.abs(a.impactProbability))[0]||null;
 const dataQuality=scored.length?scored.reduce((n,x)=>n+x.effectiveTrust*x.confidence*x.freshness,0)/scored.length:0;
 return {
  version:'scorecaster-ai-intelligence-v1',eventId,homeTeam,awayTeam,generatedAt:new Date(now).toISOString(),
  baseHomeProbability:round(baseHomeProbability),adjustedHomeProbability:round(adjustedHomeProbability),
  totalImpactProbability:round(totalImpact),totalImpactPercentagePoints:round(totalImpact*100,2),
  strongestReason:strongest?`${strongest.title||strongest.summary}: ${strongest.impactPercentagePoints>0?'+':''}${strongest.impactPercentagePoints} prosenttiyksikköä kotijoukkueelle.`:'Ei riittävän vahvaa lisätietoa.',
  categoryBreakdown,items:scored.sort((a,b)=>Math.abs(b.impactProbability)-Math.abs(a.impactProbability)),
  contradictions,dataQuality:round(dataQuality),
  transparency:{showsSources:true,showsWhyUsed:true,showsImpact:true,showsUncertainty:true},
  safety:{decisionSupportOnly:true,humanMakesFinalDecision:true,automaticBetPlacement:false}
 };
}

export function intelligenceToCollectorRecords(report){
 return report.items.map(item=>({sourceId:item.sourceId,eventId:report.eventId,entityId:item.team,metric:'intelligence_probability_impact',value:item.impactProbability,unit:'probability',observedAt:item.publishedAt||item.observedAt,confidence:item.confidence,sourceTrust:item.effectiveTrust,payload:{category:item.category,title:item.title,summary:item.summary,sourceName:item.sourceName,sourceUrl:item.sourceUrl,canonicalUrl:item.canonicalUrl,usedBecause:item.usedBecause,impactPercentagePoints:item.impactPercentagePoints}}));
}
