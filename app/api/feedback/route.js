import { Resend } from "resend";
import { supabaseAdmin } from "../../../lib/supabase-admin";

const resend = new Resend(process.env.RESEND_API_KEY);

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

    const { error: dbError } = await supabaseAdmin.from("feedback_messages").insert({
      message: message.trim(),
      selected_group: selectedGroup || null,
      selected_sport_key: selectedSportKey || null,
      selected_game: selectedGameLabel,
      bankroll: bankroll ?? null,
      metadata: {},
    });

    if (dbError) {
      console.error("feedback insert error:", dbError);
    }

    const result = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.EMAIL_TO,
      subject: "Uusi palaute Scorecasterista",
      text: [
        `Viesti: ${message}`,
        `Laji: ${selectedGroup || "-"}`,
        `Liiga: ${selectedSportKey || "-"}`,
        `Ottelu: ${selectedGameLabel || "-"}`,
        `Bankroll: ${bankroll ?? "-"}`,
      ].join("\n"),
    });

    console.error("RESEND RESULT:", JSON.stringify(result, null, 2));

    if (result?.error) {
      return Response.json(
        { error: "Email send failed", details: result.error },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      emailId: result?.data?.id || null,
    });
  } catch (error) {
    console.error("feedback route error:", error);
    return Response.json(
      { error: "Failed to send feedback", details: String(error) },
      { status: 500 }
    );
  }
}
