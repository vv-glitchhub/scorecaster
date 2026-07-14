import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import { createClient, processLock } from "@supabase/supabase-js";
import { secureSessionStorage } from "./secure-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

export const mobileAuthConfigured = Boolean(url && publishableKey);

export const supabase = createClient(
  url || "https://not-configured.invalid",
  publishableKey || "not-configured",
  {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock
    }
  }
);

let currentState = AppState.currentState;

AppState.addEventListener("change", (nextState) => {
  const becameActive = currentState !== "active" && nextState === "active";
  const leftActive = currentState === "active" && nextState !== "active";
  currentState = nextState;

  if (becameActive) supabase.auth.startAutoRefresh();
  if (leftActive) supabase.auth.stopAutoRefresh();
});
