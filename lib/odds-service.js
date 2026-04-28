const SPORT="icehockey_liiga";

function normalizeMatch(event){

const h2h=
event.bookmakers?.[0]?.markets?.find(
m=>m.key==="h2h"
);

if(!h2h) return null;

const outcomes=h2h.outcomes||[];

const home=outcomes.find(
o=>o.name===event.home_team
);

const away=outcomes.find(
o=>o.name===event.away_team
);

const draw=outcomes.find(
o=>o.name?.toLowerCase()==="draw"
);

return{
id:event.id,
sport_key:event.sport_key,
sport_title:event.sport_title,
commence_time:event.commence_time,
home_team:event.home_team,
away_team:event.away_team,

bestOdds:{
home:home?.price||null,
away:away?.price||null,
draw:draw?.price||null
}
};

}

export async function getOddsData(){

const key=process.env.ODDS_API_KEY;

if(!key){

return{
source:"fallback",
status:"demo",
matches:[]
};

}

try{

const res=await fetch(
`https://api.the-odds-api.com/v4/sports/${SPORT}/odds/?regions=eu&markets=h2h&oddsFormat=decimal&apiKey=${key}`,
{
next:{
revalidate:60
}
}
);

if(!res.ok){

throw new Error(
"Odds API failed"
);

}

const raw=await res.json();

const matches=
raw
.map(normalizeMatch)
.filter(Boolean);

return{
source:"live",
status:"fresh",
matches
};

}
catch(e){

return{
source:"fallback",
status:"demo",
matches:[]
};

}

}
