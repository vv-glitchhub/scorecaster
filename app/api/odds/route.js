import { NextResponse } from "next/server";
import { getOddsData } from "../../../lib/odds-service";

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const requestedSport = searchParams.get("sport") || "icehockey_liiga";
  const requestedGroup = searchParams.get("group") || "";

  const data = await getOddsData({
    requestedSport,
    requestedGroup,
  });

  return NextResponse.json(data);
}
