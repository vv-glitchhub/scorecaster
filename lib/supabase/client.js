import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "./config";

let browserClient;

export function createClient() {
  const { url, key } = requireSupabaseConfig();

  if (!browserClient) {
    browserClient = createBrowserClient(url, key);
  }

  return browserClient;
}
