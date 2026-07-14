import { createClient } from "../../../../lib/supabase/server";
import { getSupabaseConfig } from "../../../../lib/supabase/config";

export const dynamic = "force-dynamic";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

async function getAuthenticatedClient() {
  if (!getSupabaseConfig().isConfigured) {
    return { error: json({ ok: false, error: "Supabase is not configured" }, 503) };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: json({ ok: false, error: "Authentication required" }, 401) };
  }

  return { supabase, user };
}

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeBet(bet, userId, index) {
  const match = String(bet?.match || "").trim();
  const selection = String(bet?.selection || bet?.label || "").trim();
  const odds = finiteNumber(bet?.odds);

  if (!match || !selection || !odds || odds <= 1) {
    return null;
  }

  const clientRef = String(bet?.id || `${match}-${selection}-${odds}-${index}`).slice(0, 240);

  return {
    user_id: userId,
    client_ref: clientRef,
    label: selection,
    match,
    market: String(bet?.market || "h2h").slice(0, 80),
    bookmaker: String(bet?.bookmaker || "manual").slice(0, 120),
    sport: String(bet?.sport || "manual").slice(0, 120),
    league: String(bet?.league || "manual").slice(0, 120),
    home_team: String(bet?.home_team || "").slice(0, 160),
    away_team: String(bet?.away_team || "").slice(0, 160),
    odds,
    stake: Math.max(0, finiteNumber(bet?.stake, 0)),
    edge: finiteNumber(bet?.edge),
    ev: finiteNumber(bet?.ev),
    confidence: finiteNumber(bet?.confidence),
    status: String(bet?.status || "open").slice(0, 40),
    raw_pick: bet
  };
}

export async function GET() {
  const auth = await getAuthenticatedClient();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from("bets")
    .select("id,client_ref,label,match,market,bookmaker,sport,league,home_team,away_team,odds,stake,edge,ev,confidence,status,result,profit,closing_odds,clv,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return json({ ok: false, error: error.message, hint: "Run supabase/scorecaster_auth_cloud.sql" }, 500);
  }

  return json({ ok: true, count: data?.length || 0, data: data || [] });
}

export async function POST(request) {
  const auth = await getAuthenticatedClient();
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const sourceBets = Array.isArray(body?.bets) ? body.bets.slice(0, 100) : [];
  const rows = sourceBets
    .map((bet, index) => normalizeBet(bet, auth.user.id, index))
    .filter(Boolean);

  if (!rows.length) {
    return json({ ok: false, error: "No valid bets supplied" }, 400);
  }

  const { data, error } = await auth.supabase
    .from("bets")
    .upsert(rows, { onConflict: "user_id,client_ref" })
    .select("id,client_ref,label,match,odds,stake,status,created_at,updated_at");

  if (error) {
    return json({ ok: false, error: error.message, hint: "Run supabase/scorecaster_auth_cloud.sql" }, 500);
  }

  return json({ ok: true, synced: data?.length || 0, data: data || [] });
}

export async function DELETE(request) {
  const auth = await getAuthenticatedClient();
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const ids = Array.isArray(body?.ids)
    ? body.ids.map(String).filter(Boolean).slice(0, 100)
    : [];

  if (!ids.length) {
    return json({ ok: false, error: "No bet ids supplied" }, 400);
  }

  const { error } = await auth.supabase
    .from("bets")
    .delete()
    .eq("user_id", auth.user.id)
    .in("id", ids);

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, deleted: ids.length });
}
