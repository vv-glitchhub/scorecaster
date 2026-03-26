import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const res = await fetch(
      "https://api.github.com/repos/vv-glitchhub/scorecaster/commits?per_page=1"
    );

    const data = await res.json();

    return NextResponse.json({
      date: data?.[0]?.commit?.author?.date || null
    });

  } catch (e) {
    return NextResponse.json({
      date: null
    });
  }
}
