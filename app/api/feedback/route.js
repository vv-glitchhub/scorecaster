import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const { message } = await req.json();

    if (!message) {
      return Response.json({ error: "No message" }, { status: 400 });
    }

    await resend.emails.send({
      from: "Scorecaster <onboarding@resend.dev>",
      to: "scorecaster.ai@outlook.com",
      subject: "New Feedback from Scorecaster",
      html: `
        <h2>New Feedback</h2>
        <p>${message}</p>
      `
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
