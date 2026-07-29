'use client';
import {useState} from 'react';
const pct=v=>`${(Number(v||0)*100).toFixed(1)} %`;
const pp=v=>`${Number(v)>0?'+':''}${Number(v||0).toFixed(2)} pp`;

export default function AIIntelligencePage(){
 const [eventId,setEventId]=useState(''); const [report,setReport]=useState(null); const [loading,setLoading]=useState(false);
 async function load(){setLoading(true);try{const r=await fetch(`/api/ai-intelligence?eventId=${encodeURIComponent(eventId)}`,{cache:'no-store'});setReport(await r.json());}finally{setLoading(false);}}
 const card={padding:18,border:'1px solid #334155',borderRadius:16,marginBottom:14};
 return <main style={{maxWidth:1100,margin:'0 auto',padding:'32px 18px',fontFamily:'system-ui'}}>
  <h1>AI-päätöksen täydellinen perustelu</h1>
  <p>Scorecaster näyttää kaiken, mikä johti arvioon: käytetyt tiedot, pois jätetyt tiedot, lähteet, painot, laskukaavat, epävarmuudet ja ristiriidat. Ihminen tekee lopullisen päätöksen.</p>
  <div style={{display:'flex',gap:8,margin:'20px 0'}}><input value={eventId} onChange={e=>setEventId(e.target.value)} placeholder="Event ID" style={{flex:1,padding:12,borderRadius:10}}/><button onClick={load} disabled={!eventId||loading} style={{padding:'12px 18px',borderRadius:10}}>{loading?'Analysoidaan…':'Näytä koko päätösketju'}</button></div>
  {report?.ok&&<>
   <section style={card}><h2>Lopputulos</h2><p><b>Perusarvio:</b> {pct(report.baseHomeProbability)}</p><p><b>Lopullinen arvio:</b> {pct(report.adjustedHomeProbability)}</p><p><b>Tietojen nettovaikutus:</b> {pp(report.totalImpactPercentagePoints)}</p><p><b>Suurin yksittäinen syy:</b> {report.strongestReason}</p><p><b>Datan laatu:</b> {(report.dataQuality*100).toFixed(0)}/100</p></section>
   <section style={card}><h2>Miten ratkaisu muodostui?</h2>{report.decisionTrace?.map(step=><div key={step.step} style={{padding:'10px 0',borderTop:step.step>1?'1px solid #334155':'none'}}><b>{step.step}. {step.label}</b><p>{step.explanation}</p></div>)}<p><b>Laskentakaava:</b> {report.formula}</p></section>
   <section style={card}><h2>Auditoinnin kattavuus</h2><p>Vastaanotettu: <b>{report.audit?.received}</b> · Käytetty: <b>{report.audit?.included}</b> · Pois jätetty: <b>{report.audit?.excluded}</b> · Duplikaatit: <b>{report.audit?.duplicates}</b></p><p>{report.audit?.allInputsAccountedFor?'Kaikki vastaanotetut tiedot on huomioitu joko laskennassa tai perustellusti pois jätettyinä.':'Kaikkia syötteitä ei voitu jäljittää.'}</p></section>
   {report.categoryBreakdown.map(cat=><section key={cat.category} style={card}><h2>{cat.label} ({pp(cat.impactPercentagePoints)})</h2>{cat.items.map((item,i)=><article key={item.id||i} style={{padding:'14px 0',borderTop:i?'1px solid #334155':'none'}}><h3>{item.title||item.summary}</h3><p>{item.summary}</p><p><b>Miksi käytettiin:</b> {item.usedBecause}</p><p><b>Vaikutus:</b> {pp(item.impactPercentagePoints)}</p><p><b>Laskenta:</b> {item.calculation}</p><details><summary>Näytä kaikki painot</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(item.factors,null,2)}</pre></details><p><b>Lähde:</b> {item.sourceName} · <b>Lähdetyyppi:</b> {item.sourceType} · <b>Luottamus:</b> {(item.effectiveTrust*100).toFixed(0)} % · <b>Tuoreus:</b> {(item.freshness*100).toFixed(0)} % · <b>Mallin varmuus:</b> {(item.confidence*100).toFixed(0)} %</p>{item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noreferrer">Avaa alkuperäinen lähde</a>}</article>)}</section>)}
   <section style={card}><h2>Pois jätetyt tiedot</h2>{report.excludedItems?.length?report.excludedItems.map((item,i)=><article key={item.id||i} style={{padding:'12px 0',borderTop:i?'1px solid #334155':'none'}}><b>{item.title||item.summary||'Nimeämätön havainto'}</b><p>{item.exclusionReasons?.join(' ')}</p><p><b>Lähde:</b> {item.sourceName||'Ei ilmoitettu'}</p></article>):<p>Mitään tietoa ei jätetty pois.</p>}</section>
   <section style={card}><h2>Ristiriitaiset tiedot</h2>{report.contradictions?.length?report.contradictions.map((x,i)=><p key={i}>{x.category}: {x.a} ↔ {x.b}. Molempien vaikutusta pienennettiin ristiriitakertoimella.</p>):<p>Ristiriitoja ei havaittu.</p>}</section>
   <p style={{opacity:.75}}>Scorecaster ei aseta vetoja. Analyysi on päätöksenteon tuki, ja käyttäjä arvioi tiedot ennen omaa päätöstään.</p>
  </>}
  {report&&!report.ok&&<p>{report.error}</p>}
 </main>;
}
