import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getSupabaseConfig } from "./config";

export async function updateSession(request) {
  const { url, key, isConfigured } = getSupabaseConfig();
  let response = NextResponse.next({ request });

  if (!isConfigured) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  // Validates the JWT and refreshes the session cookie when necessary.
  await supabase.auth.getClaims();

  return response;
}
