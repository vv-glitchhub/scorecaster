"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

function cleanEmail(value) {
  return String(value || "").trim().replaceAll('"', "").replaceAll("'", "").toLowerCase();
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage("");

    const cleanedEmail = cleanEmail(email);
    if (!cleanedEmail || password.length < 6) {
      setMessage("Anna kelvollinen sähköposti ja vähintään 6 merkin salasana.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=/profile`
          }
        });

        if (error) throw error;

        if (data.session) {
          router.push("/profile");
          router.refresh();
          return;
        }

        setMessage("Tili luotu. Vahvista sähköposti ja palaa sitten Scorecasteriin.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanedEmail,
        password
      });

      if (error) throw error;

      router.push("/profile");
      router.refresh();
    } catch (error) {
      setMessage(error?.message || "Kirjautuminen epäonnistui.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_35%),linear-gradient(135deg,#020617,#0f172a)] p-6 md:p-10">
        <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
          Caster Account
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">
          {mode === "signin" ? "Kirjaudu Scorecasteriin" : "Luo Scorecaster-tili"}
        </h1>
        <p className="mt-4 leading-7 text-slate-300">
          Tili mahdollistaa pilvihistorian, laitteiden välisen synkronoinnin ja myöhemmin yhden kirjautumisen kaikkiin Caster-sovelluksiin.
        </p>
      </section>

      <form onSubmit={submit} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-slate-300">
            Sähköposti
            <input
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none focus:border-emerald-400/60"
              placeholder="sinä@example.com"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-slate-300">
            Salasana
            <input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none focus:border-emerald-400/60"
              placeholder="Vähintään 6 merkkiä"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-emerald-400 px-5 py-4 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Odota..." : mode === "signin" ? "Kirjaudu" : "Luo tili"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode((current) => (current === "signin" ? "signup" : "signin"));
              setMessage("");
            }}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-black text-white"
          >
            {mode === "signin" ? "Tarvitsen uuden tilin" : "Minulla on jo tili"}
          </button>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">
            {message}
          </div>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-3">
        <Link href="/quick-use" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white">
          Käytä paikallisesti
        </Link>
        <Link href="/production-status" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white">
          Tarkista palvelun tila
        </Link>
      </div>
    </div>
  );
}
