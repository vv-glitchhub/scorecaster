import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = "https://api.the-odds-api.com/v4/sports";
const CACHE_TTL_MINUTES = 15;

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

function isFreshEnough(updatedAt) {
  if (!updatedAt) return false;

  const updated = new Date(updatedAt);
  const now = new Date();
  const minutes = (now - updated) / 1000 / 60;

  return minutes < CACHE_TTL_MINUTES;
}

function isUsableRealCache(row) {
  if (!row) return false;
  if (!Array.isArray(row.data) || row.data.length === 0) return false;
  if (row.fallback === true) return false;
  return true;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport");
    const group = searchParams.get("group");
    const allowDemo = searchParams.get("allowDemo") === "true";

    if (!sport || !group) {
      return NextResponse.json(
        { error: "Missing sport or group" },
        { status: 400 }
      );
    }

    const { data: cacheRow, error: cacheError } = await supabase
      .from("odds_cache")
      .select("*")
      .eq("sport", sport)
      .eq("group_name", group)
      .maybeSingle();

    if (cacheError) {
      console.error("odds_cache read error:", cacheError);
    }

    if (isUsableRealCache(cacheRow) && isFreshEnough(cacheRow.updated_at)) {
      return NextResponse.json({
        fallback: false,
        empty: false,
        quotaExceeded: false,
        reason: "cache_hit",
        message: "Näytetään välimuistissa oleva oikea data.",
        sport,
        group,
        sourceSport: cacheRow.source_sport || sport,
        rawCount: cacheRow.raw_count || cacheRow.data.length,
        filteredCount: cacheRow.filtered_count || cacheRow.data.length,
        apiError: null,
        data: cacheRow.data,
        source: "cache",
      });
    }

    if (!API_KEY) {
      if (isUsableRealCache(cacheRow)) {
        return NextResponse.json({
          fallback: false,
          empty: false,
          quotaExceeded: false,
          reason: "missing_api_key_using_cache",
          message: "ODDS_API_KEY puuttuu, käytetään vanhaa cachea.",
          sport,
          group,
          sourceSport: cacheRow.source_sport || sport,
          rawCount: cacheRow.raw_count || cacheRow.data.length,
          filteredCount: cacheRow.filtered_count || cacheRow.data.length,
          apiError: null,
          data: cacheRow.data,
          source: "cache",
        });
      }

      if (!allowDemo) {
        return NextResponse.json({
          fallback: false,
          empty: true,
          quotaExceeded: false,
          reason: "missing_api_key",
          message: "ODDS_API_KEY puuttuu palvelimelta.",
          sport,
          group,
          sourceSport: null,
          rawCount: 0,
          filteredCount: 0,
          apiError: null,
          data: [],
          source: "empty",
        });
      }

      const demo = getDemoData(sport);

      return NextResponse.json({
        fallback: true,
        empty: false,
        quotaExceeded: false,
        reason: "missing_api_key_demo",
        message: "ODDS_API_KEY puuttuu, käytetään demo-dataa.",
        sport,
        group,
        sourceSport: null,
        rawCount: demo.length,
        filteredCount: demo.length,
        apiError: null,
        data: demo,
        source: "demo",
      });
    }

    const res = await fetch(
      `${BASE_URL}/${sport}/odds?apiKey=${API_KEY}&markets=h2h&regions=us,eu,uk&oddsFormat=decimal&dateFormat=iso`,
      { cache: "no-store" }
    );

    const json = await res.json().catch(() => null);
    const quotaExceeded = json?.error_code === "OUT_OF_USAGE_CREDITS";

    if (res.ok && Array.isArray(json) && json.length > 0) {
      const { error: upsertError } = await supabase.from("odds_cache").upsert({
        sport,
        group_name: group,
        source_sport: sport,
        data: json,
        fallback: false,
        empty: false,
        quota_exceeded: false,
        reason: null,
        message: "Live data cached",
        raw_count: json.length,
        filtered_count: json.length,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) {
        console.error("odds_cache upsert error:", upsertError);
      }

      return NextResponse.json({
        fallback: false,
        empty: false,
        quotaExceeded: false,
        reason: null,
        message: "Live data haettu onnistuneesti.",
        sport,
        group,
        sourceSport: sport,
        rawCount: json.length,
        filteredCount: json.length,
        apiError: null,
        data: json,
        source: "live",
      });
    }

    if (quotaExceeded) {
      if (isUsableRealCache(cacheRow)) {
        return NextResponse.json({
          fallback: false,
          empty: false,
          quotaExceeded: true,
          reason: "quota_exceeded_using_cache",
          message: "API quota täynnä, käytetään viimeisintä oikeaa cache-dataa.",
          sport,
          group,
          sourceSport: cacheRow.source_sport || sport,
          rawCount: cacheRow.raw_count || cacheRow.data.length,
          filteredCount: cacheRow.filtered_count || cacheRow.data.length,
          apiError: json,
          data: cacheRow.data,
          source: "cache_fallback",
        });
      }

      if (!allowDemo) {
        return NextResponse.json({
          fallback: false,
          empty: true,
          quotaExceeded: true,
          reason: "quota_exceeded",
          message: "API quota on täynnä. Oikeaa dataa ei saatu juuri nyt.",
          sport,
          group,
          sourceSport: null,
          rawCount: 0,
          filteredCount: 0,
          apiError: json,
          data: [],
          source: "empty",
        });
      }

      const demo = getDemoData(sport);

      return NextResponse.json({
        fallback: true,
        empty: false,
        quotaExceeded: true,
        reason: "quota_exceeded_demo",
        message: "API quota täynnä, käytetään demo-dataa.",
        sport,
        group,
        sourceSport: null,
        rawCount: demo.length,
        filteredCount: demo.length,
        apiError: json,
        data: demo,
        source: "demo",
      });
    }

    if (isUsableRealCache(cacheRow)) {
      return NextResponse.json({
        fallback: false,
        empty: false,
        quotaExceeded: false,
        reason: "live_failed_using_cache",
        message: "Live-haku epäonnistui, käytetään vanhaa cachea.",
        sport,
        group,
        sourceSport: cacheRow.source_sport || sport,
        rawCount: cacheRow.raw_count || cacheRow.data.length,
        filteredCount: cacheRow.filtered_count || cacheRow.data.length,
        apiError: json,
        data: cacheRow.data,
        source: "cache_fallback",
      });
    }

    if (!allowDemo) {
      return NextResponse.json({
        fallback: false,
        empty: true,
        quotaExceeded: false,
        reason: "no_games_found",
        message: "Valitusta liigasta ei löytynyt pelejä.",
        sport,
        group,
        sourceSport: null,
        rawCount: 0,
        filteredCount: 0,
        apiError: json,
        data: [],
        source: "empty",
      });
    }

    const demo = getDemoData(sport);

    return NextResponse.json({
      fallback: true,
      empty: false,
      quotaExceeded: false,
      reason: "demo_fallback",
      message: "Käytetään demo-dataa.",
      sport,
      group,
      sourceSport: null,
      rawCount: demo.length,
      filteredCount: demo.length,
      apiError: json,
      data: demo,
      source: "demo",
    });
  } catch (error) {
    console.error("odds route server error:", error);

    return NextResponse.json({
      fallback: false,
      empty: true,
      quotaExceeded: false,
      reason: "server_error",
      message: "Palvelinvirhe odds-haussa.",
      sport: null,
      group: null,
      sourceSport: null,
      rawCount: 0,
      filteredCount: 0,
      apiError: String(error),
      data: [],
      source: "empty",
    });
  }
}
