"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "./LanguageProvider";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function number(value, digits = 2) {
  const parsed = finite(value);
  return parsed === null ? "–" : parsed.toFixed(digits);
}

function percent(value, digits = 1) {
  const parsed = finite(value);
  return parsed === null ? "–" : `${(parsed * 100).toFixed(digits)} %`;
}

function marketLabel(marketKey, tr) {
  const key = String(marketKey || "h2h").toLowerCase();
  if (key === "spreads") return tr({ fi: "Tasoitus", en: "Spread", es: "Hándicap" });
  if (key === "totals") return tr({ fi: "Maalit / pisteet", en: "Total", es: "Total" });
  return tr({ fi: "Voittaja", en: "Winner", es: "Ganador" });
}

function recommendationHref(item) {
  const query = new URLSearchParams();
  if (item.sportKey) query.set("sport", item.sportKey);
  if (item.selection) query.set("selection", item.selection);
  const suffix = query.toString();
  return `/event/${encodeURIComponent(item.eventId || item.id)}${suffix ? `?${suffix}` : ""}`;
}

function gateText(item, tr) {
  const gate = item?.nextGate || {};
  const code = gate.code;
  if (code === "fresh-data") return tr({ fi: "odotetaan tuoreempaa markkinadataa", en: "waiting for fresher market data", es: "esperando datos de mercado más recientes" });
  if (code === "bookmaker-coverage") return tr({ fi: `tarvitaan lisää vedonvälittäjiä (${gate.current ?? 0}/${gate.target ?? 4})`, en: `more bookmaker coverage is needed (${gate.current ?? 0}/${gate.target ?? 4})`, es: `se necesita más cobertura de casas (${gate.current ?? 0}/${gate.target ?? 4})` });
  if (code === "confidence") return tr({ fi: "datan varmuus ei vielä riitä", en: "data confidence is not high enough yet", es: "la confianza de datos aún no es suficiente" });
  if (code === "edge") return tr({ fi: `edge ei vielä ylitä 2 % rajaa (${percent(gate.current)})`, en: `edge has not yet cleared 2% (${percent(gate.current)})`, es: `la ventaja aún no supera 2% (${percent(gate.current)})` });
  if (code === "ev") return tr({ fi: `EV ei vielä ylitä 3 % rajaa (${percent(gate.current)})`, en: `EV has not yet cleared 3% (${percent(gate.current)})`, es: `el EV aún no supera 3% (${percent(gate.current)})` });
  if (code === "verified-evidence") return tr({ fi: "riippumaton evidence ei ole vielä varmennettu", en: "independent evidence is not verified yet", es: "la evidencia independiente aún no está verificada" });
  return tr({ fi: "turvaportin viimeinen tarkistus puuttuu", en: "the final safety recheck is still pending", es: "falta la última revisión de seguridad" });
}

function PlayCard({ item, tr, onWatch, watchState }) {
  const stake = finite(item.suggestedStake);
  const state = watchState[item.eventId]?.state;
  return (
    <article className="overflow-hidden rounded-[2rem] border border-emerald-400/35 bg-emerald-500/10 shadow-2xl">
      <div className="border-b border-emerald-400/20 bg-emerald-400/10 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">● PLAY</div>
          <div className="text-xs font-bold text-[var(--sc-muted)]">{item.sportTitle || item.league || item.sportKey}</div>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <h2 className="text-2xl font-black tracking-[-0.03em] text-[var(--sc-text)]">{item.match}</h2>
        <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-[var(--sc-surface)]/70 p-5">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-muted)]">{tr({ fi: "Pelaa näin", en: "How to play it", es: "Cómo jugar" })}</div>
          <div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{item.selection || "–"}</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-[var(--sc-text-secondary)]">
            <span>{marketLabel(item.marketKey, tr)}</span>
            <span>@ {number(item.odds)}</span>
            {item.bookmaker ? <span>{item.bookmaker}</span> : null}
          </div>
          <div className="mt-4 rounded-xl bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
            {tr({ fi: "Yksittäinen paperiveto", en: "Single paper bet", es: "Apuesta simulada simple" })}
            {stake !== null ? ` · ${tr({ fi: "paperipanos", en: "paper stake", es: "stake simulado" })} ${number(stake, 1)} / 1000` : ""}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">Edge</div><div className="mt-1 text-xl font-black text-emerald-300">{percent(item.edge)}</div></div>
          <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">EV</div><div className="mt-1 text-xl font-black text-emerald-300">{percent(item.ev)}</div></div>
          <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">{tr({ fi: "Oma malli", en: "Own model", es: "Modelo propio" })}</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">{percent(item.independentModelProbability)}</div></div>
          <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">{tr({ fi: "Markkina", en: "Market", es: "Mercado" })}</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">{percent(item.marketProbability)}</div></div>
        </div>

        <div className="mt-5 flex gap-2">
          <Link href={recommendationHref(item)} className="flex-1 rounded-xl bg-[var(--sc-brand)] px-4 py-3 text-center text-sm font-black text-[var(--sc-brand-ink)]">{tr({ fi: "Avaa perustelut", en: "Open reasoning", es: "Abrir análisis" })}</Link>
          <button type="button" onClick={() => onWatch(item)} disabled={state === "saving" || state === "saved"} className="rounded-xl border border-[var(--sc-border)] px-4 py-3 text-sm font-black text-[var(--sc-text)] disabled:opacity-50">{state === "saved" ? "✓" : state === "saving" ? "…" : tr({ fi: "Seuraa", en: "Watch", es: "Seguir" })}</button>
        </div>
      </div>
    </article>
  );
}

