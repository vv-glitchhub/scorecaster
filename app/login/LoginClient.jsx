"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { authErrorText } from "../../lib/auth-messages.mjs";
import { useLanguage } from "../components/LanguageProvider";

export default function LoginClient({ next, confirmationError }) {
  const router = useRouter();
  const { tr } = useLanguage();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const reset = mode === "reset";
  const signup = mode === "signup";
  const title = reset ? tr({ fi: "Palauta salasana", en: "Reset password", es: "Restablecer contraseña" }) : signup ? tr({ fi: "Luo Scorecaster-tili", en: "Create a Scorecaster account", es: "Crear cuenta de Scorecaster" }) : tr({ fi: "Kirjaudu Scorecasteriin", en: "Sign in to Scorecaster", es: "Iniciar sesión en Scorecaster" });
  function changeMode(value) { setMode(value); setNotice(null); setPassword(""); setVisible(false); }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      const supabase = createClient();
      const cleanEmail = email.trim();
      const redirect = new URL("/auth/confirm", window.location.origin);
      redirect.searchParams.set("next", reset ? "/account/update-password" : next);
      if (reset) {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: redirect.toString() });
        if (error) throw error;
        setNotice({ text: tr({ fi: "Jos sähköpostiin liittyy tili, saat salasanan palautuslinkin. Avaa linkki tässä selaimessa ja tarkista myös roskaposti.", en: "If an account uses this email, you will receive a reset link. Open it in this browser and check your spam folder.", es: "Si existe una cuenta con ese correo, recibirás un enlace. Ábrelo en este navegador y revisa spam." }) });
        return;
      }
      if (signup) {
        const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password, options: { emailRedirectTo: redirect.toString() } });
        if (error) throw error;
        if (!data.session) {
          setNotice({ text: tr({ fi: "Tarkista sähköpostisi ja vahvista tili tässä selaimessa. Jos sinulla on jo tili, voit kirjautua sisään.", en: "Check your email to confirm the account in this browser. If you already have an account, sign in.", es: "Revisa tu correo y confirma la cuenta en este navegador. Si ya tienes cuenta, inicia sesión." }) });
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
      }
      router.replace(next); router.refresh();
    } catch (error) { setNotice({ error: true, text: authErrorText(error, tr) }); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-lg space-y-5">
    <section className="sc-surface rounded-3xl p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--sc-brand)]">Scorecaster</p>
      <h1 className="mt-3 text-3xl font-black text-[var(--sc-text)]">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--sc-muted)]">{reset ? tr({ fi: "Lähetämme sähköpostiisi linkin uuden salasanan valitsemiseen.", en: "We will email you a link to choose a new password.", es: "Te enviaremos un enlace para elegir una nueva contraseña." }) : tr({ fi: "Tallenna paperivalinnat ja seurantalista tilillesi. Otteluita ja analyysejä voit selata myös ilman kirjautumista.", en: "Save paper selections and your watchlist to your account. Matches and analysis are also available without signing in.", es: "Guarda selecciones y seguimiento en tu cuenta. Puedes explorar partidos y análisis sin iniciar sesión." })}</p>
      {confirmationError && !notice ? <p role="alert" className="mt-4 rounded-xl border border-amber-400/30 p-3 text-sm text-[var(--sc-text)]">{tr({ fi: "Vahvistuslinkki puuttuu, on vanhentunut tai avattiin eri selaimessa. Kokeile kirjautumista tai pyydä uusi salasanan palautuslinkki.", en: "The confirmation link is missing, expired or was opened in another browser. Try signing in or request a new password reset link.", es: "El enlace falta, caducó o se abrió en otro navegador. Intenta iniciar sesión o solicita otro enlace." })}</p> : null}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-bold text-[var(--sc-text)]">{tr({ fi: "Sähköposti", en: "Email", es: "Correo electrónico" })}<input type="email" required autoComplete="email" autoCapitalize="none" autoCorrect="off" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} className="sc-input mt-2 w-full" /></label>
        {!reset ? <div><label htmlFor="login-password" className="block text-sm font-bold text-[var(--sc-text)]">{tr({ fi: "Salasana", en: "Password", es: "Contraseña" })}</label><div className="mt-2 flex gap-2"><input id="login-password" type={visible ? "text" : "password"} required minLength={signup ? 8 : undefined} autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} className="sc-input min-w-0 flex-1" /><button type="button" aria-pressed={visible} onClick={() => setVisible(value => !value)} className="sc-button-ghost">{visible ? tr({ fi: "Piilota", en: "Hide", es: "Ocultar" }) : tr({ fi: "Näytä", en: "Show", es: "Mostrar" })}</button></div>{signup ? <p className="mt-2 text-xs text-[var(--sc-muted)]">{tr({ fi: "Vähintään 8 merkkiä.", en: "At least 8 characters.", es: "Al menos 8 caracteres." })}</p> : null}</div> : null}
        <button type="submit" disabled={busy} className="sc-button-primary w-full disabled:opacity-50">{busy ? tr({ fi: "Odota…", en: "Please wait…", es: "Espera…" }) : reset ? tr({ fi: "Lähetä palautuslinkki", en: "Send reset link", es: "Enviar enlace" }) : signup ? tr({ fi: "Luo tili", en: "Create account", es: "Crear cuenta" }) : tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</button>
        {notice ? <p role={notice.error ? "alert" : "status"} className={`rounded-xl border p-4 text-sm text-[var(--sc-text)] ${notice.error ? "border-rose-400/30" : "border-emerald-400/30"}`}>{notice.text}</p> : null}
      </form>
      <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm"><button type="button" disabled={busy} onClick={() => changeMode(mode === "signin" ? "signup" : "signin")} className="font-bold text-[var(--sc-brand)] underline">{mode === "signin" ? tr({ fi: "Luo uusi tili", en: "Create an account", es: "Crear cuenta" }) : tr({ fi: "Takaisin kirjautumiseen", en: "Back to sign in", es: "Volver al inicio de sesión" })}</button>{mode === "signin" ? <button type="button" disabled={busy} onClick={() => changeMode("reset")} className="text-[var(--sc-muted)] underline">{tr({ fi: "Unohditko salasanan?", en: "Forgot password?", es: "¿Olvidaste la contraseña?" })}</button> : null}</div>
    </section>
    <Link href={next === "/profile" ? "/events" : next} className="sc-button-secondary flex justify-center">{tr({ fi: "Jatka selaamista ilman kirjautumista", en: "Continue browsing without signing in", es: "Seguir explorando sin iniciar sesión" })}</Link>
  </div>;
}
