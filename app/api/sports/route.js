import { NextResponse } from "next/server";

function cleanTitle(title = "") {
  return title
    .replace(/^Soccer - /i, "")
    .replace(/^Ice Hockey - /i, "")
    .replace(/^Basketball - /i, "")
    .replace(/^American Football - /i, "")
    .replace(/^Baseball - /i, "")
    .replace(/^Mixed Martial Arts - /i, "");
}

function inferCategory(key = "", group = "") {
  const g = `${key} ${group}`.toLowerCase();

  if (g.includes("soccer")) return "jalkapallo";
  if (g.includes("icehockey") || g.includes("ice hockey")) return "jaakiekko";
  if (g.includes("basketball")) return "koripallo";
  return "other";
}

export async function GET() {
  try {
    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ODDS_API_KEY puuttuu" },
        { status: 500 }
      );
    }

    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports?apiKey=${apiKey}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sports API virhe: ${text}`);
    }

    const data = await res.json();

    const sports = data
      .filter((s) => s.active)
      .map((s) => ({
        key: s.key,
        group: s.group,
        title: cleanTitle(s.title),
        description: s.description,
        category: inferCategory(s.key, s.group)
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    return NextResponse.json({ sports });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Sports haku epäonnistui" },
      { status: 500 }
    );
  }
}
