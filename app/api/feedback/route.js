import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const body = await req.json();

    console.log("📨 Sending email...");
    console.log("TO:", process.env.EMAIL_TO);

    const response = await resend.emails.send({
      from: "onboarding@resend.dev", // 🔥 PAKOLLINEN
      to: process.env.EMAIL_TO,
      subject: "Uusi palaute Scorecasterista",
      text: `
Palaute: ${body.message}

Liiga: ${body.league}
Ottelu: ${body.game}
Bankroll: ${body.bankroll}
      `,
    });

    console.log("✅ Email sent:", response);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("❌ Email error:", err);

    return Response.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
