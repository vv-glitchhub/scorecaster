"use client";
import { useEffect,useState } from "react";

const pct=v=>v==null?"–":`${(Number(v)*100).toFixed(1)} %`;
const eur=v=>new Intl.NumberFormat("fi-FI",{style:"currency",currency:"EUR"}).format(Number(v||0));
const badge=d=>d==="PLAY"?"bg-emerald-400/15 text-emerald-300 border-emerald-400/30":d==="CAUTION"?"bg-amber-400/15 text-amber-300 border-amber-400/30":"bg-slate-400/10 text-slate-300 border-white/10";

export default function AutonomousBettingSupportPage(){
 const [data,setData]=useState(null);const [error,setError]=useState("");const [bankroll,setBankroll]=useState(1000);
 async function load(){setError("");try{const r=await fetch(`/api/autonomous-betting-support?bankroll=${bankroll}`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.error||"Lataus epäonnistui");setData(j);}catch(e){setError(String(e.message||e));}}
 useEffect(()=>{void load();},[]);
 const rows=data?.allDecisions||[];
 return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
  <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
   <div className="text-xs font-black uppercase tracking-[.16em] text-emerald-300">Autonominen vedonlyöntituki</div>
   <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">Kohteet, kerroinrajat ja paperipanokset automaattisesti</h1>
   <p className="mt-3 max-w-3xl text-slate-300">Scorecaster kerää hyväksytyn datan, etsii value-kohteet, laskee EV:n, minimikertoimen ja riskirajat sekä seuraa CLV:tä. Järjestelmä ei aseta oikean rahan vetoja eikä siirrä rahaa.</p>
   <div className="mt-5 flex flex-wrap items-end gap-3"><label className="text-sm text-slate-300">Virtuaalipankki<input className="mt-1 block rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white" type="number" min="10" value={bankroll} onChange={e=>setBankroll(e.target.value)}/></label><button onClick={load} className="rounded-xl bg-emerald-400 px-4 py-2 font-black text-slate-950">Laske uudelleen</button></div>
  </section>
  {error&&<div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</div>}
  {data&&<>
   <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["Tila",data.mode],["Tapahtumat",data.summary.events],["PLAY",data.summary.plays],["SKIP",data.summary.skips],["Keskimääräinen CLV",pct(data.summary.averageClv)]].map(([a,b])=><div key={a} className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="text-xs uppercase text-slate-500">{a}</div><div className="mt-1 text-2xl font-black text-white">{b}</div></div>)}</section>
   {data.globalBlockers?.length>0&&<section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4"><div className="font-black text-amber-200">Autonominen tila on varjotilassa</div><div className="mt-2 text-sm text-amber-100">{data.globalBlockers.join(" · ")}</div></section>}
   <section><h2 className="mb-3 text-2xl font-black text-white">Päivän Top 3</h2><div className="grid gap-4 lg:grid-cols-3">{(data.dailyTop3||[]).map(d=><article key={d.eventId} className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[.05] p-5"><div className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${badge(d.decision)}`}>{d.decision}</div><h3 className="mt-3 break-all font-black text-white">{d.eventId}</h3><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><span>Paras kerroin</span><b>{d.odds??"–"}</b><span>Minimikerroin</span><b>{d.minimumOdds??"–"}</b><span>Edge</span><b>{pct(d.edge)}</b><span>EV</span><b>{pct(d.expectedValue)}</b><span>Paperipanos</span><b>{eur(d.recommendedPaperStake)}</b><span>Laatu</span><b>{pct(d.quality.score)}</b></div></article>)}{!data.dailyTop3?.length&&<div className="text-slate-400">Yksikään kohde ei läpäise kaikkia PLAY-portteja tällä hetkellä.</div>}</div></section>
   <section><h2 className="mb-3 text-2xl font-black text-white">Kaikki päätökset</h2><div className="overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-full text-left text-sm"><thead className="bg-white/[.04] text-slate-400"><tr>{["Päätös","Tapahtuma","Kerroin","Raja","Mallin %","Markkinan %","Edge","EV","Panos","Estot"].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{rows.map(d=><tr key={d.eventId} className="border-t border-white/10 text-slate-200"><td className="p-3"><span className={`rounded-full border px-2 py-1 text-xs font-black ${badge(d.decision)}`}>{d.decision}</span></td><td className="max-w-xs break-all p-3">{d.eventId}</td><td className="p-3">{d.odds??"–"}</td><td className="p-3">{d.minimumOdds??"–"}</td><td className="p-3">{pct(d.modelProbability)}</td><td className="p-3">{pct(d.marketProbability)}</td><td className="p-3">{pct(d.edge)}</td><td className="p-3">{pct(d.expectedValue)}</td><td className="p-3">{eur(d.recommendedPaperStake)}</td><td className="p-3 text-xs text-slate-400">{d.blockers.join(", ")||"–"}</td></tr>)}</tbody></table></div></section>
  </>}
 </main>;
}
