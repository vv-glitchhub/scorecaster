"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ProductionStatusClient() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHealth() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const data = await response.json();
        setHealth(data);
        if (!response.ok) setError("Health endpoint reported a degraded state.");
      } catch {
        setError("Health endpoint could not be reached.");
      }
    }

    loadHealth();
  }, []);

  const services = health?.services ? Object.entries(health.services) : [];

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_34%),linear-gradient(135deg,#020617,#0f172a)] p-6 md:p-10">
        <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
          Production Guardrails
        </div>
        <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">
          Scorecaster deployment and service status.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          Tämä sivu tarkistaa julkisen health-päätteen. Kirjautuneen käyttäjän oikeat worker-ajot, jonot ja migraatiot näkyvät Operations Dashboardissa.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/release-readiness" className="rounded-2xl bg-emerald-300 px-5 py-3 font-black text-slate-950">Release Readiness</Link>
          <Link href="/operations" className="rounded-2xl bg-sky-300 px-5 py-3 font-black text-slate-950">Operations Dashboard</Link>
          <Link href="/cloud-sync" className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950">Cloud Sync</Link>
          <Link href="/profile" className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 font-black text-emerald-100">Profile</Link>
          <Link href="/quick-use" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">Quick Use</Link>
          <Link href="/core-status" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">Core Status</Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatusCard label="Health" value={health?.status || "loading"} />
        <StatusCard label="Mode" value={health?.mode || "loading"} />
        <StatusCard label="Deployment" value={health?.deployment || "loading"} />
        <StatusCard label="Commit" value={health?.commit ? health.commit.slice(0, 8) : "not available"} />
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-red-100">{error}</div>
      ) : null}

      {health?.nextStep ? (
        <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-5 text-sky-100">
          <strong>Next step:</strong> {health.nextStep}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map(([name, value]) => {
          const isBoolean = typeof value === "boolean";
          const ready = isBoolean ? value : Boolean(value);

          return (
            <div key={name} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="text-sm uppercase tracking-[0.22em] text-slate-500">Service</div>
              <h2 className="mt-3 text-xl font-black">{formatName(name)}</h2>
              <div className={`mt-4 inline-flex rounded-full px-3 py-1 text-sm font-black ${ready ? "bg-emerald-400/10 text-emerald-300" : "bg-yellow-400/10 text-yellow-200"}`}>
                {isBoolean ? (ready ? "READY" : "NOT CONFIGURED") : String(value)}
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-2xl font-black">Live endpoint</h2>
        <p className="mt-3 text-slate-400">Open the raw JSON response for deployment checks. User-specific operational data remains behind authentication.</p>
        <a href="/api/health" className="mt-5 inline-flex rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">
          Open /api/health
        </a>
      </section>
    </div>
  );
}

function StatusCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 break-all text-2xl font-black">{value}</div>
    </div>
  );
}

function formatName(value) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
