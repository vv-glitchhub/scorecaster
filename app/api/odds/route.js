import { NextResponse } from "next/server";
import { getOddsData } from "@/lib/odds-service";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const sport = searchParams.get("sport") || "icehockey_liiga";
    const league = searchParams.get("league") || "";
    const market = searchParams.get("market") || "h2h";
    const region = searchParams.get("region") || "eu";
    const forceRefresh = searchParams.get("refresh") === "1";

    const data = await getOddsData({
      sport,
      league,
      market,
      region,
      forceRefresh,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch odds",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
