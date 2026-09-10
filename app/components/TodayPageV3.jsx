"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLanguage } from "./LanguageProvider";
import useRemoteJson from "./useRemoteJson";
import { requestErrorText } from "../../lib/client-request.mjs";

const QUICK_LEAGUES = [
  { label: "Kaikki", sport: "" },
  { label: "NBA", sport: "basketball_nba" },
  { label: "NHL", sport: "icehockey_nhl" },
  { label: "EPL", sport: "soccer_epl" },
  { label: "NFL", sport: "americanfootball_nfl" },
  { label: "UFC", sport: "mma_mixed_martial_arts" }
];

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPercent(value, digits = 1) {
  const parsed = finite(value);
  return parsed === null ? "–" : `${(parsed * 100).toFixed(digits)}%`;
}

function formatOdds(value) {
  const parsed = finite(value);
  return parsed === null ? "–" : parsed.toFixed(2);
}

function eventHref(item) {
  if (!item?.eventId && !item?.id) return "/events";
  const query = new URLSearchParams();
  if (item?.sportKey) query.set("sport", item.sportKey);
  if (item?.selection) query.set("selection", item.selection);
  const suffix = query.toString();
  return `/event/${encodeURIComponent(item.eventId || item.id)}${suffix ? `?${suffix}` : ""}`;
}

function statusTone(decision) {
  if (decision === "PLAY") return "border-emerald-400/30 bg-emerald-400/12 text-emerald-200";
  if (decision === "CAUTION") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  return "border-white/10 bg-white/[0.04] text-slate-400";
}

function Metric({ label, value, accent = "text-white", icon }) {
  return (
    <div className="min-w-0 rounded-[1.15rem] border border-white/[0.07] bg-white/[0.035] px-3 py-3 sm:px-4">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500"><span className="text-base" aria-hidden="true">{icon}</span><span className="truncate">{label}</span></div>
      <div className={`mt-1.5 truncate text-xl font-black tracking-[-0.04em] sm:text-2xl ${accent}`}>{value}</div>
    </div>
  );
}

