import { Resend } from "resend";

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

    await resend.emails.send({
      from: "onboarding@resend.dev", // 🔥 tärkeä
      to: process.env.EMAIL_TO,
      subject: "Scorecaster palaute",
      html: `
        <h2>Uusi palaute</h2>
        <p>${message}</p>

        <hr />

        <p><b>Laji:</b> ${selectedGroup || "-"}</p>
        <p><b>Liiga:</b> ${selectedSportKey || "-"}</p>
        <p><b>Bankroll:</b> ${bankroll ?? "-"}</p>
        <p><b>Ottelu:</b> ${
          selectedGame
            ? `${selectedGame.home_team} vs ${selectedGame.away_team}`
            : "-"
        }</p>
      `,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Email failed" },
      { status: 500 }
    );
  }
}
