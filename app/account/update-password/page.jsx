"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { authErrorText } from "../../../lib/auth-messages.mjs";
import { useLanguage } from "../../components/LanguageProvider";

export default function UpdatePasswordPage() {
  const { tr } = useLanguage();
  const [session, setSession] = useState("loading");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let active = true;
    async function verify() {
      try {
        const { data, error } = await createClient().auth.getUser();
        if (active) setSession(!error && data.user ? "ready" : "missing");
      } catch { if (active) setSession("missing"); }
    }
    void verify();
    return () => { active = false; };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy || session !== "ready") return;
    if (password !== confirmation) { setError(tr({ fi: "Salasanat eivät täsmää.", en: "The passwords do not match.", es: "Las contraseñas no coinciden." })); return; }
    setBusy(true); setError("");
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      setPassword(""); setConfirmation(""); setDone(true);
    } catch (cause) { setError(authErrorText(cause, tr)); }
    finally { setBusy(false); }
  }
  return <section className="sc-surface mx-auto max-w-lg rounded-3xl p-6 sm:p-8">
    <h1 className="text-3xl font-black text-[var(--sc-text)]">{tr({ fi: "Valitse uusi salasana", en: "Choose a new password", es: "Elige una nueva contraseña" })}</h1>
    {session === "loading" ? <p role="status" className="mt-4 text-[var(--sc-muted)]">{tr({ fi: "Tarkistetaan palautuslinkki…", en: "Checking the reset link…", es: "Comprobando el enlace…" })}</p> : session === "missing" ? <div className="mt-4"><p role="alert" className="text-[var(--sc-text)]">{tr({ fi: "Palautuslinkki ei ole voimassa. Pyydä uusi linkki kirjautumissivulta ja avaa se samassa selaimessa.", en: "The reset link is not valid. Request a new one on the sign-in page and open it in the same browser.", es: "El enlace no es válido. Solicita otro y ábrelo en el mismo navegador." })}</p><Link href="/login" className="sc-button-secondary mt-4 inline-flex">{tr({ fi: "Kirjautumissivulle", en: "Go to sign in", es: "Ir al inicio de sesión" })}</Link></div> : done ? <div className="mt-4"><p role="status" className="text-[var(--sc-text)]">{tr({ fi: "Salasana päivitetty.", en: "Password updated.", es: "Contraseña actualizada." })}</p><Link href="/profile" className="sc-button-primary mt-4 inline-flex">{tr({ fi: "Jatka profiiliin", en: "Continue to profile", es: "Continuar al perfil" })}</Link></div> : <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-sm font-bold text-[var(--sc-text)]">{tr({ fi: "Uusi salasana (vähintään 8 merkkiä)", en: "New password (at least 8 characters)", es: "Nueva contraseña (mínimo 8 caracteres)" })}<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} className="sc-input mt-2 w-full" /></label>
      <label className="block text-sm font-bold text-[var(--sc-text)]">{tr({ fi: "Vahvista salasana", en: "Confirm password", es: "Confirmar contraseña" })}<input type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} className="sc-input mt-2 w-full" /></label>
      {error ? <p role="alert" className="text-sm text-[var(--sc-text)]">{error}</p> : null}
      <button type="submit" disabled={busy} className="sc-button-primary w-full disabled:opacity-50">{busy ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Tallenna uusi salasana", en: "Save new password", es: "Guardar nueva contraseña" })}</button>
    </form>}
  </section>;
}
