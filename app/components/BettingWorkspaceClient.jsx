"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import PageSection from "@/app/components/PageSection";
import SourceBadge from "@/app/components/SourceBadge";
import MarketTabs from "@/app/components/MarketTabs";
import FavoritesPanel from "@/app/components/FavoritesPanel";
import ConfidenceBreakdown from "@/app/components/ConfidenceBreakdown";
import RiskFlags from "@/app/components/RiskFlags";
import MarketMovementPanel from "@/app/components/MarketMovementPanel";

import DataTrustPanel from "@/app/components/DataTrustPanel";
import PickExplanation from "@/app/components/PickExplanation";
import TrustWarning from "@/app/components/TrustWarning";

import {
  buildConfidenceBreakdown,
  buildRiskFlags,
} from "@/lib/confidence-engine";

import {
  useOddsHistoryStore,
  useMatchOddsMovements,
} from "@/lib/odds-history-store";

import { assessDataQuality } from "@/lib/data-quality";

import { getDictionary } from "@/lib/i18n";
import { useFavoritesStore } from "@/lib/favorites-store";
import { useBetStore } from "@/lib/useBetStore";
import { kellyStake } from "@/lib/kelly";

function formatClock(ts, lang) {
  if (!ts) return "-";

  return new Date(ts).toLocaleTimeString(
    lang === "fi" ? "fi-FI" : "en-GB",
    {
      hour:"2-digit",
      minute:"2-digit",
      second:"2-digit"
    }
  );
}

function normalizeOddsData(data) {

  const matches = Array.isArray(data?.matches)
    ? data.matches
    : [];

  return {
    source:data?.source || "unknown",
    status:data?.status || "fresh",
    reason:data?.reason || "",
    matches: matches.map((m)=>({
      ...m,
      id:
        m?.id ||
        `${m?.sport_key||"sport"}:${m?.home_team||"home"}:${m?.away_team||"away"}`,

      home_team:m?.home_team || "Home",
      away_team:m?.away_team || "Away",

      bestOdds:{
        home:m?.bestOdds?.home ?? null,
        draw:m?.bestOdds?.draw ?? null,
        away:m?.bestOdds?.away ?? null,

        point:m?.bestOdds?.point ?? null,
        over:m?.bestOdds?.over ?? null,
        under:m?.bestOdds?.under ?? null,

        spreadPointHome:m?.bestOdds?.spreadPointHome ?? null,
        spreadPointAway:m?.bestOdds?.spreadPointAway ?? null,
        spreadHome:m?.bestOdds?.spreadHome ?? null,
        spreadAway:m?.bestOdds?.spreadAway ?? null,
      }
    }))
  };
}

function impliedProb(odds){
 const n=Number(odds);
 if(!n || n<=1) return null;
 return 1/n;
}

