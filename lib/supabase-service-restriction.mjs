// Supabase Fair Use restrictions can reject all REST requests with HTTP 402
// while the underlying Postgres management connection remains reachable.
// Never interpret such a response as an empty dataset or a successful capture.
const RESTRICTED_CODE = "supabase-service-restricted";
export const SUPABASE_SERVICE_RESTRICTED_CODE = RESTRICTED_CODE;

export function isSupabaseServiceRestricted(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code ?? "").trim();
  const status = String(error.status ?? error.statusCode ?? "").trim();
  if (code === "402" || status === "402") return true;
  // Supabase-js PostgrestError may not retain the upstream HTTP status.
  const description = [error.message, error.details, error.hint]
    .filter((part) => typeof part === "string")
    .join(" ")
    .toLowerCase();
  return /(?:\b402\b|payment required|service restriction|service is restricted|fair use policy)/i.test(description);
}

export function restrictedSupabaseResponse(context = "Database") {
  return {
    ok: false,
    error: `${context} is unavailable due to a Supabase service restriction`,
    errorCode: RESTRICTED_CODE,
    releaseState: "blocked",
    retryableWithoutConfigurationChange: false,
    paperOnly: true
  };
}

// Uses a head-only read before expensive providers are queried. This is not
// proof of write access; it only prevents wasting vendor quota when all REST
// reads are already denied. The write path still handles failures separately.
export async function assertSupabaseRestReachable(admin, table) {
  const { error } = await admin.from(table).select("id", { count: "exact", head: true }).limit(1);
  if (error) throw error;
}
