import { Resend } from "resend";

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
    } = await req.json();

    if (!message || !message.trim()) {
      return Response.json({ error: "Message required" }, { status: 400 });
    }

    const result = await resend.emails.send({
      from: "Scorecaster <onboarding@resend.dev>",
      to: process.env.EMAIL_TO,
      subject: `📩 Scorecaster Feedback ${new Date().toLocaleString()}`,
      html: `
        <h2>New Scorecaster feedback</h2>

        <p><strong>Message:</strong></p>
        <p>${message}</p>

        <hr />

        <p><strong>Sender email:</strong> ${email || "Not provided"}</p>
        <p><strong>Sport group:</strong> ${selectedGroup || "-"}</p>
        <p><strong>League key:</strong> ${selectedSportKey || "-"}</p>
        <p><strong>Bankroll:</strong> ${bankroll ?? "-"}</p>
        <p><strong>Selected game:</strong> ${
          selectedGame ? `${selectedGame.home} vs ${selectedGame.away}` : "-"
        }</p>
      `,
    });

    return Response.json({ success: true, result });
  } catch (error) {
    console.error("Feedback email failed:", error);
    return Response.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
