const clamp=(v,min=-1,max=1)=>Math.max(min,Math.min(max,Number(v)||0));
const round=(v,d=4)=>Number.isFinite(Number(v))?Number(Number(v).toFixed(d)):null;
const ts=v=>new Date(v||0).getTime();

export const INTELLIGENCE_CATEGORIES={
 news:{label:'Uutiset',maxAbsImpact:.035,halfLifeHours:18},injury:{label:'Loukkaantumiset',maxAbsImpact:.09,halfLifeHours:36},lineup:{label:'Kokoonpanot',maxAbsImpact:.075,halfLifeHours:12},travel:{label:'Matkustaminen',maxAbsImpact:.025,halfLifeHours:48},rest:{label:'Lepoajat',maxAbsImpact:.035,halfLifeHours:48},weather:{label:'Sää',maxAbsImpact:.045,halfLifeHours:8},coach:{label:'Valmentajien kommentit',maxAbsImpact:.025,halfLifeHours:16},official:{label:'Viralliset julkaisut',maxAbsImpact:.06,halfLifeHours:18},market:{label:'Markkinamuutokset',maxAbsImpact:.05,halfLifeHours:3}
};
const SOURCE_POLICY={official:1,league:.95,injury_service:.9,weather_service:.9,reputable_news:.82,odds_market:.88,team_reporter:.76,unknown:.45};
const MIN_IMPACT=.0005;
function freshness(row,now){const cfg=INTELLIGENCE_CATEGORIES[row.category]||INTELLIGENCE_CATEGORIES.news;const age=Math.max(0,(now-ts(row.publishedAt||row.observedAt))/36e5);return Math.pow(.5,age/cfg.halfLifeHours);}
function normalizedTrust(row){const policy=SOURCE_POLICY[row.sourceType]??SOURCE_POLICY.unknown;return clamp((Number(row.sourceTrust)||policy)*policy,0,1);}
function itemKey(item){return item.canonicalUrl||`${item.category}|${item.team||''}|${item.title||item.summary||''}`.toLowerCase();}

export function scoreIntelligenceItem(row,now=Date.now()){
 const cfg=INTELLIGENCE_CATEGORIES[row.category]||INTELLIGENCE_CATEGORIES.news;
 const factors={direction:clamp(row.direction??0,-1,1),categoryMaximum:cfg.maxAbsImpact,severity:clamp(row.severity??.5,0,1),relevance:clamp(row.relevance??.6,0,1),confidence:clamp(row.confidence??.6,0,1),sourceTrust:normalizedTrust(row),freshness:freshness(row,now),contradictionMultiplier:1-clamp(row.contradictionPenalty??0,0,.75)};
 const raw=factors.direction*factors.categoryMaximum*factors.severity*factors.relevance*factors.confidence*factors.sourceTrust*factors.freshness*factors.contradictionMultiplier;
 const exclusionReasons=[];
 if(!row.sourceId||!row.sourceName)exclusionReasons.push('Lähteen tunnistetiedot puuttuvat.');
 if(factors.relevance<.25)exclusionReasons.push('Tieto ei liity riittävän suoraan tähän otteluun.');
 if(factors.sourceTrust<.35)exclusionReasons.push('Lähteen luotettavuus jäi vähimmäisrajan alle.');
 if(factors.freshness<.12)exclusionReasons.push('Tieto on liian vanha vaikuttaakseen arvioon.');
 if(factors.confidence<.3)exclusionReasons.push('Tiedon varmuus jäi liian matalaksi.');
 if(Math.abs(raw)<MIN_IMPACT)exclusionReasons.push('Laskettu vaikutus jäi alle 0,05 prosenttiyksikön raportointirajan.');
 const included=exclusionReasons.length===0;
 return {...row,impactProbability:round(raw),impactPercentagePoints:round(raw*100,2),freshness:round(factors.freshness),effectiveTrust:round(factors.sourceTrust),included,exclusionReasons,factors:{...factors,categoryMaximumPercentagePoints:round(factors.categoryMaximum*100,2)},calculation:`${round(factors.direction,3)} × ${round(factors.categoryMaximum*100,2)} pp × ${round(factors.severity,3)} × ${round(factors.relevance,3)} × ${round(factors.confidence,3)} × ${round(factors.sourceTrust,3)} × ${round(factors.freshness,3)} × ${round(factors.contradictionMultiplier,3)} = ${round(raw*100,2)} pp`,usedBecause:row.usedBecause||`${cfg.label}: lähde on riittävän tuore, luotettava ja otteluun liittyvä.`};
}

