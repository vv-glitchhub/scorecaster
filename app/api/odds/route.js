import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = "https://api.the-odds-api.com/v4/sports";

const CACHE_TTL_MINUTES = 15;

// ----------------------------
// DEMO FALLBACK (viimeinen turva)
// ----------------------------
function getDemoData(sport) {
  return [
    {
      id: "demo-1",
      sport_key: sport,
      home_team: "Boston Bruins",
      away_team: "New York Rangers",
      commence_time: new Date().toISOString(),
      bookmakers: [
        {
          title: "DemoOdds",
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: "Boston Bruins", price: 2.2 },
                { name: "New York Rangers", price: 1.8 },
              ],
            },
          ],
        },
      ],
    },
  ];
}

// ----------------------------
// GET
// ----------------------------
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport");
  const group = searchParams.get("group");

  if (!sport || !group) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // ----------------------------
  // 1. CHECK CACHE
  // ----------------------------
  const { data: cacheRow } = await supabase
    .from("odds_cache")
    .select("*")
    .eq("sport", sport)
    .eq("group_name", group)
    .maybeSingle();

  const now = new Date();

  if (cacheRow) {
    const updated = new Date(cacheRow.updated_at);
    const minutes = (now - updated) / 1000 / 60;

    if (minutes < CACHE_TTL_MINUTES && cacheRow.data?.length > 0) {
      return NextResponse.json({
        ...cacheRow,
        source: "cache",
      });
    }
  }

  // ----------------------------
  // 2. CALL LIVE API
  // ----------------------------
  let apiData = null;
  let quotaExceeded = false;
  let apiError = null;

  try {
    const res = await fetch(
      `${BASE_URL}/${sport}/odds?apiKey=${API_KEY}&markets=h2h`,
      { cache: "no-store" }
    );

    const json = await res.json();

    if (json?.error_code === "OUT_OF_USAGE_CREDITS") {
      quotaExceeded = true;
      apiError = json;
    } else {
      apiData = json;
    }
  } catch (err) {
    apiError = { message: "fetch failed" };
  }

  // ----------------------------
  // 3. IF SUCCESS → SAVE CACHE
  // ----------------------------
  if (apiData && Array.isArray(apiData) && apiData.length > 0) {
    await supabase.from("odds_cache").upsert({
      sport,
      group_name: group,
      data: apiData,
      fallback: false,
      empty: false,
      quota_exceeded: false,
      reason: null,
      message: null,
      raw_count: apiData.length,
      filtered_count: apiData.length,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      data: apiData,
      source: "live",
    });
  }

  // ----------------------------
  // 4. QUOTA → USE CACHE
  // ----------------------------
  if (quotaExceeded && cacheRow?.data?.length > 0) {
    return NextResponse.json({
      ...cacheRow,
      source: "cache_fallback",
      message: "Quota täynnä → käytetään cachea",
    });
  }

  // ----------------------------
  // 5. LAST RESORT → DEMO
  // ----------------------------
  const demo = getDemoData(sport);

  await supabase.from("odds_cache").upsert({
    sport,
    group_name: group,
    data: demo,
    fallback: true,
    empty: false,
    quota_exceeded: true,
    reason: "demo_fallback",
    message: "Demo data käytössä",
    raw_count: demo.length,
    filtered_count: demo.length,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({
    data: demo,
    source: "demo",
    message: "Demo fallback käytössä",
  });
}
