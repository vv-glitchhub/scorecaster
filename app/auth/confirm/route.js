import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

import { safeNextPath } from "../../../lib/auth-navigation.mjs";

export async function GET(request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const failure = code => NextResponse.redirect(new URL("/login?" + new URLSearchParams({ error: code, next }), url.origin));

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
      return failure("missing_confirmation");
    }

    if (error) {
      return failure("confirmation_failed");
    }

    return NextResponse.redirect(new URL(next, url.origin));
  } catch {
    return failure("confirmation_failed");
  }
}
