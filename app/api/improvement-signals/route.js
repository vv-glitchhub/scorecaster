import { NextResponse } from "next/server";
import { recordImprovementSignal } from "../../../lib/caster-intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const site = request.headers.get("sec-fetch-site");
    if (site === "cross-site") return NextResponse.json({ ok: false }, { status: 403 });
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 8192) return NextResponse.json({ ok: false }, { status: 413 });
    const body = await request.json();
    await recordImprovementSignal(body);
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    const unavailable = error?.message === "CASTER_INTELLIGENCE_NOT_CONFIGURED";
    return NextResponse.json({ ok: false, reason: unavailable ? "not_configured" : "rejected" }, { status: unavailable ? 503 : 400 });
  }
}
