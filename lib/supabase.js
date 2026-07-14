import { createClient } from "@supabase/supabase-js";

let adminClient;

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }

  return adminClient;
}

// Backwards-compatible lazy proxy for existing server routes. Importing this
// module no longer throws during build when the service-role key is absent.
export const supabase = new Proxy({}, {
  get(_target, property) {
    const client = getSupabaseAdminClient();

    if (!client) {
      throw new Error(
        "Supabase admin client is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server."
      );
    }

    const value = client[property];
    return typeof value === "function" ? value.bind(client) : value;
  }
});