function PickRow({ item, index, tr }) {
  if (!item) return null;
  const edge = finite(item.edge);
  return (
    <Link href={eventHref(item)} className="grid min-h-[68px] grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-[1rem] border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 transition hover:border-sky-400/30 hover:bg-sky-400/[0.04] sm:grid-cols-[36px_minmax(0,1fr)_auto_auto]">
      <div className="grid h-8 w-8 place-items-center rounded-[0.8rem] bg-white/[0.055] text-xs font-black text-slate-300">{index + 1}</div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-black text-white sm:text-sm">{item.match || item.selection || "–"}</div>
        <div className="mt-0.5 truncate text-[10px] text-slate-500">{item.selection || "–"}{item.odds ? ` · ${formatOdds(item.odds)}` : ""}</div>
      </div>
      <div className="hidden min-w-[58px] text-right sm:block">
        <div className="text-[9px] uppercase tracking-[0.12em] text-slate-600">edge</div>
        <div className="mt-0.5 text-xs font-black text-emerald-300">{edge === null ? "–" : formatPercent(edge)}</div>
      </div>
      <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${statusTone(item.decision)}`}>{item.decision || tr({ fi: "SEURAA", en: "WATCH", es: "SEGUIR" })}</span>
    </Link>
  );
}

function CompactPanel({ title, action, children, className = "" }) {
  return (
    <section className={`rounded-[1.35rem] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(12,19,30,.94),rgba(8,13,22,.96))] p-3.5 shadow-[0_16px_50px_rgba(0,0,0,.20)] sm:p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black tracking-[-0.02em] text-white sm:text-[15px]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function TodayPageV3() {
  const { tr } = useLanguage();
  const { data, loading, error: loadError, refresh } = useRemoteJson("/api/recommendations?limit=20", { refreshMs: 300000, timeoutMs: 60000 });
  const recommendations = useMemo(() => Array.isArray(data?.recommendations) ? data.recommendations : [], [data]);
  const plays = useMemo(() => recommendations.filter((item) => item?.decision === "PLAY"), [recommendations]);
  const nearPlay = useMemo(() => {
    const explicit = Array.isArray(data?.nearPlay) ? data.nearPlay : [];
    const source = explicit.length ? explicit : recommendations.filter((item) => item?.decision === "CAUTION");
    return source.filter((item, index, all) => all.findIndex((candidate) => candidate?.eventId === item?.eventId && candidate?.selection === item?.selection) === index);
  }, [data, recommendations]);
  const ranked = useMemo(() => {
    const all = [...plays, ...nearPlay, ...recommendations];
    return all.filter((item, index, values) => all.findIndex((candidate) => candidate?.eventId === item?.eventId && candidate?.selection === item?.selection) === index).slice(0, 3);
  }, [plays, nearPlay, recommendations]);
  const featured = plays[0] || nearPlay[0] || recommendations[0] || null;
  const analyzed = Number(data?.marketCandidateCount || data?.analyzedRecommendationCount || recommendations.length || 0);
  const bestEdge = recommendations.map((item) => finite(item?.edge)).filter((value) => value !== null).sort((a, b) => b - a)[0] ?? null;
  const confidences = recommendations.map((item) => finite(item?.confidence)).filter((value) => value !== null);
  const avgConfidence = confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null;
  const maxBooks = recommendations.map((item) => finite(item?.bookmakerCount)).filter((value) => value !== null).sort((a, b) => b - a)[0] ?? null;
  const modelProbability = finite(featured?.independentModelProbability);
  const marketProbability = finite(featured?.marketProbability ?? featured?.consensusProbability);
  const error = loadError ? requestErrorText(loadError, tr) : "";

  return (
    <div data-homepage-v3="mobile-first" className="space-y-3.5 sm:space-y-4">
      <style jsx global>{`
        @media (max-width: 639px) {
          .sc-shell-header > div { padding-left: 12px !important; padding-right: 12px !important; }
          .sc-shell-header > div > div { min-height: 58px !important; gap: 8px !important; }
          .sc-shell-header a[aria-label="Scorecaster"] { gap: 8px !important; }
          .sc-shell-header a[aria-label="Scorecaster"] > div:first-child { width: 38px !important; height: 38px !important; border-radius: 12px !important; }
          .sc-shell-header a[aria-label="Scorecaster"] > div:last-child > div:first-child { font-size: 1rem !important; }
          .sc-shell-header a[aria-label="Scorecaster"] > div:last-child > div:nth-child(2) { display: none !important; }
          .sc-shell-header .sc-icon-button { width: 38px !important; height: 38px !important; min-width: 38px !important; }
          .sc-shell-header select { min-height: 38px !important; padding: 0 9px !important; }
          main { padding-top: 12px !important; }
        }
      `}</style>

      <section className="relative overflow-hidden rounded-[1.45rem] border border-sky-400/15 bg-[radial-gradient(circle_at_82%_16%,rgba(14,165,233,.17),transparent_34%),linear-gradient(125deg,rgba(6,12,22,.99),rgba(7,18,31,.96))] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="pointer-events-none absolute -right-12 -top-20 hidden h-72 w-72 rounded-full border border-sky-300/10 bg-[radial-gradient(circle,rgba(52,180,255,.18),rgba(4,10,19,.04)_58%,transparent_70%)] lg:block" />
        <div className="relative max-w-[780px]">
          <div className="text-[9px] font-black uppercase tracking-[0.28em] text-slate-500">REAL DATA · PAPER ONLY</div>
          <h1 className="mt-2.5 max-w-3xl text-[clamp(2rem,8vw,4.25rem)] font-black leading-[.98] tracking-[-0.055em] text-white">
            {tr({ fi: "Dataa. ", en: "Data. ", es: "Datos. " })}<span className="bg-gradient-to-r from-sky-400 to-emerald-300 bg-clip-text text-transparent">{tr({ fi: "Analyysiä.", en: "Analysis.", es: "Análisis." })}</span><br />{tr({ fi: "Parempia päätöksiä.", en: "Better decisions.", es: "Mejores decisiones." })}
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-5 text-slate-400 sm:text-[15px] sm:leading-6">{tr({ fi: "Live-kertoimet, oma malli, markkinakonsensus ja turvaportit samassa näkymässä — ilman keksittyjä suorituslukuja.", en: "Live odds, own-model evidence, market consensus and safety gates in one view — without invented performance claims.", es: "Cuotas, modelo propio, consenso y filtros de seguridad en una sola vista — sin métricas inventadas." })}</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href="/events" className="inline-flex min-h-11 items-center justify-center rounded-[0.95rem] bg-gradient-to-r from-blue-500 to-sky-400 px-5 text-sm font-black text-white shadow-[0_12px_35px_rgba(14,165,233,.22)]">{tr({ fi: "Aloita analyysi →", en: "Start analysis →", es: "Empezar análisis →" })}</Link>
            <Link href="/feed" className="hidden min-h-11 items-center justify-center rounded-[0.95rem] border border-white/10 bg-white/[0.035] px-5 text-sm font-black text-slate-200 sm:inline-flex">AI Feed</Link>
          </div>
        </div>
      </section>

      <section aria-label={tr({ fi: "Päivän yhteenveto", en: "Daily summary", es: "Resumen diario" })} className="grid grid-cols-3 gap-2 sm:gap-3">
        <Metric label={tr({ fi: "Analysoitu", en: "Analyzed", es: "Analizado" })} value={loading ? "…" : error ? "–" : analyzed.toLocaleString("fi-FI")} accent="text-sky-300" icon="▥" />
        <Metric label="PLAY nyt" value={loading ? "…" : plays.length} accent="text-white" icon="▣" />
        <Metric label={tr({ fi: "Paras edge", en: "Best edge", es: "Mejor edge" })} value={loading ? "…" : formatPercent(bestEdge)} accent="text-emerald-300" icon="ϟ" />
      </section>

      <nav aria-label={tr({ fi: "Liigat", en: "Leagues", es: "Ligas" })} className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_LEAGUES.map((league, index) => (
          <Link key={league.label} href={league.sport ? `/events?sport=${encodeURIComponent(league.sport)}` : "/events"} className={`shrink-0 rounded-full border px-3.5 py-2 text-[11px] font-black ${index === 0 ? "border-sky-400/45 bg-sky-400/10 text-sky-200" : "border-white/[0.08] bg-white/[0.025] text-slate-400"}`}>{league.label}</Link>
        ))}
      </nav>

      {error ? <div role="alert" className="flex items-center justify-between gap-3 rounded-[1rem] border border-red-400/20 bg-red-400/[0.06] px-3.5 py-3 text-xs text-red-100"><span>{error}</span><button type="button" onClick={refresh} className="shrink-0 font-black underline">{tr({ fi: "Yritä uudelleen", en: "Retry", es: "Reintentar" })}</button></div> : null}
      {data?.partialUpstream ? <div role="status" className="rounded-[1rem] border border-amber-400/20 bg-amber-400/[0.055] px-3.5 py-3 text-xs leading-5 text-amber-100/80">{tr({ fi: "Osa markkinoista ei vastannut. Näytetään vain varmennettu data.", en: "Some markets did not respond. Only verified data is shown.", es: "Algunos mercados no respondieron. Solo se muestran datos verificados." })}</div> : null}

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(240px,.78fr)_minmax(390px,1.32fr)_minmax(250px,.82fr)] lg:gap-4">
        <div className="space-y-3.5">
          <CompactPanel title={<span><span className="mr-2 text-emerald-300">★</span>Top AI Picks</span>} action={<Link href="/feed" className="text-[10px] font-black text-sky-300">{tr({ fi: "Näytä kaikki →", en: "View all →", es: "Ver todo →" })}</Link>}>
            <div className="space-y-2">{loading ? [0,1,2].map((key) => <div key={key} className="h-[68px] animate-pulse rounded-[1rem] bg-white/[0.035]" />) : ranked.length ? ranked.map((item, index) => <PickRow key={`${item?.eventId || item?.id}-${item?.selection}-${index}`} item={item} index={index} tr={tr} />) : <div className="rounded-[1rem] border border-white/[0.06] bg-white/[0.025] p-4 text-xs leading-5 text-slate-500">{tr({ fi: "Ei varmennettuja nostoja juuri nyt.", en: "No verified picks right now.", es: "No hay selecciones verificadas ahora." })}</div>}</div>
          </CompactPanel>

          <CompactPanel title={tr({ fi: "Market Insights", en: "Market Insights", es: "Market Insights" })} className="hidden lg:block">
            <div className="grid gap-2 text-xs">
              <Link href="/market-timeline" className="flex items-center justify-between rounded-xl bg-white/[0.025] px-3 py-2.5 text-slate-300"><span><strong className="block text-white">Line Movement</strong><span className="text-[10px] text-slate-600">{tr({ fi: "Todennettu hintahistoria", en: "Verified price history", es: "Historial verificado" })}</span></span><span>→</span></Link>
              <Link href="/risk" className="flex items-center justify-between rounded-xl bg-white/[0.025] px-3 py-2.5 text-slate-300"><span><strong className="block text-white">Bankroll Insight</strong><span className="text-[10px] text-slate-600">{tr({ fi: "Paper-riskinhallinta", en: "Paper risk control", es: "Control de riesgo simulado" })}</span></span><span>→</span></Link>
            </div>
          </CompactPanel>
        </div>

        <CompactPanel title={<span className="flex items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${statusTone(featured?.decision)}`}>{featured?.decision || "WAIT"}</span>{tr({ fi: "Match Hub", en: "Match Hub", es: "Match Hub" })}</span>} action={featured ? <Link href={eventHref(featured)} className="text-[10px] font-black text-sky-300">{tr({ fi: "Avaa analyysi →", en: "Open analysis →", es: "Abrir análisis →" })}</Link> : null}>
          {featured ? (
            <div>
              <div className="border-b border-white/[0.06] pb-3">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-600">{featured?.sportKey ? featured.sportKey.replaceAll("_", " ") : tr({ fi: "Varmennettu kohde", en: "Verified event", es: "Evento verificado" })}</div>
                <div className="mt-2 text-lg font-black tracking-[-0.035em] text-white sm:text-xl">{featured.match || "–"}</div>
                <div className="mt-1 text-xs text-slate-500">{featured.selection || "–"}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 py-3">
                <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.055] px-3 py-2.5 text-center"><div className="text-[9px] uppercase tracking-[0.12em] text-sky-300">{tr({ fi: "Valinta", en: "Pick", es: "Selección" })}</div><div className="mt-1 truncate text-xs font-black text-white">{featured.selection || "–"}</div></div>
                <div className="rounded-xl bg-white/[0.025] px-3 py-2.5 text-center"><div className="text-[9px] uppercase tracking-[0.12em] text-slate-600">{tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })}</div><div className="mt-1 text-sm font-black text-white">{formatOdds(featured.odds)}</div></div>
                <div className="rounded-xl bg-white/[0.025] px-3 py-2.5 text-center"><div className="text-[9px] uppercase tracking-[0.12em] text-slate-600">edge</div><div className="mt-1 text-sm font-black text-emerald-300">{formatPercent(featured.edge)}</div></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="flex items-center justify-between text-[10px] text-slate-500"><span>{tr({ fi: "Oma malli", en: "Own model", es: "Modelo propio" })}</span><strong className="text-white">{formatPercent(modelProbability)}</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300" style={{ width: `${Math.max(0, Math.min(100, (modelProbability || 0) * 100))}%` }} /></div></div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="flex items-center justify-between text-[10px] text-slate-500"><span>{tr({ fi: "Markkina", en: "Market", es: "Mercado" })}</span><strong className="text-white">{formatPercent(marketProbability)}</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-300" style={{ width: `${Math.max(0, Math.min(100, (marketProbability || 0) * 100))}%` }} /></div></div>
              </div>
              <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs leading-5 text-slate-400"><span className="font-black text-sky-300">AI</span> · {modelProbability === null ? tr({ fi: "Oman mallin riippumaton arvio puuttuu tältä valinnalta. Seuraa — älä pelaa vielä.", en: "Independent own-model evidence is missing for this selection. Watch — do not play yet.", es: "Falta evidencia independiente del modelo. Seguir — no jugar todavía." }) : featured?.decision === "PLAY" ? tr({ fi: "Kaikki nykyiset PLAY-portit läpäisty. Ei takaa lopputulosta.", en: "All current PLAY gates passed. Outcome is not guaranteed.", es: "Se superaron los filtros PLAY. No garantiza el resultado." }) : tr({ fi: "Kohde ei ole vielä PLAY. Tarkista puuttuva evidence ennen paperipäätöstä.", en: "This is not PLAY yet. Review missing evidence before a paper decision.", es: "Aún no es PLAY. Revisa la evidencia faltante." })}</div>
            </div>
          ) : <div className="grid min-h-[190px] place-items-center text-center"><div><div className="text-lg font-black text-white">{tr({ fi: "Ei PLAY-kohteita juuri nyt", en: "No PLAY selections right now", es: "No hay selecciones PLAY ahora" })}</div><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">{tr({ fi: "Scorecaster ei täytä etusivua tekaistuilla suosituksilla.", en: "Scorecaster does not fill the homepage with fabricated picks.", es: "Scorecaster no llena la portada con selecciones inventadas." })}</p></div></div>}
        </CompactPanel>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-1">
          <CompactPanel title={<span className="flex items-center gap-2"><span className="text-sky-300">▣</span>{tr({ fi: "Paper Slip", en: "Paper Slip", es: "Paper Slip" })}</span>} action={<span className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-1 text-[8px] font-black text-emerald-200">PAPER ONLY</span>}>
            <p className="text-xs leading-5 text-slate-500">{tr({ fi: "Seuraa valintoja ja settlementtejä ilman oikeaa rahaa.", en: "Track picks and settlements without real money.", es: "Sigue selecciones y resultados sin dinero real." })}</p>
            {featured ? <div className="mt-3 rounded-xl bg-white/[0.025] px-3 py-2.5"><div className="truncate text-xs font-black text-white">{featured.match || "–"}</div><div className="mt-1 truncate text-[10px] text-slate-500">{featured.selection || "–"} · {formatOdds(featured.odds)}</div></div> : null}
            <Link href="/tracking" className="mt-3 flex min-h-10 items-center justify-center rounded-xl border border-sky-400/25 bg-sky-400/[0.07] px-4 text-xs font-black text-sky-200">{tr({ fi: "Avaa paperiseuranta →", en: "Open paper tracking →", es: "Abrir seguimiento →" })}</Link>
            <div className="mt-2 text-center text-[9px] text-slate-700">{tr({ fi: "Ei vedonvälittäjä. Ei lähetä vetoa eikä siirrä rahaa.", en: "Not a bookmaker. Does not place bets or move money.", es: "No es una casa de apuestas. No ejecuta apuestas ni mueve dinero." })}</div>
          </CompactPanel>

          <CompactPanel title={tr({ fi: "Intelligence Edge", en: "Intelligence Edge", es: "Intelligence Edge" })}>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/[0.025] p-2.5"><div className="text-base font-black text-emerald-300">{formatPercent(bestEdge)}</div><div className="mt-1 text-[8px] uppercase tracking-[0.1em] text-slate-600">best edge</div></div>
              <div className="rounded-xl bg-white/[0.025] p-2.5"><div className="text-base font-black text-sky-300">{formatPercent(avgConfidence, 0)}</div><div className="mt-1 text-[8px] uppercase tracking-[0.1em] text-slate-600">avg data</div></div>
              <div className="rounded-xl bg-white/[0.025] p-2.5"><div className="text-base font-black text-white">{maxBooks ?? "–"}</div><div className="mt-1 text-[8px] uppercase tracking-[0.1em] text-slate-600">books max</div></div>
            </div>
            <p className="mt-3 text-[10px] leading-4 text-slate-600">{tr({ fi: "Nämä ovat nykyisen datan mittareita, eivät toteutunutta ROI:ta tai luvattua voittoprosenttia.", en: "These are current-data metrics, not realized ROI or a promised win rate.", es: "Son métricas de datos actuales, no ROI realizado ni tasa de acierto prometida." })}</p>
          </CompactPanel>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Link href="/events" className="rounded-[1rem] border border-white/[0.07] bg-white/[0.025] px-3.5 py-3 text-xs font-black text-slate-300">{tr({ fi: "Kaikki ottelut →", en: "All matches →", es: "Todos los partidos →" })}</Link>
        <Link href="/tracking" className="rounded-[1rem] border border-white/[0.07] bg-white/[0.025] px-3.5 py-3 text-xs font-black text-slate-300">{tr({ fi: "Oma seuranta →", en: "My tracking →", es: "Mi seguimiento →" })}</Link>
        <Link href="/model-lab#validation-lab" className="col-span-2 rounded-[1rem] border border-white/[0.07] bg-white/[0.025] px-3.5 py-3 text-xs font-black text-slate-300 sm:col-span-1">Validation Lab →</Link>
      </section>
    </div>
  );
}
