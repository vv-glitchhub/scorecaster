import Link from "next/link";
import AccountControls from "./AccountControls";
import NotificationSettings from "./NotificationSettings";
import ProfileOverviewClient from "./ProfileOverviewClient";
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

  return (
    <div className="space-y-8">
      <ProfileOverviewClient
        signedIn={Boolean(user)}
        email={user?.email || ""}
        authConfigured={config.isConfigured}
      />

      {!config.isConfigured && (
        <AccountMessage
          badge="Local mode"
          title="Pilvisynkronointi ei ole vielä määritetty."
          text="Paikallinen paperiseuranta, tulokset, asetukset ja AI Coach toimivat silti normaalisti tällä laitteella. Supabase-ympäristömuuttujat tarvitaan vain pilvitoimintoihin."
          actionHref="/tracking"
          actionLabel="Avaa omat vedot"
        />
      )}

      {config.isConfigured && !user && (
        <AccountMessage
          badge="Signed out"
          title="Kirjautuminen on vapaaehtoinen paikalliseen käyttöön."
          text={authError?.message || "Kirjaudu sisään vasta, kun haluat pilvisynkronoinnin, kommentoinnin tai käyttäjäkohtaiset verkkotoiminnot."}
          actionHref="/login"
          actionLabel="Kirjaudu tai luo tili"
        />
      )}

      {user && (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.75rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Pilvitili</div>
              <div className="mt-4 text-sm text-[var(--sc-muted)]">Sähköposti</div>
              <div className="mt-2 break-all text-xl font-black text-[var(--sc-text)]">{user.email || "Ei sähköpostia"}</div>
              <div className="mt-5 text-sm text-[var(--sc-muted)]">Käyttäjätunnus</div>
              <div className="mt-2 break-all font-mono text-xs text-[var(--sc-text-secondary)]">{user.id}</div>
              <div className="mt-5 text-sm text-[var(--sc-muted)]">Tili luotu</div>
              <div className="mt-2 text-[var(--sc-text-secondary)]">{user.created_at ? new Date(user.created_at).toLocaleString("fi-FI") : "-"}</div>
            </div>

            <div className="rounded-[1.75rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6">
              <h2 className="text-2xl font-black text-[var(--sc-text)]">Tilin toiminnot</h2>
              <div className="mt-5 grid gap-3">
                <Link href="/cloud-sync" className="sc-button-primary text-center">Avaa Cloud Sync</Link>
                <Link href="/watchlist" className="sc-button-secondary text-center">Seurantalista ja Alert Inbox</Link>
                <Link href="/privacy" className="sc-button-secondary text-center">Tietosuoja ja turvallisuus</Link>
                <form action="/auth/signout" method="post"><button className="w-full rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 font-black text-red-100">Kirjaudu ulos</button></form>
              </div>
            </div>
          </section>

          <NotificationSettings />
          <AccountControls email={user.email || ""} deletionConfigured={Boolean(getSupabaseAdminClient())} />
        </>
      )}
    </div>
  );
}

function AccountMessage({ badge, title, text, actionHref, actionLabel }) {
  return (
    <section className="rounded-[1.75rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6 md:p-8">
      <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100">{badge}</div>
      <h2 className="mt-5 text-2xl font-black text-[var(--sc-text)] md:text-3xl">{title}</h2>
      <p className="mt-4 max-w-3xl leading-7 text-[var(--sc-muted)]">{text}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={actionHref} className="sc-button-primary">{actionLabel}</Link>
        <Link href="/privacy" className="sc-button-secondary">Tietosuoja</Link>
      </div>
    </section>
  );
}
