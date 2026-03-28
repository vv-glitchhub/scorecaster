export async function POST(req) {
  try {
    const body = await req.json();

    const { message, email } = body;

    // Simppeli fallback (loggaa Verceliin)
    console.log("FEEDBACK:", {
      message,
      email,
      date: new Date().toISOString()
    });

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: "Failed to send feedback" }, { status: 500 });
  }
}
