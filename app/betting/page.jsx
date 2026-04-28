import { cookies } from "next/headers";
import BettingWorkspaceClient from "@/app/components/BettingWorkspaceClient";
import { normalizeLang } from "@/lib/i18n";

const initialOddsData = {
  source: "manual",
  status: "waiting",
  cached: false,
  reason:
    "Live-dataa ei haeta automaattisesti. Paina Hae live-pelit, kun haluat käyttää API:a.",
  matches: [],
};

export default async function BettingPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "fi");

  return <BettingWorkspaceClient initialOddsData={initialOddsData} lang={lang} />;
}
