import { NextResponse } from "next/server"

const API_KEY = process.env.ODDS_API_KEY
const BASE_URL = "https://api.the-odds-api.com/v4/sports"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sport = searchParams.get("sport") || "icehockey_liiga"

  if (!API_KEY) {
    return NextResponse.json({
      status: 401,
      reason: "Missing API key",
      demo: true,
      data: getDemoData()
    })
  }

  try {
    const res = await fetch(
      `${BASE_URL}/${sport}/odds/?regions=eu&markets=h2h&apiKey=${API_KEY}`
    )

    if (!res.ok) {
      return NextResponse.json({
        status: res.status,
        reason: "Live data unavailable, using demo fallback",
        demo: true,
        data: getDemoData()
      })
    }

    const data = await res.json()

    return NextResponse.json({
      status: 200,
      demo: false,
      data
    })
  } catch (err) {
    return NextResponse.json({
      status: 500,
      reason: "Fetch failed, using demo fallback",
      demo: true,
      data: getDemoData()
    })
  }
}

function getDemoData() {
  return [
    {
      home_team: "Tappara",
      away_team: "Ilves",
      bookmakers: [
        {
          title: "DemoBook",
          markets: [
            {
              outcomes: [
                { name: "Tappara", price: 2.25 },
                { name: "Ilves", price: 1.78 }
              ]
            }
          ]
        }
      ]
    }
  ]
}
