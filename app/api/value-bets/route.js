import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("value_bets")
      .select("*")
      .order("best_ev", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to fetch value bets" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      valueBets: data || []
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
