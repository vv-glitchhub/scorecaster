import { cookies } from "next/headers";
import BettingWorkspaceClient from "@/app/components/BettingWorkspaceClient";
import { normalizeLang } from "@/lib/i18n";

const initialOddsData = {
  source: "manual",
  status: "waiting",
  provider: "",
  cached: false,
  reason:
    "Live-dataa ei haeta automaattisesti. Valitse laji/liiga ja paina Hae pelit.",
  matches: [],
};

export default async function BettingPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "fi");

  return <BettingWorkspaceClient initialOddsData={initialOddsData} lang={lang} />;
}