export default function BettingWorkspaceClient({
 initialOddsData,
 lang="fi"
}){

 const t=getDictionary(lang);

 const {addBet}=useBetStore();

 const {toggleFavorite,isFavorite}=useFavoritesStore();

 const {
   addSnapshot,
   getSnapshots,
   clearHistory
 }=useOddsHistoryStore();

 const [oddsData,setOddsData]=useState(
   normalizeOddsData(initialOddsData || {})
 );

 const [market,setMarket]=useState("h2h");

 const [stakeMode,setStakeMode]=useState("manual");
 const [manualStake,setManualStake]=useState("10");

 const [bankroll,setBankroll]=useState("1000");
 const [kellyFraction,setKellyFraction]=useState("0.25");

 const [refreshInterval,setRefreshInterval]=useState(15);

 const [isRefreshing,setIsRefreshing]=useState(false);

 const [lastUpdatedAt,setLastUpdatedAt]=useState(Date.now());

 const matches=oddsData.matches || [];

 const [selectedMatchId,setSelectedMatchId]=useState(
   matches[0]?.id || null
 );

 const selectedMatch=useMemo(()=>{
   if(!matches.length) return null;

   return (
    matches.find(
      x=>x.id===selectedMatchId
    )
    || matches[0]
    || null
   );

 },[
   matches,
   selectedMatchId
 ]);

 useEffect(()=>{
   if(!selectedMatch && matches.length){
      setSelectedMatchId(matches[0].id);
   }
 },[
   matches,
   selectedMatch
 ]);

 const refreshOdds=useCallback(async()=>{

   try{

    setIsRefreshing(true);

    const res=await fetch(
      "/api/odds?sport=icehockey_liiga",
      {
        cache:"no-store"
      }
    );

    if(!res.ok){
      throw new Error("refresh fail");
    }

    const raw=await res.json();

    const nextData=
      normalizeOddsData(raw);

    setOddsData(nextData);

    setLastUpdatedAt(
      Date.now()
    );

    if(nextData.matches?.length){

      addSnapshot({
       market,
       matches:nextData.matches,
       source:nextData.source
      });

    }

   }catch(e){

    console.error(e);

   }finally{
    setIsRefreshing(false);
   }

 },[
   addSnapshot,
   market
 ]);

 useEffect(()=>{

   if(matches.length){
     addSnapshot({
       market,
       matches,
       source:oddsData.source
     });
   }

 },[
  market,
  matches,
  oddsData.source,
  addSnapshot
 ]);

 useEffect(()=>{

   if(!refreshInterval) return;

   const timer=
     setInterval(
      refreshOdds,
      refreshInterval*1000
     );

   return ()=>clearInterval(timer);

 },[
  refreshInterval,
  refreshOdds
 ]);

 const snapshots=
   selectedMatch
   ? getSnapshots(
      market,
      selectedMatch.id
     )
   : [];

 const movements=
   useMatchOddsMovements({
     snapshots,
     market
   });

 const trust=useMemo(()=>{

   return assessDataQuality({
     oddsData,
     selectedMatch,
     snapshots,
     market
   });

 },[
  oddsData,
  selectedMatch,
  snapshots,
  market
 ]);

 const confidenceBreakdown=
  useMemo(()=>{

   if(!selectedMatch) return null;

   return buildConfidenceBreakdown(
     selectedMatch,
     market
   );

 },[
  selectedMatch,
  market
 ]);

 const riskFlags=
  useMemo(()=>{

   if(!selectedMatch) return [];

   return buildRiskFlags(
     selectedMatch,
     market
   );

 },[
  selectedMatch,
  market
 ]);

 const marketRows=
 useMemo(()=>{

 if(!selectedMatch) return [];

 if(market==="totals"){

   const point=
     selectedMatch?.bestOdds?.point ?? "-";

   return [
     {
       key:"over",
       label:`Over ${point}`,
       odds:selectedMatch?.bestOdds?.over,
       probability:.52
     },
     {
       key:"under",
       label:`Under ${point}`,
       odds:selectedMatch?.bestOdds?.under,
       probability:.48
     }
   ].filter(x=>x.odds);

 }

 if(market==="spreads"){

   return[
    {
      key:"spread-home",
      label:
       `${selectedMatch.home_team} ${selectedMatch.bestOdds?.spreadPointHome||""}`,
      odds:selectedMatch.bestOdds?.spreadHome,
      probability:.52
    },
    {
      key:"spread-away",
      label:
       `${selectedMatch.away_team} ${selectedMatch.bestOdds?.spreadPointAway||""}`,
      odds:selectedMatch.bestOdds?.spreadAway,
      probability:.48
    }
   ].filter(x=>x.odds);

 }

 return[
  {
   key:"home",
   label:selectedMatch.home_team,
   odds:selectedMatch.bestOdds?.home,
   probability:.45
  },
  {
   key:"draw",
   label:t.draw || "Draw",
   odds:selectedMatch.bestOdds?.draw,
   probability:.23
  },
  {
   key:"away",
   label:selectedMatch.away_team,
   odds:selectedMatch.bestOdds?.away,
   probability:.32
  }

 ].filter(x=>x.odds);

 },[
  selectedMatch,
  market,
  t.draw
 ]);

 function getStake(row){

  if(stakeMode==="kelly"){

   return kellyStake({
     probability:row.probability,
     odds:Number(row.odds),
     bankroll:Number(bankroll),
     fraction:Number(kellyFraction)
   });

  }

  return Number(manualStake)||0;

 }

 function handleAddBet(row){

  const stake=getStake(row);

  if(!stake) return;

  addBet({
   match:
    `${selectedMatch.home_team} vs ${selectedMatch.away_team}`,
   selection:row.label,
   odds:Number(row.odds),
   stake:Number(stake)
  });

 }

 const panelStyle={
  border:"1px solid rgba(255,255,255,.1)",
  borderRadius:"16px",
  padding:"16px",
  background:"rgba(0,0,0,.2)"
 };

 const inputStyle={
  width:"100%",
  border:"1px solid rgba(255,255,255,.12)",
  background:"rgba(255,255,255,.06)",
  color:"#fff",
  borderRadius:"10px",
  padding:"10px 12px"
 };

 return(

<div style={{display:"grid",gap:"16px"}}>

<PageSection
 title="Betting Workspace"
 subtitle="Live odds, trust signals and controlled recommendations."
>

<DataTrustPanel
 trust={trust}
 lang={lang}
/>

<TrustWarning
 trust={trust}
 lang={lang}
/>

<div style={panelStyle}>

<div
 style={{
  display:"flex",
  gap:"10px",
  flexWrap:"wrap"
 }}
>

<SourceBadge>
 {String(
   oddsData.source || "unknown"
 ).toUpperCase()}
</SourceBadge>

<SourceBadge>
 {isRefreshing
   ? "UPDATING"
   : "LIVE"}
</SourceBadge>

</div>

<div
 style={{
  marginTop:"14px",
  color:"#94a3b8",
  fontSize:"13px"
 }}
>
Updated {formatClock(
 lastUpdatedAt,
 lang
)}
</div>

<div style={{marginTop:"14px"}}>

<select
 value={refreshInterval}
 onChange={e=>
   setRefreshInterval(
    Number(e.target.value)
   )
 }
 style={inputStyle}
>
<option value={5}>5s</option>
<option value={15}>15s</option>
<option value={30}>30s</option>
<option value={60}>60s</option>
</select>

</div>

<div
 style={{
   marginTop:"12px",
   display:"flex",
   gap:"10px",
   flexWrap:"wrap"
 }}
>
<button
 onClick={refreshOdds}
>
Refresh
</button>

<button
 onClick={clearHistory}
>
Clear history
</button>

</div>

</div>

<MarketTabs
 market={market}
 onChange={setMarket}
 lang={lang}
/>

<div
 style={{
 display:"grid",
 gridTemplateColumns:
 "minmax(0,1fr) minmax(0,1.3fr)",
 gap:"16px"
 }}
>

<div style={panelStyle}>

{matches.map(match=>(

<button
 key={match.id}
 onClick={()=>
  setSelectedMatchId(
   match.id
  )
 }
 style={{
   display:"block",
   width:"100%",
   marginBottom:"10px",
   padding:"14px",
   textAlign:"left"
 }}
>

<div>
{match.home_team}
 vs
 {match.away_team}
</div>

</button>

))}

</div>

<div style={{
 display:"grid",
 gap:"16px"
}}>

<div style={panelStyle}>

{marketRows.map(row=>{

 const implied=
   impliedProb(
    row.odds
   );

 const edge=
   implied
   ? row.probability-implied
   : null;

 return(

<div
 key={row.key}
 style={{
  marginBottom:"16px",
  paddingBottom:"16px",
  borderBottom:
   "1px solid rgba(255,255,255,.08)"
 }}
>

<div
 style={{
 fontWeight:800,
 color:"#fff"
 }}
>
{row.label}
</div>

<div
 style={{
 marginTop:"6px",
 color:"#dbe4f0"
 }}
>
Odds {row.odds}
</div>

<div
 style={{
 marginTop:"6px",
 color:
  edge>0
   ? "#86efac"
   : "#fca5a5"
 }}
>
Edge {
 edge
 ? (edge*100).toFixed(1)
 : "-"
}%
</div>

<div
 style={{
 marginTop:"8px"
 }}
>

<button
 onClick={()=>
  handleAddBet(row)
 }
>
Add Bet
</button>

<button
 onClick={()=>
  toggleFavorite({
   id:
   `${selectedMatch.id}-${row.key}`,
   match:
   `${selectedMatch.home_team} vs ${selectedMatch.away_team}`,
   selection:row.label,
   odds:row.odds
  })
 }
 style={{
  marginLeft:"10px"
 }}
>
{
 isFavorite(
 `${selectedMatch.id}-${row.key}`
 )
 ? "Saved"
 : "Save"
}
</button>

</div>

<PickExplanation
 row={row}
 trust={trust}
 lang={lang}
/>

</div>

)

})}

</div>

<ConfidenceBreakdown
 breakdown={confidenceBreakdown}
 lang={lang}
/>

<RiskFlags
 flags={riskFlags}
 lang={lang}
/>

<MarketMovementPanel
 market={market}
 selectedMatch={selectedMatch}
 movements={movements}
 lang={lang}
/>

</div>

</div>

</PageSection>

</div>

 );

}
