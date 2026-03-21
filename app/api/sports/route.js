import { NextResponse } from "next/server";

export async function GET() {
  try {
    const url = `https://api.the-odds-api.com/v4/sports/?apiKey=${process.env.ODDS_API_KEY}`;
    const res = await fetch(url, { cache: "no-store" });

    const text = await res.text();

    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Sports list haku epäonnistui", details: e.message },
      { status: 500 }
    );
  }
}
