import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function POST(request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Always return the user to login even if Supabase is temporarily unavailable.
  }

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
