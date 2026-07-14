"use client";

import { useState } from "react";

const CONFIRMATION = "DELETE MY SCORECASTER ACCOUNT";

export default function AccountControls({ email, deletionConfigured }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function exportData() {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/account/export", {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Tietojen vienti epäonnistui");

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `scorecaster-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Tietopaketti ladattiin.");
    } catch (error) {
      setMessage(error.message || "Tietojen vienti epäonnistui");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!deletionConfigured) {
      setMessage("Tilin poisto vaatii palvelimen SUPABASE_SERVICE_ROLE_KEY-asetuksen.");
      return;
    }

    if (confirmation !== CONFIRMATION) {
      setMessage("Kirjoita vahvistuslause täsmälleen oikein.");
      return;
    }

    if (!window.confirm("Poistetaanko Scorecaster-tili ja kaikki paperiseurannan tiedot pysyvästi?")) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ confirmation, email })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Tilin poisto epäonnistui");
      window.location.assign("/login?accountDeleted=1");
    } catch (error) {
      setMessage(error.message || "Tilin poisto epäonnistui");
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-2xl font-black">Omat tiedot</h2>
        <p className="mt-3 leading-7 text-slate-300">
          Vie profiili, paperipelikassa ja paperivetohistoria JSON-tiedostona.
        </p>
        <button
          type="button"
          onClick={exportData}
          disabled={busy}
          className="mt-5 w-full rounded-2xl bg-emerald-400 px-5 py-4 font-black text-slate-950 disabled:opacity-50"
        >
          {busy ? "Odota…" : "Lataa omat tiedot"}
        </button>
      </div>

      <div className="rounded-[2rem] border border-red-400/20 bg-red-400/[0.06] p-6">
        <h2 className="text-2xl font-black text-red-100">Poista tili</h2>
        <p className="mt-3 leading-7 text-red-100/80">
          Poisto hävittää käyttäjätilin, paperivedot ja paperipelikassan pysyvästi.
        </p>
        <label className="mt-5 block text-sm font-bold text-red-100" htmlFor="account-delete-confirmation">
          Kirjoita {CONFIRMATION}
        </label>
        <input
          id="account-delete-confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          className="mt-2 w-full rounded-2xl border border-red-300/20 bg-slate-950 px-4 py-3 text-white outline-none"
        />
        <button
          type="button"
          onClick={deleteAccount}
          disabled={busy || !deletionConfigured}
          className="mt-4 w-full rounded-2xl bg-red-500 px-5 py-4 font-black text-white disabled:opacity-40"
        >
          Poista tili pysyvästi
        </button>
        {!deletionConfigured && (
          <p className="mt-3 text-sm text-amber-200">Palvelimen tilinpoistoavain pitää vielä määrittää ennen julkaisua.</p>
        )}
      </div>

      {message && (
        <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
          {message}
        </div>
      )}
    </section>
  );
}