export default function TodayPageClient() {
  const { tr, locale } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [watchState, setWatchState] = useState({});

  async function load({ silent = false } = {}) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/recommendations?limit=20", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || "Recommendations unavailable");
      setData(payload);
    } catch (cause) {
      setError(cause?.message || "Recommendations unavailable");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => load({ silent: true }), 300000);
    return () => window.clearInterval(timer);
  }, []);

  const recommendations = useMemo(() => Array.isArray(data?.recommendations) ? data.recommendations : [], [data]);
  const plays = useMemo(() => recommendations.filter((item) => item.decision === "PLAY"), [recommendations]);
  const nearPlay = useMemo(() => {
    const explicit = Array.isArray(data?.nearPlay) ? data.nearPlay : [];
    const source = explicit.length ? explicit : recommendations.filter((item) => item.decision === "CAUTION");
    return source.filter((item, index, all) => all.findIndex((candidate) => candidate.eventId === item.eventId && candidate.selection === item.selection) === index).slice(0, 5);
  }, [data, recommendations]);
  const leagues = Array.isArray(data?.leagues) ? data.leagues : [];
  const updated = data?.generatedAt ? new Date(data.generatedAt).toLocaleString(locale) : "–";

  async function addToWatchlist(item) {
    if (!item?.eventId || !item?.selection || !item?.sportKey) return;
    setWatchState((current) => ({ ...current, [item.eventId]: { state: "saving" } }));
    try {
      const response = await fetch("/api/cloud/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: item.eventId, selection: item.selection, sport: item.sportKey })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Watchlist save failed");
      setWatchState((current) => ({ ...current, [item.eventId]: { state: "saved" } }));
    } catch (cause) {
      setWatchState((current) => ({ ...current, [item.eventId]: { state: "error", message: cause?.message || "Watchlist save failed" } }));
    }
  }

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[2rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-6 shadow-2xl sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-[var(--sc-brand)]">{tr({ fi: "Scorecaster tänään", en: "Scorecaster today", es: "Scorecaster hoy" })}</div>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-[var(--sc-text)] sm:text-5xl">{tr({ fi: "Mitä pelata nyt?", en: "What to play now?", es: "¿Qué jugar ahora?" })}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--sc-muted)] sm:text-base">{tr({ fi: "PLAY-kohteet näytetään aina ensin kaikista aktiivisista tuetuista lajeista. Jos yhtään kohdetta ei läpäise portteja, Scorecaster sanoo sen suoraan eikä muuta CAUTION-kohdetta pelisuositukseksi.", en: "PLAY picks are always shown first across active supported sports. If none pass the gates, Scorecaster says so instead of presenting CAUTION as a bet recommendation.", es: "Los PLAY aparecen primero entre los deportes activos compatibles. Si ninguno pasa los filtros, Scorecaster lo indica sin convertir CAUTION en recomendación." })}</p>
          </div>
          <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)]/70 px-5 py-4 text-right">
            <div className="text-3xl font-black text-[var(--sc-text)]">{loading ? "…" : plays.length}</div>
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--sc-muted)]">PLAY</div>
            <button type="button" onClick={() => load()} className="mt-2 text-xs font-black text-[var(--sc-brand)]">{tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-[var(--sc-muted)]">
          <span>{tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" })}: {updated}</span>
          <span>·</span>
          <span>{tr({ fi: "Aktiivisia liigahakuja", en: "Active league searches", es: "Ligas activas consultadas" })}: {leagues.length || "–"}</span>
          <span>·</span>
          <span>{tr({ fi: "vain paperianalyysi", en: "paper analysis only", es: "solo análisis simulado" })}</span>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-100">{error}</div> : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">{[1, 2].map((item) => <div key={item} className="h-96 animate-pulse rounded-[2rem] border border-[var(--sc-border)] bg-[var(--sc-surface)]" />)}</div>
      ) : plays.length ? (
        <section>
          <div className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-emerald-300">{tr({ fi: "Pelaa nämä ensin", en: "Play these first", es: "Juega estos primero" })}</div>
          <div className="grid gap-5 lg:grid-cols-2">{plays.map((item) => <PlayCard key={`${item.eventId}-${item.selection}-${item.marketKey}`} item={item} tr={tr} onWatch={addToWatchlist} watchState={watchState} />)}</div>
        </section>
      ) : (
        <section className="rounded-[2rem] border border-amber-400/30 bg-amber-500/10 p-6 sm:p-8">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">WAIT</div>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--sc-text)]">{tr({ fi: "Ei varmennettua PLAY-kohdetta juuri nyt", en: "No verified PLAY pick right now", es: "No hay PLAY verificado ahora" })}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--sc-muted)]">{tr({ fi: "Älä pelaa CAUTION-kohteita pelkän markkinaedgen perusteella. Alla näkyvät vain lähimpänä PLAYta olevat seurattavat ehdokkaat ja täsmälleen se ehto, joka vielä puuttuu.", en: "Do not play CAUTION picks from market edge alone. Below are only the candidates closest to PLAY and the exact gate still missing.", es: "No juegues CAUTION solo por ventaja de mercado. Abajo se muestran los candidatos más cercanos a PLAY y el filtro que falta." })}</p>
        </section>
      )}

      {!loading && nearPlay.length ? (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">{tr({ fi: "Lähimpänä PLAYta", en: "Closest to PLAY", es: "Más cerca de PLAY" })}</div>
              <h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Seuraa – älä pelaa vielä", en: "Watch – do not play yet", es: "Sigue – todavía no juegues" })}</h2>
            </div>
            <Link href="/feed" className="text-sm font-black text-[var(--sc-brand)]">{tr({ fi: "Kaikki analyysit", en: "All analysis", es: "Todos los análisis" })}</Link>
          </div>
          <div className="space-y-3">
            {nearPlay.map((item) => (
              <article key={`${item.eventId}-${item.selection}-${item.marketKey}`} className="rounded-3xl border border-amber-400/20 bg-[var(--sc-surface)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="text-xs font-bold text-[var(--sc-muted)]">{item.sportTitle || item.league || item.sportKey}</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">{item.match}</div></div>
                  <div className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black text-amber-100">WAIT</div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
                  <div><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">{tr({ fi: "Seurattava ehdokas – ei pelisuositus", en: "Candidate to watch – not a bet recommendation", es: "Candidato a seguir – no recomendación" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{item.selection || "–"} @ {number(item.odds)}</div></div>
                  <div><div className="text-[10px] text-[var(--sc-faint)]">Edge</div><div className="font-black text-[var(--sc-text)]">{percent(item.edge)}</div></div>
                  <div><div className="text-[10px] text-[var(--sc-faint)]">EV</div><div className="font-black text-[var(--sc-text)]">{percent(item.ev)}</div></div>
                  <Link href={recommendationHref(item)} className="rounded-xl border border-[var(--sc-border)] px-4 py-3 text-center text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Avaa", en: "Open", es: "Abrir" })}</Link>
                </div>
                <div className="mt-4 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100"><span className="font-black">{tr({ fi: "Puuttuu:", en: "Still missing:", es: "Falta:" })}</span> {gateText(item, tr)}</div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <Link href="/events" className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><div className="font-black text-[var(--sc-text)]">{tr({ fi: "Kaikki ottelut", en: "All matches", es: "Todos los partidos" })}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "Selaa lajeittain", en: "Browse by sport", es: "Explorar por deporte" })}</div></Link>
        <Link href="/feed" className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><div className="font-black text-[var(--sc-text)]">AI Feed</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "WAIT, CAUTION ja perustelut", en: "WAIT, CAUTION and reasoning", es: "WAIT, CAUTION y motivos" })}</div></Link>
        <Link href="/data-layer" className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><div className="font-black text-[var(--sc-text)]">{tr({ fi: "Data & audit", en: "Data & audit", es: "Datos y auditoría" })}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "Providerit ja tekninen diagnostiikka", en: "Providers and technical diagnostics", es: "Proveedores y diagnóstico técnico" })}</div></Link>
      </section>

      <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-xs leading-6 text-[var(--sc-muted)]">{tr({ fi: "Scorecaster ei aseta oikeita vetoja. PLAY tarkoittaa, että kohde läpäisi nykyiset markkina-, mallievidence- ja turvaportit paperianalyysissä; se ei takaa lopputulosta.", en: "Scorecaster does not place real bets. PLAY means the current market, model-evidence and safety gates passed in paper analysis; it does not guarantee an outcome.", es: "Scorecaster no realiza apuestas reales. PLAY significa que los filtros actuales se superaron en análisis simulado; no garantiza el resultado." })}</div>
    </div>
  );
}
