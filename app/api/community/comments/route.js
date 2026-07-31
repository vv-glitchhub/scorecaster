import { createClient } from "../../../../lib/supabase/server";
import { enforceRateLimit, getAuthenticatedContext } from "../../../../lib/api-security";

export const dynamic = "force-dynamic";

function response(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function clean(value, maxLength) {
  return String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function migrationMissing(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("community_comments") || message.includes("does not exist") || message.includes("relation");
}

export async function GET(request) {
  try {
    const supabase = await createClient();
    const url = new URL(request.url);
    const eventId = clean(url.searchParams.get("eventId"), 180);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));

    let query = supabase
      .from("community_comments")
      .select("id,event_id,user_id,author_name,message,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (eventId) query = query.eq("event_id", eventId);

    const { data, error } = await query;
    if (error) throw error;

    return response({ ok: true, comments: data || [] });
  } catch (error) {
    return response({
      ok: false,
      error: migrationMissing(error) ? "Community comments are not active yet" : "Comments unavailable",
      migrationRequired: migrationMissing(error) ? "supabase/scorecaster_community_feed_v1.sql" : undefined
    }, migrationMissing(error) ? 503 : 500);
  }
}

export async function POST(request) {
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return response({ ok: false, error: auth.error }, auth.status);

  const rateLimit = await enforceRateLimit(auth, crypto.randomUUID(), {
    bucket: `community-comment:${auth.user.id}`,
    limit: 20,
    windowSeconds: 300
  });
  if (rateLimit) return rateLimit;

  let body;
  try {
    body = await request.json();
  } catch {
    return response({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const eventId = clean(body?.eventId, 180);
  const message = clean(body?.message, 500);
  if (!eventId || eventId.length < 2) return response({ ok: false, error: "Event is required" }, 400);
  if (message.length < 2) return response({ ok: false, error: "Comment is too short" }, 400);

  const metadata = auth.user.user_metadata || {};
  const authorName = clean(metadata.display_name || metadata.full_name || metadata.name || auth.user.email?.split("@")[0] || "Scorecaster user", 60);

  const { data, error } = await auth.supabase
    .from("community_comments")
    .insert({
      event_id: eventId,
      user_id: auth.user.id,
      author_name: authorName,
      message
    })
    .select("id,event_id,user_id,author_name,message,created_at")
    .single();

  if (error) {
    return response({
      ok: false,
      error: migrationMissing(error) ? "Community comments are not active yet" : "Comment could not be saved",
      migrationRequired: migrationMissing(error) ? "supabase/scorecaster_community_feed_v1.sql" : undefined
    }, migrationMissing(error) ? 503 : 500);
  }

  return response({ ok: true, comment: data }, 201);
}
