import { supabaseAdmin } from "../../../lib/supabase-admin";

export async function POST(req) {
  try {
    const {
      message,
      selectedSportKey,
      selectedGroup,
      selectedGame,
      bankroll,
    } = await req.json();

    if (!message || !message.trim()) {
      return Response.json({ error: "Message required" }, { status: 400 });
    }

    const selectedGameLabel = selectedGame
      ? `${selectedGame.home_team || "-"} vs ${selectedGame.away_team || "-"}`
      : null;

    const { data, error } = await supabaseAdmin
      .from("feedback_messages")
      .insert({
        message: message.trim(),
        selected_group: selectedGroup || null,
        selected_sport_key: selectedSportKey || null,
        selected_game: selectedGameLabel,
        bankroll: bankroll ?? null,
        metadata: {},
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error("feedback insert error:", error);
      return Response.json({ error: "Insert failed" }, { status: 500 });
    }

    return Response.json({
      success: true,
      feedback: data,
    });
  } catch (error) {
    console.error("feedback route error:", error);
    return Response.json(
      { error: "Failed to save feedback", details: String(error) },
      { status: 500 }
    );
  }
}
