import { cookies } from "next/headers";
import BettingWorkspaceClient from "@/app/components/BettingWorkspaceClient";
import { normalizeLang } from "@/lib/i18n";
import { getOddsData } from "@/lib/odds-service";

const demoOddsData = {
  source: "fallback",
  status: "demo",
  reason:
    "Live-dataa ei saatu ladattua. Näytetään testidata, jotta sovellusta voi käyttää ja käyttöliittymä pysyy testattavana.",
  matches: [
    {
      id: "demo-liiga-1",
      sport_key: "icehockey_liiga",
      sport_title: "Liiga",
      home_team: "Tappara",
      away_team: "Ilves",
      bestOdds: {
        home: 2.1,
        draw: 4.2,
        away: 2.75,
        point: 5.5,
        over: 1.9,
        under: 1.92,
        spreadPointHome: -1.5,
        spreadPointAway: 1.5,
        spreadHome: 2.45,
        spreadAway: 1.55,
      },
    },
    {
      id: "demo-liiga-2",
      sport_key: "icehockey_liiga",
      sport_title: "Liiga",
      home_team: "Lukko",
      away_team: "TPS",
      bestOdds: {
        home: 1.85,
        draw: 4.4,
        away: 3.25,
        point: 5.5,
        over: 1.88,
        under: 1.95,
        spreadPointHome: -1.5,
        spreadPointAway: 1.5,
        spreadHome: 2.2,
        spreadAway: 1.7,
      },
    },
  ],
};

export default async function BettingPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "fi");

  let oddsData = demoOddsData;

  try {
    const liveData = await getOddsData({ sport: "icehockey_liiga" });

    if (Array.isArray(liveData?.matches) && liveData.matches.length > 0) {
      oddsData = liveData;
    }
  } catch {
    oddsData = demoOddsData;
  }

  return <BettingWorkspaceClient initialOddsData={oddsData} lang={lang} />;
}
