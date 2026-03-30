import { supabaseAdmin } from "../../../../lib/supabase-admin";

export async function POST(req) {
  try {
    const secret = req.headers.get("x-admin-secret");

    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();

    if (!id) {
      return Response.json({ error: "Missing id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("feedback_messages")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      console.error("mark read error:", error);
      return Response.json({ error: "Failed to mark as read" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("admin-feedback/read route error:", error);
    return Response.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}
