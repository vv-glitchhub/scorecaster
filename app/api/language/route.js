import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const lang = body?.lang === "fi" ? "fi" : "en";

    const response = NextResponse.json({ ok: true, lang });
    response.cookies.set("scorecaster_lang", lang, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