export function buildIntelligenceReport({eventId,homeTeam,awayTeam,items=[],baseHomeProbability=.5,now=Date.now()}={}){
 const seen=new Set(),duplicates=[];
 const unique=[];
 for(const item of items){const key=itemKey(item);if(seen.has(key)){duplicates.push({...item,included:false,exclusionReasons:['Sama tieto oli jo mukana vahvemmasta tai aikaisemmin käsitellystä lähteestä.']});continue;}seen.add(key);unique.push(item);}
 let evaluated=unique.map(x=>scoreIntelligenceItem(x,now));
 const contradictions=[];
 for(let i=0;i<evaluated.length;i++)for(let j=i+1;j<evaluated.length;j++){const a=evaluated[i],b=evaluated[j];if(a.category===b.category&&a.team&&a.team===b.team&&Math.sign(a.direction)!==Math.sign(b.direction)){contradictions.push({a:a.id||a.title,b:b.id||b.title,category:a.category});}}
 const contradictionKeys=new Set(contradictions.flatMap(x=>[x.a,x.b]));
 evaluated=evaluated.map(item=>contradictionKeys.has(item.id||item.title)?scoreIntelligenceItem({...item,contradictionPenalty:Math.max(Number(item.contradictionPenalty)||0,.35)},now):item);
 const includedItems=evaluated.filter(x=>x.included);
 const excludedItems=[...evaluated.filter(x=>!x.included),...duplicates];
 const byCategory={};
 for(const item of includedItems){byCategory[item.category]??={category:item.category,label:(INTELLIGENCE_CATEGORIES[item.category]||{}).label||item.category,impactProbability:0,items:[]};byCategory[item.category].impactProbability+=item.impactProbability;byCategory[item.category].items.push(item);}
 const categoryBreakdown=Object.values(byCategory).map(x=>({...x,impactProbability:round(x.impactProbability),impactPercentagePoints:round(x.impactProbability*100,2)})).sort((a,b)=>Math.abs(b.impactProbability)-Math.abs(a.impactProbability));
 const totalImpact=categoryBreakdown.reduce((n,x)=>n+x.impactProbability,0),adjustedHomeProbability=clamp(Number(baseHomeProbability)+totalImpact,.02,.98);
 const strongest=[...includedItems].sort((a,b)=>Math.abs(b.impactProbability)-Math.abs(a.impactProbability))[0]||null;
 const dataQuality=includedItems.length?includedItems.reduce((n,x)=>n+x.effectiveTrust*x.confidence*x.freshness,0)/includedItems.length:0;
 const decisionTrace=[
  {step:1,label:'Perusarvio',value:round(baseHomeProbability),explanation:'Tilasto- tai ennustemallin arvio ennen uutis- ja tilannetietoja.'},
  {step:2,label:'Kerätyt havainnot',value:items.length,explanation:`Kaikkiaan ${items.length} mahdollista signaalia vastaanotettiin.`},
  {step:3,label:'Hyväksytyt havainnot',value:includedItems.length,explanation:`${includedItems.length} tietoa täytti tuoreus-, relevanssi-, luotettavuus- ja vaikutusrajat.`},
  {step:4,label:'Pois jätetyt havainnot',value:excludedItems.length,explanation:`${excludedItems.length} tietoa jätettiin laskennan ulkopuolelle; syyt näkyvät erikseen.`},
  {step:5,label:'Tietojen yhteisvaikutus',value:round(totalImpact),explanation:`Hyväksyttyjen vaikutusten summa oli ${round(totalImpact*100,2)} prosenttiyksikköä.`},
  {step:6,label:'Lopullinen arvio',value:round(adjustedHomeProbability),explanation:'Perusarvioon lisättiin kaikkien hyväksyttyjen tietojen nettovaikutus.'}
 ];
 return {version:'scorecaster-ai-intelligence-v2',eventId,homeTeam,awayTeam,generatedAt:new Date(now).toISOString(),baseHomeProbability:round(baseHomeProbability),adjustedHomeProbability:round(adjustedHomeProbability),totalImpactProbability:round(totalImpact),totalImpactPercentagePoints:round(totalImpact*100,2),strongestReason:strongest?`${strongest.title||strongest.summary}: ${strongest.impactPercentagePoints>0?'+':''}${strongest.impactPercentagePoints} prosenttiyksikköä kotijoukkueelle.`:'Ei riittävän vahvaa lisätietoa.',categoryBreakdown,items:includedItems.sort((a,b)=>Math.abs(b.impactProbability)-Math.abs(a.impactProbability)),excludedItems,contradictions,dataQuality:round(dataQuality),decisionTrace,formula:'vaikutus = suunta × kategorian enimmäisvaikutus × vakavuus × relevanssi × varmuus × lähdeluottamus × tuoreus × ristiriitakerroin',audit:{received:items.length,included:includedItems.length,excluded:excludedItems.length,duplicates:duplicates.length,allInputsAccountedFor:items.length===includedItems.length+excludedItems.length},transparency:{showsSources:true,showsWhyUsed:true,showsWhyExcluded:true,showsImpact:true,showsWeights:true,showsFormula:true,showsContradictions:true,showsUncertainty:true,showsCompleteDecisionTrace:true},safety:{decisionSupportOnly:true,humanMakesFinalDecision:true,automaticBetPlacement:false}};
}

export function intelligenceToCollectorRecords(report){return report.items.map(item=>({sourceId:item.sourceId,eventId:report.eventId,entityId:item.team,metric:'intelligence_probability_impact',value:item.impactProbability,unit:'probability',observedAt:item.publishedAt||item.observedAt,confidence:item.confidence,sourceTrust:item.effectiveTrust,payload:{category:item.category,title:item.title,summary:item.summary,sourceName:item.sourceName,sourceUrl:item.sourceUrl,canonicalUrl:item.canonicalUrl,usedBecause:item.usedBecause,impactPercentagePoints:item.impactPercentagePoints,factors:item.factors,calculation:item.calculation}}));}
