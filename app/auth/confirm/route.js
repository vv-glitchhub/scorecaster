import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

function safeNextPath(value) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

export async function GET(request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  try {
    const supabase = await createClient();
    let error = null;

    if (code) {
      ({ error } = await supabase.auth.exchangeCodeForSession(code));
    } else if (tokenHash && type) {
      ({ error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type
      }));
    } else {
      return NextResponse.redirect(new URL("/login?error=missing_confirmation", url.origin));
    }

    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
    }

    return NextResponse.redirect(new URL(next, url.origin));
  } catch (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error?.message || "confirmation_failed")}`, url.origin)
    );
  }
}
