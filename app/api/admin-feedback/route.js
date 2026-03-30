import { supabaseAdmin } from "../../../lib/supabase-admin";

export async function GET(req) {
  try {
    const secret = req.headers.get("x-admin-secret");

    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("feedback_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("admin-feedback fetch error:", error);
      return Response.json({ error: "Failed to fetch feedback" }, { status: 500 });
    }

    const unreadCount = (data || []).filter((item) => !item.is_read).length;

    return Response.json({
      success: true,
      unreadCount,
      data: data || [],
    });
  } catch (error) {
    console.error("admin-feedback route error:", error);
    return Response.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}
