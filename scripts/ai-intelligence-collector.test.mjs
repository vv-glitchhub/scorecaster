import assert from 'node:assert/strict';
import {buildIntelligenceReport,scoreIntelligenceItem} from '../lib/ai-intelligence-collector.mjs';
const now=Date.now();
const injury=scoreIntelligenceItem({category:'injury',sourceType:'official',sourceTrust:1,sourceId:'team',sourceName:'Team',publishedAt:new Date(now-3600000).toISOString(),direction:.9,severity:1,relevance:1,confidence:.95,title:'Starting goalkeeper out'},now);
assert(injury.impactProbability>0.05,'major official injury should create meaningful impact');
assert.equal(injury.included,true);
assert(injury.calculation.includes('='));
const report=buildIntelligenceReport({eventId:'game-1',homeTeam:'Florida',awayTeam:'Toronto',baseHomeProbability:.55,now,items:[
 {id:'1',category:'injury',team:'Toronto',sourceType:'official',sourceTrust:1,sourceId:'team',sourceName:'Team',publishedAt:new Date(now-3600000).toISOString(),direction:.9,severity:1,relevance:1,confidence:.95,title:'Toronto starting goalkeeper out',sourceUrl:'https://example.com/a',canonicalUrl:'https://example.com/a',usedBecause:'Official lineup update.'},
 {id:'2',category:'market',team:'Florida',sourceType:'odds_market',sourceId:'market',sourceName:'Market',publishedAt:new Date(now-900000).toISOString(),direction:.4,severity:.6,relevance:1,confidence:.8,title:'Florida price shortens',sourceUrl:'https://example.com/b'},
 {id:'3',category:'news',team:'Florida',sourceType:'unknown',sourceTrust:.1,sourceId:'rumor',sourceName:'Rumor',publishedAt:new Date(now-900000).toISOString(),direction:1,severity:1,relevance:.1,confidence:.1,title:'Unverified rumor',sourceUrl:'https://example.com/c'}
]});
assert(report.adjustedHomeProbability>report.baseHomeProbability);
assert.equal(report.safety.humanMakesFinalDecision,true);
assert.equal(report.safety.automaticBetPlacement,false);
assert(report.items.every(x=>x.usedBecause&&x.calculation&&x.factors));
assert(report.excludedItems.some(x=>x.title==='Unverified rumor'));
assert.equal(report.audit.allInputsAccountedFor,true);
assert.equal(report.decisionTrace.length,6);
assert.equal(report.transparency.showsCompleteDecisionTrace,true);
console.log('AI intelligence collector tests passed');
