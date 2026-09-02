import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildMarketMicrostructure } from "../../../lib/market-microstructure-v2.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const json = (body, status = 200) => Response.json(body, { status, headers: HEADERS });
const clean = (value, maximum = 180) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);
const ALLOWED_MARKETS = new Set(["h2h", "spreads", "totals"]);

function missingPatch(error) {
  return error?.code === "42P01" || /market_provider_snapshots_v2|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: HEADERS });
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["eventId", "market", "selection"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return json({ ok: false, error: "Unsupported query parameter" }, 400);
  }

  const eventId = clean(url.searchParams.get("eventId"));
  const market = clean(url.searchParams.get("market") || "h2h", 40).toLowerCase();
  const selection = clean(url.searchParams.get("selection"), 160);
  if (!eventId || !ALLOWED_MARKETS.has(market)) {
    return json({ ok: false, error: "A valid eventId and market are required" }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return json({ ok: false, error: "Production database is not configured", paperOnly: true }, 503);

  try {
    let query = admin
      .from("market_provider_snapshots_v2")
      .select("id,capture_id,event_id,sport,league,commence_time,market,selection,point,bookmaker_key,bookmaker_title,price,implied_probability,normalized_probability,market_overround,provider_last_update,captured_at,source_id,source_reference")
      .eq("event_id", eventId)
      .eq("market", market)
      .order("captured_at", { ascending: true })
      .limit(10_000);
    if (selection) query = query.eq("selection", selection);
    const { data, error } = await query;
    if (error) throw error;

    const analysis = buildMarketMicrostructure(data || [], {
      eventId,
      market,
      selection,
      generatedAt: new Date().toISOString()
    });
    return json({
      ...analysis,
      publicApi: { path: "/api/market-microstructure", authenticationRequired: false, cors: "*" },
      methodologyPath: "/market-microstructure",
      sourceRegistryPath: "/sources"
    });
  } catch (error) {
    return json({
      ok: false,
      error: missingPatch(error)
        ? "Market Microstructure V2 production patch is not active"
        : process.env.NODE_ENV === "production" ? "Market microstructure could not be loaded" : String(error),
      requiredPatch: missingPatch(error) ? "scripts/apply-market-microstructure-v2.sql" : undefined,
      paperOnly: true
    }, missingPatch(error) ? 503 : 500);
  }
}
