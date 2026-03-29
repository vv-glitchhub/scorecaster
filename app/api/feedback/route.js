import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { message } = body;

    if (!message || message.length < 3) {
      return NextResponse.json(
        { error: "Viesti liian lyhyt" },
        { status: 400 }
      );
    }

    // 1. Tallenna Supabaseen
    await supabase.from("feedback_messages").insert([
      {
        message,
      },
    ]);

    // 2. Lähetä sähköposti
    const email = await resend.emails.send({
      from: "Scorecaster <onboarding@resend.dev>",
      to: process.env.EMAIL_TO,
      subject: "📩 Uusi palaute",
      text: message,
    });

    return NextResponse.json({ success: true, email });
  } catch (err) {
    console.error("FEEDBACK ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
