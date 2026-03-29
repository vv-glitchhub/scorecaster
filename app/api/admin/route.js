import { supabaseAdmin } from "../../../lib/supabase-admin";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      analyticsResult,
      feedbackResult,
      leagueResult,
      recentEventsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("analytics_events")
        .select("*", { count: "exact", head: true }),

      supabaseAdmin
        .from("feedback_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),

      supabaseAdmin
        .from("analytics_events")
        .select("selected_sport_key")
        .not("selected_sport_key", "is", null),

      supabaseAdmin
        .from("analytics_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const leagueCounts = {};
    for (const row of leagueResult.data || []) {
      const key = row.selected_sport_key || "unknown";
      leagueCounts[key] = (leagueCounts[key] || 0) + 1;
    }

    const popularLeagues = Object.entries(leagueCounts)
      .map(([league, count]) => ({ league, count }))
      .sort((a, b) => b.count - a.count);

    return Response.json({
      visitors: analyticsResult.count || 0,
      feedback: feedbackResult.data || [],
      popularLeagues,
      recentEvents: recentEventsResult.data || [],
    });
  } catch (error) {
    console.error("admin route error:", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
