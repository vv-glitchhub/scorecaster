import { supabaseAdmin } from "../../../lib/supabase-admin";

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      event_name,
      page_path,
      session_id,
      visitor_id,
      selected_group,
      selected_sport_key,
      selected_game,
      metadata,
    } = body || {};

    if (!event_name) {
      return Response.json({ error: "event_name required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("analytics_events").insert({
      event_name,
      page_path: page_path || null,
      session_id: session_id || null,
      visitor_id: visitor_id || null,
      selected_group: selected_group || null,
      selected_sport_key: selected_sport_key || null,
      selected_game: selected_game || null,
      metadata: metadata || {},
    });

    if (error) {
      console.error("track insert error:", error);
      return Response.json({ error: "insert failed" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("track route error:", error);
    return Response.json({ error: "server error" }, { status: 500 });
  }
}
