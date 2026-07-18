"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

function number(value, digits = 4) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : "–";
}

function percent(value, digits = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${(parsed * 100).toFixed(digits)} %` : "–";
}

function statusTone(status) {
  if (status === "shadow-outperformed") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (status === "shadow-did-not-outperform") return "border-yellow-400/30 bg-yellow-400/10 text-yellow-100";
  return "border-sky-400/30 bg-sky-400/10 text-sky-100";
}

function Metric({ label, value, note }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="text-sm text-slate-400">{label}</div><div className="mt-2 text-3xl font-black text-white">{value}</div>{note && <div className="mt-1 text-xs text-slate-500">{note}</div>}</div>;
}

function ModelCard({ title, id, train, holdout, tr }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <h2 className="mt-2 text-xl font-black text-white">{id || "–"}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-500">Train Brier</div><div className="mt-1 font-black">{number(train?.brierScore)}</div></div>
        <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-500">Holdout Brier</div><div className="mt-1 font-black">{number(holdout?.brierScore)}</div></div>
        <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-500">Holdout log loss</div><div className="mt-1 font-black">{number(holdout?.logLoss)}</div></div>
        <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-500">{tr({ fi: "Kalibrointiero", en: "Calibration gap", es: "Brecha de calibración" })}</div><div className="mt-1 font-black">{percent(holdout?.calibrationGap)}</div></div>
      </div>
    </article>
  );
}

export default function FormRestLabClient() {
  const { tr, locale } = useLanguage();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/agent/form-rest-lab", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Model Lab unavailable");
      setPayload(data);
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : tr({ fi: "Laboratoriota ei voitu ladata.", en: "The lab could not be loaded.", es: "No se pudo cargar el laboratorio." }));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => { void load(); }, [load]);

  const report = payload?.report || null;
  const sports = useMemo(() => Object.entries(report?.bySport || {}), [report]);
  const improvement = report?.challenger?.holdoutImprovement || {};
  const authError = /sign|auth|session|kirjaud/i.test(error);

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_34%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-9">
        <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-black text-sky-200">Form & Rest Shadow V1</div>
        <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{tr({ fi: "Vire- ja lepomallin laboratorio", en: "Form & Rest Model Lab", es: "Laboratorio de forma y descanso" })}</h1>
        <p className="mt-4 max-w-4xl text-slate-300">{tr({ fi: "Laboratorio vertaa palvelimen tallentamaa NHL- ja NBA-varjomallia markkinakonsensukseen kronologisella holdout-jaksolla. Se ei muuta PLAY-päätöstä, kerrointa, edgeä, EV:tä tai paperipanosta.", en: "The lab compares the server-stored NHL and NBA shadow model with market consensus on a chronological holdout. It does not change PLAY, odds, edge, EV or paper stake.", es: "El laboratorio compara el modelo sombra de NHL y NBA guardado por el servidor con el consenso de mercado en un holdout cronológico. No cambia PLAY, cuota, ventaja, EV ni importe simulado." })}</p>
        <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => void load()} disabled={loading} className="rounded-2xl bg-sky-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50">{loading ? tr({ fi: "Ladataan…", en: "Loading…", es: "Cargando…" }) : tr({ fi: "Päivitä laboratorio", en: "Refresh lab", es: "Actualizar laboratorio" })}</button><Link href="/agent" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">{tr({ fi: "Avaa Agent", en: "Open Agent", es: "Abrir Agent" })}</Link></div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-100">{error}{authError && <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link>}</div>}

      {!loading && report && <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label={tr({ fi: "Tila", en: "Status", es: "Estado" })} value={report.status || "–"} />
          <Metric label={tr({ fi: "Hyväksytyt havainnot", en: "Accepted samples", es: "Muestras aceptadas" })} value={`${report.sampleSize || 0}/${report.minimumSamples || 40}`} />
          <Metric label="Train / holdout" value={`${report.trainSize || 0} / ${report.holdoutSize || 0}`} />
          <Metric label={tr({ fi: "Hylätyt rivit", en: "Excluded rows", es: "Filas excluidas" })} value={report.excludedRows || 0} />
          <Metric label="Holdout Brier Δ" value={number(improvement.brier)} note={tr({ fi: "Positiivinen suosii haastajaa", en: "Positive favors challenger", es: "Positivo favorece al challenger" })} />
        </section>

        <div className={`rounded-2xl border p-4 text-sm font-bold ${statusTone(report.status)}`}>{tr({ fi: "Varjotila on pakollinen. Automaattista mallipromootiota tai tuotantotodennäköisyyden muutosta ei ole.", en: "Shadow mode is mandatory. There is no automatic model promotion or production-probability change.", es: "El modo sombra es obligatorio. No hay promoción automática ni cambio de la probabilidad de producción." })}</div>

        <section className="grid gap-5 lg:grid-cols-2">
          <ModelCard title={tr({ fi: "Champion", en: "Champion", es: "Champion" })} id={report.champion?.id} train={report.champion?.train || report.champion?.metrics} holdout={report.champion?.holdout || report.champion?.metrics} tr={tr} />
          <ModelCard title={tr({ fi: "Challenger", en: "Challenger", es: "Challenger" })} id={report.challenger?.id} train={report.challenger?.train || report.challenger?.metrics} holdout={report.challenger?.holdout || report.challenger?.metrics} tr={tr} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-black">{tr({ fi: "Lajikohtainen holdout", en: "Holdout by sport", es: "Holdout por deporte" })}</h2>
            <div className="mt-4 space-y-3">{sports.length === 0 && <div className="text-sm text-slate-400">{tr({ fi: "Lajikohtaisia havaintoja ei ole vielä riittävästi.", en: "There are not enough sport-level samples yet.", es: "Aún no hay suficientes muestras por deporte." })}</div>}{sports.map(([sportKey, item]) => <div key={sportKey} className="rounded-xl border border-white/10 bg-slate-950/60 p-4"><div className="font-black">{sportKey}</div><div className="mt-2 text-sm text-slate-300">Champion Brier {number(item.champion?.brierScore)} · Challenger {number(item.challenger?.brierScore)} · Δ {number(item.improvement?.brier)}</div></div>)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-black">{tr({ fi: "Turvaportit", en: "Safety gates", es: "Filtros de seguridad" })}</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-300"><div>✓ {tr({ fi: "Kronologinen jako", en: "Chronological split", es: "División cronológica" })}</div><div>✓ {tr({ fi: "Vain palvelimen varmentamat snapshotit", en: "Server-verified snapshots only", es: "Solo snapshots verificados por el servidor" })}</div><div>✓ {tr({ fi: "Tulevat tapahtumat rajataan pois", en: "Future events excluded", es: "Eventos futuros excluidos" })}</div><div>✓ {tr({ fi: "Ei automaattista promootiota", en: "No automatic promotion", es: "Sin promoción automática" })}</div><div>✓ {tr({ fi: "Ei oikean rahan toimintoa", en: "No real-money action", es: "Sin acciones con dinero real" })}</div></div>
            <div className="mt-4 text-xs text-slate-500">{payload.generatedAt ? new Date(payload.generatedAt).toLocaleString(locale) : ""}</div>
          </div>
        </section>
      </>}
    </div>
  );
}
