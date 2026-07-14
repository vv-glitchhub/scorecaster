"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const storageKey = "scorecaster.quickUse.bets";

function readLocalBets() {
  try {
    const value = localStorage.getItem(storageKey);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function CloudSyncClient() {
  const [localBets, setLocalBets] = useState([]);
  const [cloudBets, setCloudBets] = useState([]);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Tarkistetaan pilvitiliä...");
  const [busy, setBusy] = useState(false);

  const localStake = useMemo(
    () => localBets.reduce((sum, bet) => sum + Number(bet?.stake || 0), 0),
    [localBets]
  );

  useEffect(() => {
    setLocalBets(readLocalBets());
    refreshCloud();
  }, []);

  async function refreshCloud() {
    setBusy(true);

    try {
      const response = await fetch("/api/cloud/bets", { cache: "no-store" });
      const payload = await response.json();

      if (response.status === 401) {
        setStatus("signed-out");
        setCloudBets([]);
        setMessage("Kirjaudu sisään ennen pilvisynkronointia.");
        return;
      }

      if (!response.ok || !payload.ok) {
        setStatus("error");
        setMessage(payload.error || "Pilvitietojen lataus epäonnistui.");
        return;
      }

      setStatus("ready");
      setCloudBets(payload.data || []);
      setMessage(`Pilvi valmis. ${payload.count || 0} vetoa tallennettuna.`);
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || "Pilvipalveluun ei saatu yhteyttä.");
    } finally {
      setBusy(false);
    }
  }

  async function syncLocalBets() {
    if (!localBets.length) {
      setMessage("Paikallisessa vetolistassa ei ole synkronoitavaa.");
      return;
    }

    setBusy(true);
    setMessage("Synkronoidaan paikallisia vetoja...");

    try {
      const response = await fetch("/api/cloud/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bets: localBets })
      });
      const payload = await response.json();

      if (response.status === 401) {
        setStatus("signed-out");
        setMessage("Kirjaudu sisään ennen synkronointia.");
        return;
      }

      if (!response.ok || !payload.ok) {
        setStatus("error");
        setMessage(payload.error || "Synkronointi epäonnistui.");
        return;
      }

      setStatus("ready");
      setMessage(`${payload.synced || 0} paikallista vetoa synkronoitu. Paikallista kopiota ei poistettu.`);
      await refreshCloud();
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || "Synkronointi epäonnistui.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCloudBet(id) {
    setBusy(true);

    try {
      const response = await fetch("/api/cloud/bets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error || "Pilvivedon poistaminen epäonnistui.");
        return;
      }

      setCloudBets((current) => current.filter((bet) => bet.id !== id));
      setMessage("Pilviveto poistettu. Paikallinen kopio säilyi.");
    } catch (error) {
      setMessage(error?.message || "Pilvivedon poistaminen epäonnistui.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_35%),linear-gradient(135deg,#020617,#0f172a)] p-6 md:p-10">
        <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-bold text-sky-200">
          Scorecaster Cloud Sync
        </div>
        <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
          Siirrä paikalliset vedot turvallisesti käyttäjätilillesi.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          Synkronointi käyttää kirjautunutta Supabase-käyttäjää ja tietokannan RLS-suojausta. Sama paikallinen veto päivitetään pilveen uudelleen ilman kaksoiskappaletta.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/quick-use" className="rounded-2xl bg-sky-400 px-5 py-3 font-black text-slate-950">
            Quick Use
          </Link>
          <Link href="/profile" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">
            Profiili
          </Link>
          <Link href="/login" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">
            Kirjaudu
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatusCard label="Paikalliset vedot" value={String(localBets.length)} detail={`Panos yhteensä €${localStake.toFixed(2)}`} />
        <StatusCard label="Pilvivedot" value={String(cloudBets.length)} detail="Käyttäjäkohtaisesti suojattu" />
        <StatusCard label="Tila" value={status.toUpperCase()} detail={message} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black">Synkronointitoiminnot</h2>
          <div className="mt-5 grid gap-3">
            <button
              onClick={syncLocalBets}
              disabled={busy || status === "signed-out"}
              className="rounded-2xl bg-emerald-400 px-5 py-4 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Odota..." : "Synkronoi paikalliset vedot"}
            </button>
            <button
              onClick={() => {
                setLocalBets(readLocalBets());
                refreshCloud();
              }}
              disabled={busy}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-black text-white disabled:opacity-50"
            >
              Päivitä molemmat listat
            </button>
            {status === "signed-out" ? (
              <Link href="/login" className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-center font-black text-amber-100">
                Kirjaudu pilveen
              </Link>
            ) : null}
          </div>
          <div className="mt-5 rounded-2xl bg-slate-950/70 p-4 text-sm leading-6 text-slate-300">
            Ennen ensimmäistä käyttöä aja Supabasessa tiedosto <strong>supabase/scorecaster_auth_cloud.sql</strong>.
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Pilvihistoria</h2>
              <p className="mt-1 text-sm text-slate-400">Enintään 200 uusinta vetoa.</p>
            </div>
            <button
              onClick={refreshCloud}
              disabled={busy}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Päivitä
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {cloudBets.length ? (
              cloudBets.map((bet) => (
                <article key={bet.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {bet.market} · {bet.status}
                      </div>
                      <h3 className="mt-2 text-xl font-black">{bet.match || `${bet.home_team || ""} vs ${bet.away_team || ""}`}</h3>
                      <p className="mt-1 text-slate-300">{bet.label} @ {bet.odds}</p>
                      <p className="mt-1 text-sm text-slate-400">Panos €{Number(bet.stake || 0).toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => deleteCloudBet(bet.id)}
                      disabled={busy}
                      className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-100 disabled:opacity-50"
                    >
                      Poista
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl bg-slate-950/70 p-5 text-slate-400">
                Ei pilvivetoja vielä.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusCard({ label, value, detail }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{detail}</div>
    </div>
  );
}
