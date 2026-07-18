import { supabase } from "./supabase";

export const authRedirectUrl = "scorecaster://auth/confirm";

type CallbackTokens = {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
};

function callbackTokens(url: string): CallbackTokens {
  const parsed = new URL(url);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));

  return {
    code: parsed.searchParams.get("code") || hash.get("code"),
    accessToken: parsed.searchParams.get("access_token") || hash.get("access_token"),
    refreshToken: parsed.searchParams.get("refresh_token") || hash.get("refresh_token")
  };
}

export function isScorecasterAuthCallback(url: string) {
  return url.startsWith(authRedirectUrl);
}

export async function handleAuthCallbackUrl(url: string) {
  if (!isScorecasterAuthCallback(url)) {
    return { handled: false, error: null as Error | null };
  }

  try {
    const { code, accessToken, refreshToken } = callbackTokens(url);

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return { handled: true, error };
    }

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      return { handled: true, error };
    }

    return {
      handled: true,
      error: new Error("Authentication callback did not contain a supported session code")
    };
  } catch (error) {
    return {
      handled: true,
      error: error instanceof Error ? error : new Error("Authentication callback could not be processed")
    };
  }
}
