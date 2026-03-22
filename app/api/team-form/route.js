import { NextResponse } from "next/server";

const BASE_URL = "https://v3.football.api-sports.io";

async function getTeamId(teamName) {
  const res = await fetch(`${BASE_URL}/teams?search=${teamName}`, {
    headers: {
      "x-apisports-key": process.env.APIFOOTBALL_KEY
    }
  });

  const data = await res.json();
  return data.response?.[0]?.team?.id;
}

async function getLastMatches(teamId) {
  const res = await fetch(`${BASE_URL}/fixtures?team=${teamId}&last=5`, {
    headers: {
      "x-apisports-key": process.env.APIFOOTBALL_KEY
    }
  });

  const data = await res.json();
  return data.response || [];
}

function analyzeForm(matches, teamId) {
  let goalsFor = 0;
  let goalsAgainst = 0;
  let form = "";

  matches.forEach((m) => {
    const home = m.teams.home.id === teamId;
    const gf = home ? m.goals.home : m.goals.away;
    const ga = home ? m.goals.away : m.goals.home;

    goalsFor += gf;
    goalsAgainst += ga;

    if (gf > ga) form += "W";
    else if (gf === ga) form += "D";
    else form += "L";
  });

  return {
    avgGoalsFor: goalsFor / matches.length || 1,
    avgGoalsAgainst: goalsAgainst / matches.length || 1,
    form
  };
}

export async function POST(req) {
  try {
    const { home, away } = await req.json();

    const homeId = await getTeamId(home);
    const awayId = await getTeamId(away);

    if (!homeId || !awayId) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const homeMatches = await getLastMatches(homeId);
    const awayMatches = await getLastMatches(awayId);

    const homeStats = analyzeForm(homeMatches, homeId);
    const awayStats = analyzeForm(awayMatches, awayId);

    return NextResponse.json({
      homeStats,
      awayStats
    });
  } catch (e) {
    return NextResponse.json({ error: "Form fetch failed" }, { status: 500 });
  }
}
