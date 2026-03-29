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

    const cleanMessage = message.trim();

    const selectedGameLabel = selectedGame
      ? `${selectedGame.home_team || "-"} vs ${selectedGame.away_team || "-"}`
      : "-";

    const { error: dbError } = await supabaseAdmin.from("feedback_messages").insert({
      message: cleanMessage,
      selected_group: selectedGroup || null,
      selected_sport_key: selectedSportKey || null,
      selected_game: selectedGameLabel,
      bankroll: bankroll ?? null,
      metadata: {},
    });

    if (dbError) {
      console.error("feedback insert error:", dbError);
    }

    const resendResponse = await resend.emails.send({
      from: "Scorecaster <onboarding@resend.dev>",
      to: ["vikke.vuorio99@outlook.com"],
      subject: "Uusi palaute Scorecasterista",
      text: [
        `Palaute: ${cleanMessage}`,
        `Laji: ${selectedGroup || "-"}`,
        `Liiga: ${selectedSportKey || "-"}`,
        `Ottelu: ${selectedGameLabel}`,
        `Bankroll: ${bankroll ?? "-"}`,
      ].join("\n"),
    });

    console.log("RESEND RESPONSE:", JSON.stringify(resendResponse, null, 2));

    if (resendResponse?.error) {
      console.error("RESEND ERROR:", resendResponse.error);

      return Response.json(
        {
          error: "Email send failed",
          details: resendResponse.error,
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      emailId: resendResponse?.data?.id || null,
    });
  } catch (error) {
    console.error("feedback route error:", error);

    return Response.json(
      {
        error: "Failed to send feedback",
        details: String(error),
      },
      { status: 500 }
    );
  }
}
