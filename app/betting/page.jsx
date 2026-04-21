import { cookies } from "next/headers";
import BettingWorkspaceClient from "@/app/components/BettingWorkspaceClient";
import { normalizeLang } from "@/lib/i18n";
import { getOddsData } from "@/lib/odds-service";

export default async function BettingPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "fi");

  let oddsData = {
    source: "unknown",
    status: "fresh",
    reason: "",
    matches: [],
  };

  try {
    oddsData = await getOddsData({ sport: "icehockey_liiga" });
  } catch {
    oddsData = {
      source: "unknown",
      status: "fresh",
      reason:
        lang === "fi"
          ? "Odds-datan haku epäonnistui. Sivu avattiin tyhjällä datalla."
          : "Odds fetch failed. The page was opened with empty data.",
      matches: [],
    };
  }

  return <BettingWorkspaceClient initialOddsData={oddsData} lang={lang} />;
}
