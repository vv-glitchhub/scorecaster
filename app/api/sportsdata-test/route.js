import { NextResponse } from "next/server";
import { fetchSportsDataNHLInjuries } from "../../../lib/sportsdata-fetcher";

export async function GET() {
  const result = await fetchSportsDataNHLInjuries();
  return NextResponse.json(result);
}
