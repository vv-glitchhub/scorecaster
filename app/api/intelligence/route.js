import { NextResponse } from "next/server";

import { fetchNewsForMatch } from "@/lib/news-fetcher";
import { fetchInjuriesForMatch } from "@/lib/injury-fetcher";
import { fetchLineupForMatch } from "@/lib/lineup-fetcher";
import { fetchPolymarketForMatch } from "@/lib/polymarket-fetcher";

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      homeTeam,
      awayTeam,
      sport,
      league
    } = body;

    const [
      news,
      injuries,
      lineup,
      polymarket
    ] = await Promise.all([
      fetchNewsForMatch({
        homeTeam,
        awayTeam,
        sport,
        league
      }),

      fetchInjuriesForMatch({
        homeTeam,
        awayTeam,
        sport,
        league
      }),

      fetchLineupForMatch({
        homeTeam,
        awayTeam,
        sport,
        league
      }),

      fetchPolymarketForMatch({
        homeTeam,
        awayTeam,
        sport,
        league
      })
    ]);

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),

      match: {
        homeTeam,
        awayTeam,
        sport,
        league
      },

      intelligence: {
        news,
        injuries,
        lineup,
        polymarket
      }
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      {
        status: 500
      }
    );
  }
}
