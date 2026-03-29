import { Resend } from "resend";
import { supabaseAdmin } from "../../../lib/supabase-admin";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const {
      message,
      email,
      selectedSportKey,
      selectedGroup,
      selectedGame,
      bankroll,
      sessionId,
      visitorId,
    } = await req.json();

    if (!message || !message.trim()) {
      return Response.json({ error: "Message required" }, { status: 400 });
    }

    const selectedGameLabel = selectedGame
      ? `${selectedGame.home_team || "-"} vs ${selectedGame.away_team || "-"}`
      : null;

    const { error: dbError } = await supabaseAdmin.from("feedback_messages").insert({
      message: message.trim(),
      email: email || null,
      selected_group: selectedGroup || null,
      selected_sport_key: selectedSportKey || null,
      selected_game: selectedGameLabel,
      bankroll: bankroll ?? null,
      metadata: {
        sessionId: sessionId || null,
        visitorId: visitorId || null,
      },
    });

    if (dbError) {
      console.error("feedback insert error:", dbError);
    }

    const emailResult = await resend.emails.send({
      from: "Scorecaster <onboarding@resend.dev>",
      to: process.env.EMAIL_TO,
      subject: `Scorecaster palaute - ${new Date().toLocaleString("fi-FI")}`,
      html: `
        <h2>Uusi palaute Scorecasterista</h2>
        <p><strong>Viesti:</strong></p>
        <p>${message}</p>
        <hr />
        <p><strong>Email:</strong> ${email || "-"}</p>
        <p><strong>Laji:</strong> ${selectedGroup || "-"}</p>
        <p><strong>Liiga:</strong> ${selectedSportKey || "-"}</p>
        <p><strong>Ottelu:</strong> ${selectedGameLabel || "-"}</p>
        <p><strong>Bankroll:</strong> ${bankroll ?? "-"}</p>
      `,
    });

    return Response.json({ success: true, emailResult });
  } catch (error) {
    console.error("feedback route error:", error);
    return Response.json({ error: "Failed to send feedback" }, { status: 500 });
  }
}
