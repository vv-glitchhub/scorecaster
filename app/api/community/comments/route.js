import { createClient } from "../../../../lib/supabase/server";
import {
  boundedNumber,
  cleanText,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  readJsonBody
} from "../../../../lib/api-security";

export const dynamic = "force-dynamic";

function migrationMissing(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("community_comments") || message.includes("does not exist") || message.includes("relation");
}

export async function GET(request) {
  const requestId = getRequestId(request);

  try {
    const supabase = await createClient();
    const url = new URL(request.url);
    const unknown = [...url.searchParams.keys()].filter((key) => !["eventId", "limit"].includes(key));
    if (unknown.length) {
      return jsonResponse({ ok: false, error: "Unsupported query parameter" }, 400, requestId);
    }

    const eventId = cleanText(url.searchParams.get("eventId"), 180);
    const limit = boundedNumber(url.searchParams.get("limit"), { min: 1, max: 200, fallback: 100 });

    let query = supabase
      .from("community_comments")
      .select("id,event_id,user_id,author_name,message,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (eventId) query = query.eq("event_id", eventId);

    const { data, error } = await query;
    if (error) throw error;

    return jsonResponse({ ok: true, comments: data || [] }, 200, requestId);
  } catch (error) {
    const missing = migrationMissing(error);
    return jsonResponse({
      ok: false,
      error: missing ? "Community comments are not active yet" : "Comments unavailable",
      migrationRequired: missing ? "supabase/scorecaster_community_feed_v1.sql" : undefined
    }, missing ? 503 : 500, requestId);
  }
}

export async function POST(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }

  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "community_comment_write",
    limit: 20,
    windowSeconds: 300
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 4096);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  const eventId = cleanText(body.data?.eventId, 180);
  const message = cleanText(body.data?.message, 500);
  if (eventId.length < 2) return jsonResponse({ ok: false, error: "Event is required" }, 400, requestId);
  if (message.length < 2) return jsonResponse({ ok: false, error: "Comment is too short" }, 400, requestId);

  const metadata = auth.user.user_metadata || {};
  const authorName = cleanText(
    metadata.display_name || metadata.full_name || metadata.name || auth.user.email?.split("@")[0] || "Scorecaster user",
    60,
    "Scorecaster user"
  );

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
    const missing = migrationMissing(error);
    return jsonResponse({
      ok: false,
      error: missing ? "Community comments are not active yet" : "Comment could not be saved",
      migrationRequired: missing ? "supabase/scorecaster_community_feed_v1.sql" : undefined
    }, missing ? 503 : 500, requestId);
  }

  return jsonResponse({ ok: true, comment: data }, 201, requestId);
}
