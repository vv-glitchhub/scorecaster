'use client';
import {useState} from 'react';

export default function AIIntelligencePage(){
 const [eventId,setEventId]=useState(''); const [report,setReport]=useState(null); const [loading,setLoading]=useState(false);
 async function load(){setLoading(true);try{const r=await fetch(`/api/ai-intelligence?eventId=${encodeURIComponent(eventId)}`,{cache:'no-store'});setReport(await r.json());}finally{setLoading(false);}}
 return <main style={{maxWidth:1100,margin:'0 auto',padding:'32px 18px',fontFamily:'system-ui'}}>
  <h1>AI Intelligence Collector</h1>
  <p>Scorecaster kerää olennaisen tiedon, näyttää lähteet ja selittää miksi tieto vaikutti arvioon. Ihminen tekee aina lopullisen päätöksen.</p>
  <div style={{display:'flex',gap:8,margin:'20px 0'}}><input value={eventId} onChange={e=>setEventId(e.target.value)} placeholder="Event ID" style={{flex:1,padding:12,borderRadius:10}}/><button onClick={load} disabled={!eventId||loading} style={{padding:'12px 18px',borderRadius:10}}>{loading?'Analysoidaan…':'Näytä analyysi'}</button></div>
  {report?.ok&&<>
   <section style={{padding:18,border:'1px solid #334155',borderRadius:16,marginBottom:16}}><h2>Yhteenveto</h2><p><b>Perusarvio:</b> {(report.baseHomeProbability*100).toFixed(1)} %</p><p><b>Uutis- ja tilannekorjattu arvio:</b> {(report.adjustedHomeProbability*100).toFixed(1)} %</p><p><b>Kokonaisvaikutus:</b> {report.totalImpactPercentagePoints>0?'+':''}{report.totalImpactPercentagePoints} prosenttiyksikköä</p><p><b>Suurin syy:</b> {report.strongestReason}</p><p><b>Datan laatu:</b> {(report.dataQuality*100).toFixed(0)}/100</p></section>
   {report.categoryBreakdown.map(cat=><section key={cat.category} style={{padding:18,border:'1px solid #334155',borderRadius:16,marginBottom:12}}><h3>{cat.label} ({cat.impactPercentagePoints>0?'+':''}{cat.impactPercentagePoints} pp)</h3>{cat.items.map((item,i)=><article key={item.id||i} style={{padding:'12px 0',borderTop:i?'1px solid #334155':'none'}}><b>{item.title||item.summary}</b><p>{item.summary}</p><p><b>Miksi käytettiin:</b> {item.usedBecause}</p><p><b>Vaikutus:</b> {item.impactPercentagePoints>0?'+':''}{item.impactPercentagePoints} pp · <b>Luottamus:</b> {(item.effectiveTrust*100).toFixed(0)} %</p>{item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noreferrer">Avaa lähde: {item.sourceName}</a>}</article>)}</section>)}
   <p style={{opacity:.75}}>Tämä on päätöksenteon tuki. Scorecaster ei aseta vetoja automaattisesti.</p>
  </>}
  {report&&!report.ok&&<p>{report.error}</p>}
 </main>;
}
