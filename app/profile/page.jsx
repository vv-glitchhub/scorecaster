import Link from "next/link";
import AccountControls from "./AccountControls";
import NotificationSettings from "./NotificationSettings";
import { createClient } from "../../lib/supabase/server";
import { getSupabaseConfig } from "../../lib/supabase/config";
import { getSupabaseAdminClient } from "../../lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profile | Scorecaster"
};

export default async function ProfilePage() {
  const config = getSupabaseConfig();
  let user = null;
  let authError = null;

  if (config.isConfigured) {
    try {
      const supabase = await createClient();
      const result = await supabase.auth.getUser();
      user = result.data.user;
      authError = result.error;
    } catch (error) {
      authError = error;
    }
  }

  if (!config.isConfigured) {
    return (
      <AccountMessage
        badge="Setup required"
        title="Supabase-ympäristömuuttujat puuttuvat."
        text="Lisää Verceliin NEXT_PUBLIC_SUPABASE_URL ja publishable/anon key. Paikallinen Quick Use toimii silti normaalisti."
      />
    );
  }

  if (!user) {
    return (
      <AccountMessage
        badge="Signed out"
        title="Et ole vielä kirjautunut."
        text={authError?.message || "Kirjaudu sisään, jotta voit synkronoida paperivedot pilveen."}
        actionHref="/login"
        actionLabel="Kirjaudu tai luo tili"
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_35%),linear-gradient(135deg,#020617,#0f172a)] p-6 md:p-10">
        <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
          Authenticated paper account
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">Scorecaster-profiili</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          Sessio vahvistetaan palvelimella. Käyttäjäkohtaiset pilvitiedot suojataan RLS-säännöillä, eikä Scorecaster käsittele oikeaa rahaa tai maksutietoja.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="text-sm text-slate-400">Sähköposti</div>
          <div className="mt-2 break-all text-xl font-black">{user.email || "Ei sähköpostia"}</div>
          <div className="mt-5 text-sm text-slate-400">Käyttäjätunnus</div>
          <div className="mt-2 break-all font-mono text-xs text-slate-300">{user.id}</div>
          <div className="mt-5 text-sm text-slate-400">Tili luotu</div>
          <div className="mt-2 text-slate-300">
            {user.created_at ? new Date(user.created_at).toLocaleString("fi-FI") : "-"}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black">Toiminnot</h2>
          <div className="mt-5 grid gap-3">
            <Link href="/cloud-sync" className="rounded-2xl bg-emerald-400 px-5 py-4 text-center font-black text-slate-950">
              Avaa Cloud Sync
            </Link>
            <Link href="/watchlist" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center font-black text-white">
              Seurantalista ja Alert Inbox
            </Link>
            <Link href="/privacy" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center font-black text-white">
              Tietosuoja ja turvallisuus
            </Link>
            <form action="/auth/signout" method="post">
              <button className="w-full rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 font-black text-red-100">
                Kirjaudu ulos
              </button>
            </form>
          </div>
        </div>
      </section>

      <NotificationSettings />

      <AccountControls
        email={user.email || ""}
        deletionConfigured={Boolean(getSupabaseAdminClient())}
      />
    </div>
  );
}

function AccountMessage({ badge, title, text, actionHref = "/quick-use", actionLabel = "Quick Use" }) {
  return (
    <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 md:p-10">
      <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100">
        {badge}
      </div>
      <h1 className="mt-5 text-4xl font-black">{title}</h1>
      <p className="mt-4 leading-7 text-slate-300">{text}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={actionHref} className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950">
          {actionLabel}
        </Link>
        <Link href="/production-status" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">
          Production Status
        </Link>
      </div>
    </div>
  );
}
