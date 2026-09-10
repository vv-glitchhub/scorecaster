"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import useRemoteJson from "./useRemoteJson";
import { fetchJson, requestErrorText } from "../../lib/client-request.mjs";
import { loginHref } from "../../lib/auth-navigation.mjs";

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

function recommendationHref(item) {
  const query = new URLSearchParams();
  if (item.sportKey) query.set("sport", item.sportKey);
  if (item.selection) query.set("selection", item.selection);
  const suffix = query.toString();
  return `/event/${encodeURIComponent(item.eventId || item.id)}${suffix ? `?${suffix}` : ""}`;
}

function watchKey(item) {
  return [item.eventId, item.marketKey, item.selection].join(":");
}

function marketLabel(marketKey, tr) {
  const key = String(marketKey || "h2h").toLowerCase();
  if (key === "spreads") return tr({ fi: "Tasoitus", en: "Spread", es: "Hándicap" });
  if (key === "totals") return tr({ fi: "Maalit / pisteet", en: "Total", es: "Total" });
  return tr({ fi: "Voittaja", en: "Winner", es: "Ganador" });
}

function leagueLabel(value) {
  const key = String(value || "").toLowerCase();
  const labels = {
    basketball_nba: "NBA",
    basketball_wnba: "WNBA",
    icehockey_nhl: "NHL",
    icehockey_sweden_hockey_league: "SHL",
    soccer_epl: "EPL",
    soccer_spain_la_liga: "La Liga",
    soccer_italy_serie_a: "Serie A",
    soccer_germany_bundesliga: "Bundesliga",
    soccer_france_ligue_one: "Ligue 1",
    soccer_finland_veikkausliiga: "Veikkausliiga",
    soccer_usa_mls: "MLS",
    americanfootball_nfl: "NFL",
    baseball_mlb: "MLB"
  };
  return labels[key] || String(value || "Sport").replaceAll("_", " ");
}

function decisionTone(decision) {
  if (decision === "PLAY") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (decision === "CAUTION") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-white/10 bg-white/5 text-[var(--sc-muted)]";
}

function gateText(item, tr) {
  const gate = item?.nextGate || {};
  const code = gate.code;
  if (code === "fresh-data") return tr({ fi: "odotetaan tuoreempaa markkinadataa", en: "waiting for fresher market data", es: "esperando datos de mercado más recientes" });
  if (code === "bookmaker-coverage") return tr({ fi: `tarvitaan lisää vedonvälittäjiä (${gate.current ?? 0}/${gate.target ?? 4})`, en: `more bookmaker coverage is needed (${gate.current ?? 0}/${gate.target ?? 4})`, es: `se necesita más cobertura de casas (${gate.current ?? 0}/${gate.target ?? 4})` });
  if (code === "confidence") return tr({ fi: `datan varmuus ei vielä riitä (${percent(gate.current)})`, en: `data confidence is not high enough yet (${percent(gate.current)})`, es: `la confianza de datos aún no es suficiente (${percent(gate.current)})` });
  if (code === "edge") return tr({ fi: `edge ei vielä ylitä 2 % rajaa (${percent(gate.current)})`, en: `edge has not yet cleared 2% (${percent(gate.current)})`, es: `la ventaja aún no supera 2% (${percent(gate.current)})` });
  if (code === "ev") return tr({ fi: `EV ei vielä ylitä 3 % rajaa (${percent(gate.current)})`, en: `EV has not yet cleared 3% (${percent(gate.current)})`, es: `el EV aún no supera 3% (${percent(gate.current)})` });
  if (code === "verified-evidence") return tr({ fi: "riippumaton evidence ei ole vielä varmennettu", en: "independent evidence is not verified yet", es: "la evidencia independiente aún no está verificada" });
  return tr({ fi: "turvaportin viimeinen tarkistus puuttuu", en: "the final safety recheck is still pending", es: "falta la última revisión de seguridad" });
}

function ownedModelText(item, tr) {
  if (item?.ownedModelStrongConflict) return tr({ fi: "Oma malli vastustaa valintaa", en: "Own model strongly disagrees", es: "El modelo propio discrepa" });
  if (item?.ownedModelQualified && item?.ownedModelSupportsSelection) return tr({ fi: "Oma malli tukee valintaa", en: "Own model supports the selection", es: "El modelo propio apoya la selección" });
  if (item?.ownedModelAvailable) return tr({ fi: "Oma malli saatavilla, evidence ei vielä riitä PLAYhin", en: "Own model available; evidence is not yet enough for PLAY", es: "Modelo disponible; la evidencia aún no basta" });
  if (item?.ownedModelMarketMapped) return tr({ fi: "Ottelu on yhdistetty omaan malliin", en: "Event is mapped to the own model", es: "Evento vinculado al modelo propio" });
  return tr({ fi: "Oman mallin arvio puuttuu tältä valinnalta", en: "Own-model estimate is not available for this selection", es: "No hay estimación propia para esta selección" });
}

function VisualPulse() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-[230px] w-full max-w-[470px] sm:h-[300px] lg:h-[360px]">
      <div className="absolute inset-0 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="absolute left-[18%] top-[8%] h-[72%] w-[60%] rounded-[46%] border border-sky-300/20 bg-[radial-gradient(circle_at_55%_28%,rgba(90,190,255,.32),rgba(8,23,44,.45)_35%,rgba(3,8,18,.85)_72%)] shadow-[0_0_80px_rgba(56,189,248,.16)]" />
      <div className="absolute left-[26%] top-[21%] h-[34%] w-[43%] rounded-[50%] border-2 border-sky-200/30" />
      <div className="absolute left-[48%] top-[44%] h-[18%] w-[30%] skew-x-[-14deg] rounded-r-[2rem] border-y-2 border-r-2 border-sky-300/30" />
      <div className="absolute bottom-[15%] left-[16%] right-[7%] h-px bg-gradient-to-r from-transparent via-sky-300/50 to-transparent" />
      <div className="absolute bottom-[9%] left-[21%] right-[13%] flex items-end gap-1.5 opacity-80">
        {[28, 44, 35, 62, 49, 72, 54, 83, 66, 92, 78, 98].map((height, index) => (
          <span key={index} className="flex-1 rounded-t-full bg-gradient-to-t from-sky-500/30 to-[var(--sc-brand)]/70" style={{ height: `${height * 0.55}px` }} />
        ))}
      </div>
      <div className="absolute right-[3%] top-[30%] text-[10px] font-black uppercase tracking-[0.32em] text-sky-100/55">
        <div>INSIGHTS</div><div className="mt-2">MOVE</div><div className="mt-2">THE GAME</div><div className="mt-2">FORWARD.</div>
        <div className="mt-4 h-px w-8 bg-[var(--sc-brand)]" />
      </div>
    </div>
  );
}

function EmptyPick({ tr }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-sm text-[var(--sc-muted)]">
      {tr({ fi: "Ei varmennettua kohdetta tähän näkymään juuri nyt.", en: "No verified selection is available for this slot right now.", es: "No hay una selección verificada para este espacio ahora." })}
    </div>
  );
}

function PickRow({ item, index, tr, onWatch, watchState }) {
  if (!item) return <EmptyPick tr={tr} />;
  const saved = watchState[watchKey(item)];
  return (
    <article className="group rounded-2xl border border-[var(--sc-border)] bg-white/[0.025] p-3.5 transition hover:border-sky-400/35 hover:bg-sky-400/[0.04]">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-sm font-black text-[var(--sc-text)]">{index + 1}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-black text-[var(--sc-text)]">{item.match || item.selection || "–"}</div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black ${decisionTone(item.decision)}`}>{item.decision || "WAIT"}</span>
          </div>
          <div className="mt-1 truncate text-[11px] text-[var(--sc-muted)]">{item.selection || "–"} · {marketLabel(item.marketKey, tr)}{item.odds ? ` @ ${number(item.odds)}` : ""}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-black text-[var(--sc-brand)]">{percent(item.confidence, 0)}</div>
          <div className="text-[9px] uppercase tracking-[0.12em] text-[var(--sc-faint)]">data</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-2.5">
        <Link href={recommendationHref(item)} className="text-[11px] font-black text-sky-300">{tr({ fi: "Avaa analyysi →", en: "Open analysis →", es: "Abrir análisis →" })}</Link>
        <button type="button" disabled={saved?.state === "saving" || saved?.state === "saved"} onClick={() => onWatch(item)} className="text-[11px] font-black text-[var(--sc-muted)] disabled:opacity-50">{saved?.state === "saved" ? "✓" : saved?.state === "saving" ? "…" : tr({ fi: "Seuraa", en: "Watch", es: "Seguir" })}</button>
      </div>
    </article>
  );
}

function ProbabilityRail({ label, value, tone = "sky" }) {
  const parsed = finite(value);
  const width = parsed === null ? 0 : Math.max(0, Math.min(100, parsed * 100));
  const bar = tone === "green" ? "from-emerald-400 to-[var(--sc-brand)]" : "from-blue-500 to-sky-300";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]"><span className="text-[var(--sc-muted)]">{label}</span><span className="font-black text-[var(--sc-text)]">{percent(parsed)}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full rounded-full bg-gradient-to-r ${bar}`} style={{ width: `${width}%` }} /></div>
    </div>
  );
}

export default function TodayPageClient() {
  const { tr, locale } = useLanguage();
  const { data, loading, error: loadError, refresh: load } = useRemoteJson("/api/recommendations?limit=20", { refreshMs: 300000, timeoutMs: 60000 });
  const error = loadError ? requestErrorText(loadError, tr) : "";
  const [watchState, setWatchState] = useState({});

  const recommendations = useMemo(() => Array.isArray(data?.recommendations) ? data.recommendations : [], [data]);
  const plays = useMemo(() => recommendations.filter((item) => item.decision === "PLAY"), [recommendations]);
  const nearPlay = useMemo(() => {
    const explicit = Array.isArray(data?.nearPlay) ? data.nearPlay : [];
    const source = explicit.length ? explicit : recommendations.filter((item) => item.decision === "CAUTION" && item?.intelligenceV2?.nearPlay === true);
    return source.filter((item, index, all) => all.findIndex((candidate) => candidate.eventId === item.eventId && candidate.selection === item.selection) === index).slice(0, 5);
  }, [data, recommendations]);
  const ranked = useMemo(() => {
    const source = [...plays, ...nearPlay, ...recommendations];
    return source.filter((item, index, all) => all.findIndex((candidate) => candidate.eventId === item.eventId && candidate.selection === item.selection) === index).slice(0, 3);
  }, [plays, nearPlay, recommendations]);
  const spotlight = plays[0] || nearPlay[0] || recommendations[0] || null;
  const leagues = Array.isArray(data?.leagues) ? data.leagues : [];
  const analyzed = Number(data?.marketCandidateCount || data?.analyzedRecommendationCount || recommendations.length || 0);
  const closeCount = Number(data?.counts?.NEAR_PLAY ?? nearPlay.length);
  const updated = data?.generatedAt ? new Date(data.generatedAt).toLocaleString(locale) : "–";
  const bestEdge = recommendations.map((item) => finite(item.edge)).filter((value) => value !== null).sort((a, b) => b - a)[0] ?? null;
  const confidenceValues = recommendations.map((item) => finite(item.confidence)).filter((value) => value !== null);
  const averageConfidence = confidenceValues.length ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length : null;
  const maxBookmakers = recommendations.map((item) => finite(item.bookmakerCount)).filter((value) => value !== null).sort((a, b) => b - a)[0] ?? null;
  const visibleLeagues = (leagues.length ? leagues : recommendations.map((item) => item.sportKey).filter(Boolean)).filter((value, index, all) => all.indexOf(value) === index).slice(0, 8);

  async function addToWatchlist(item) {
    if (!item?.eventId || !item?.selection || !item?.sportKey) return;
    const key = watchKey(item);
    setWatchState((current) => ({ ...current, [key]: { state: "saving" } }));
    try {
      await fetchJson("/api/cloud/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: item.eventId, selection: item.selection, sport: item.sportKey })
      });
      setWatchState((current) => ({ ...current, [key]: { state: "saved", message: tr({ fi: "Lisätty seurantaan.", en: "Added to watchlist.", es: "Añadido al seguimiento." }) } }));
    } catch (cause) {
      setWatchState((current) => ({ ...current, [key]: { state: "error", message: requestErrorText(cause, tr), needsLogin: cause?.status === 401 } }));
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5" data-homepage-premium-v2="true">
      <section className="relative isolate overflow-hidden rounded-[1.8rem] border border-sky-400/15 bg-[linear-gradient(120deg,rgba(5,10,20,.98),rgba(8,19,34,.94)_52%,rgba(5,12,24,.92))] px-5 py-6 shadow-[0_35px_100px_rgba(0,0,0,.38)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute right-[20%] top-0 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px)] [background-size:38px_38px]" />
        <div className="relative grid items-center gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
          <div className="max-w-3xl">
            <div className="text-[10px] font-black uppercase tracking-[0.34em] text-slate-400">REAL DATA. SMARTER DECISIONS.</div>
            <h1 className="mt-4 text-balance text-[clamp(2.35rem,7.5vw,5.6rem)] font-black leading-[.94] tracking-[-0.06em] text-white">
              {tr({ fi: "Vedonlyöntipäätökset fiksummin ", en: "Bet smarter with ", es: "Decide mejor con " })}
              <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-[var(--sc-brand)] bg-clip-text text-transparent">AI-powered</span>
              {tr({ fi: " urheiludatalla.", en: " sports intelligence.", es: " inteligencia deportiva." })}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">{tr({ fi: "Live-kertoimet, no-vig markkinakonsensus, Scorecasterin oma malli ja läpinäkyvät turvaportit yhdessä päätösnäkymässä.", en: "Live odds, no-vig market consensus, Scorecaster's own model and transparent safety gates in one decision surface.", es: "Cuotas, consenso sin margen, modelo propio y filtros transparentes en una sola vista." })}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/events" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-sky-400 px-6 text-sm font-black text-white shadow-[0_15px_45px_rgba(14,165,233,.25)] transition hover:-translate-y-0.5">{tr({ fi: "Aloita analysointi →", en: "Start analyzing →", es: "Empezar análisis →" })}</Link>
              <Link href="/feed" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] px-6 text-sm font-black text-slate-100 transition hover:bg-white/[0.08]">{tr({ fi: "Katso AI Feed", en: "View AI Feed", es: "Ver AI Feed" })}</Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-400"><span>{tr({ fi: "Analysoitu", en: "Analyzed", es: "Analizados" })}: {loading ? "…" : error ? "–" : analyzed}</span><span>{tr({ fi: "PLAY nyt", en: "PLAY now", es: "PLAY ahora" })}: {loading ? "…" : plays.length}</span><span>{tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" })}: {updated}</span><span className="font-bold text-emerald-300">PAPER ONLY</span></div>
          </div>
          <VisualPulse />
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link href="/events" className="shrink-0 rounded-xl border border-sky-400/45 bg-sky-400/10 px-4 py-2 text-xs font-black text-sky-200">▦ {tr({ fi: "Kaikki", en: "All", es: "Todos" })}</Link>
        {visibleLeagues.map((league) => <span key={league} className="shrink-0 rounded-xl border border-[var(--sc-border)] bg-white/[0.02] px-4 py-2 text-xs font-black text-[var(--sc-text-secondary)]">{leagueLabel(league)}</span>)}
      </div>

      {error ? <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-[var(--sc-text)]">{error} <button type="button" onClick={load} className="ml-2 font-black underline">{tr({ fi: "Yritä uudelleen", en: "Try again", es: "Reintentar" })}</button></div> : null}
      {data?.partialUpstream ? <p role="status" className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 text-sm text-[var(--sc-text-secondary)]">{tr({ fi: "Osa sarjoista tai markkinoista ei vastannut. Näytetään vain onnistuneesti varmennetut kohteet.", en: "Some leagues or markets did not respond. Only successfully verified selections are shown.", es: "Algunas ligas o mercados no respondieron. Solo se muestran selecciones verificadas." })}</p> : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(260px,.78fr)_minmax(430px,1.45fr)_minmax(280px,.82fr)]">
        <div className="space-y-4">
          <div className="rounded-[1.65rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 shadow-2xl sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">★ {tr({ fi: "Top AI Picks", en: "Top AI Picks", es: "Top AI Picks" })}</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{tr({ fi: "Tämän hetken parhaat", en: "Best right now", es: "Mejores ahora" })}</div></div><Link href="/feed" className="text-[11px] font-black text-sky-300">{tr({ fi: "Kaikki →", en: "View all →", es: "Ver todo →" })}</Link></div>
            <div className="space-y-2.5">{loading ? [0, 1, 2].map((value) => <div key={value} className="h-[86px] animate-pulse rounded-2xl bg-white/[0.04]" />) : [0, 1, 2].map((index) => <PickRow key={ranked[index]?.eventId || `empty-${index}`} item={ranked[index]} index={index} tr={tr} onWatch={addToWatchlist} watchState={watchState} />)}</div>
          </div>

          <div className="rounded-[1.65rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 shadow-2xl sm:p-5">
            <div className="mb-3 flex items-center justify-between"><div className="text-sm font-black text-[var(--sc-text)]">▥ Market Insights</div><Link href="/data-layer" className="text-[11px] font-black text-sky-300">{tr({ fi: "Data →", en: "Data →", es: "Datos →" })}</Link></div>
            <div className="space-y-2 text-sm">
              <Link href="/market-timeline" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><span><strong className="text-[var(--sc-text)]">Line Movement</strong><span className="mt-0.5 block text-[10px] text-[var(--sc-muted)]">{tr({ fi: "Todennettu hintahistoria", en: "Verified price history", es: "Historial verificado" })}</span></span><span className="text-sky-300">→</span></Link>
              <Link href="/risk" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><span><strong className="text-[var(--sc-text)]">Bankroll Insight</strong><span className="mt-0.5 block text-[10px] text-[var(--sc-muted)]">{tr({ fi: "Paper-riskinhallinta", en: "Paper risk control", es: "Control de riesgo simulado" })}</span></span><span className="text-sky-300">→</span></Link>
              <Link href="/data-layer" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><span><strong className="text-[var(--sc-text)]">Data Trust</strong><span className="mt-0.5 block text-[10px] text-[var(--sc-muted)]">{tr({ fi: "Lähteet ja tuoreus", en: "Sources and freshness", es: "Fuentes y frescura" })}</span></span><span className="text-sky-300">→</span></Link>
            </div>
          </div>
        </div>

        <div className="rounded-[1.65rem] border border-sky-400/15 bg-[linear-gradient(180deg,rgba(10,20,34,.94),rgba(6,12,22,.94))] p-4 shadow-2xl sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
            <div><div className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${decisionTone(spotlight?.decision)}`}>{spotlight?.decision || "WAIT"}</span><span className="text-sm font-black text-white">Match Hub</span></div><div className="mt-1 text-[10px] text-slate-500">{spotlight ? leagueLabel(spotlight.sportKey || spotlight.league) : tr({ fi: "Odotetaan varmennettua kohdetta", en: "Waiting for a verified selection", es: "Esperando selección verificada" })}</div></div>
            {spotlight ? <Link href={recommendationHref(spotlight)} className="text-[11px] font-black text-sky-300">{tr({ fi: "Täysi analyysi →", en: "Full analysis →", es: "Análisis completo →" })}</Link> : null}
          </div>

          {spotlight ? <>
            <div className="py-5 text-center"><div className="text-xl font-black tracking-[-0.025em] text-white sm:text-2xl">{spotlight.match || "–"}</div><div className="mt-2 text-xs text-slate-400">{marketLabel(spotlight.marketKey, tr)}</div></div>
            <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-sky-400/35 bg-sky-400/[0.08] p-3 text-center"><div className="text-[9px] font-black uppercase tracking-[0.14em] text-sky-300">{tr({ fi: "Pelaa näin", en: "How to play it", es: "Cómo jugar" })}</div><div className="mt-1.5 text-sm font-black text-white">{spotlight.selection || "–"}</div></div><div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 text-center"><div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">{tr({ fi: "Paras kerroin", en: "Best odds", es: "Mejor cuota" })}</div><div className="mt-1.5 text-sm font-black text-white">{number(spotlight.odds)}</div></div><div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 text-center"><div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">Edge</div><div className="mt-1.5 text-sm font-black text-[var(--sc-brand)]">{percent(spotlight.edge)}</div></div></div>

            <div className="mt-4 rounded-2xl border border-white/[0.07] bg-black/15 p-4"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--sc-brand)] shadow-[0_0_14px_var(--sc-brand)]" /><span className="text-xs font-black text-white">Probability Edge</span></div><span className="text-[10px] text-slate-500">NO-VIG</span></div><div className="space-y-3"><ProbabilityRail label={tr({ fi: "Scorecasterin oma malli", en: "Scorecaster own model", es: "Modelo propio" })} value={spotlight.independentModelProbability} tone="green" /><ProbabilityRail label={tr({ fi: "Markkinakonsensus", en: "Market consensus", es: "Consenso de mercado" })} value={spotlight.marketProbability} /></div></div>

            <div className="mt-4 rounded-2xl border border-sky-400/15 bg-sky-400/[0.045] p-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-sky-400/35 bg-sky-400/10 text-xs font-black text-sky-200">AI</div><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-300">AI Recommendation</div><div className="mt-1 text-sm font-black text-white">{ownedModelText(spotlight, tr)}</div><div className="mt-1.5 text-xs leading-5 text-slate-400">{spotlight.decision === "PLAY" ? tr({ fi: "Miksi PLAY? Markkina-, evidence- ja turvaportit ovat läpäisseet nykyiset rajat.", en: "Why PLAY? Market, evidence and safety gates currently pass.", es: "¿Por qué PLAY? Mercado, evidencia y seguridad pasan los filtros." }) : `${tr({ fi: "Seuraa – älä pelaa vielä", en: "Watch – do not play yet", es: "Sigue – todavía no juegues" })}: ${gateText(spotlight, tr)}`}</div>{spotlight?.intelligenceV2?.visibleGateSummary ? <div className="mt-2 text-[10px] font-black text-amber-200">{spotlight.intelligenceV2.visibleGateSummary.passed}/{spotlight.intelligenceV2.visibleGateSummary.total} PLAY-{tr({ fi: "porttia", en: "gates", es: "filtros" })}</div> : null}</div></div></div>
          </> : <div className="grid min-h-[410px] place-items-center py-10 text-center"><div><div className="text-3xl font-black text-white">{tr({ fi: "Ei PLAY-kohteita juuri nyt", en: "No PLAY picks right now", es: "No hay picks PLAY ahora" })}</div><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">{tr({ fi: "Scorecaster ei täytä näkymää tekaistuilla suosituksilla. Uusi kohde ilmestyy tähän vasta, kun markkinadata on käytettävissä.", en: "Scorecaster does not fill the view with invented recommendations. A selection appears only when market data is available.", es: "Scorecaster no rellena la vista con recomendaciones inventadas." })}</p></div></div>}
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.65rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 shadow-2xl sm:p-5">
            <div className="flex items-center justify-between"><div className="text-sm font-black text-[var(--sc-text)]">▣ Paper Slip</div><span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-black text-emerald-200">PAPER ONLY</span></div>
            {spotlight ? <div className="mt-4"><div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="text-sm font-black text-[var(--sc-text)]">{spotlight.selection || "–"}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{spotlight.match || "–"}</div><div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3"><span className="text-[10px] text-[var(--sc-faint)]">{marketLabel(spotlight.marketKey, tr)}</span><span className="font-black text-sky-300">@ {number(spotlight.odds)}</span></div></div><Link href={recommendationHref(spotlight)} className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-[var(--sc-brand)] px-4 text-sm font-black text-white">{tr({ fi: "Avaa paperipäätös", en: "Open paper decision", es: "Abrir decisión simulada" })}</Link><div className="mt-2 text-center text-[10px] leading-4 text-[var(--sc-faint)]">{tr({ fi: "Ei vedonvälittäjä. Ei lähetä vetoa eikä siirrä rahaa.", en: "Not a bookmaker. Does not submit bets or move money.", es: "No es una casa de apuestas. No envía apuestas ni mueve dinero." })}</div></div> : <div className="mt-4"><EmptyPick tr={tr} /></div>}
          </div>

          <div className="rounded-[1.65rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 shadow-2xl sm:p-5">
            <div className="mb-4 flex items-center justify-between"><div className="text-sm font-black text-[var(--sc-text)]">▥ {tr({ fi: "Tämän hetken Intelligence Edge", en: "Today's Intelligence Edge", es: "Intelligence Edge de hoy" })}</div><Link href="/analytics" className="text-[11px] font-black text-sky-300">{tr({ fi: "Analytiikka →", en: "Analytics →", es: "Analítica →" })}</Link></div>
            <div className="grid grid-cols-3 gap-2"><div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><div className="text-lg font-black text-[var(--sc-brand)]">{percent(bestEdge)}</div><div className="mt-1 text-[9px] uppercase tracking-[0.11em] text-[var(--sc-faint)]">Best edge</div></div><div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><div className="text-lg font-black text-sky-300">{percent(averageConfidence, 0)}</div><div className="mt-1 text-[9px] uppercase tracking-[0.11em] text-[var(--sc-faint)]">Avg. data</div></div><div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><div className="text-lg font-black text-white">{maxBookmakers ?? "–"}</div><div className="mt-1 text-[9px] uppercase tracking-[0.11em] text-[var(--sc-faint)]">Books max</div></div></div>
            <div className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] leading-5 text-[var(--sc-muted)]">{tr({ fi: "Luvut ovat tämän hetken dataa, eivät toteutunutta ROI:ta tai luvattua voittoprosenttia.", en: "These are current-data metrics, not realized ROI or a promised win rate.", es: "Son métricas de datos actuales, no ROI realizado ni tasa de acierto prometida." })}</div>
          </div>
        </div>
      </section>

      {!loading && nearPlay.length ? <section className="rounded-[1.65rem] border border-amber-400/15 bg-amber-400/[0.035] p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">{tr({ fi: "Lähimpänä PLAYta", en: "Closest to PLAY", es: "Más cerca de PLAY" })}</div><h2 className="mt-1 text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Seuraa – älä pelaa vielä", en: "Watch – do not play yet", es: "Sigue – todavía no juegues" })}</h2></div><Link href="/feed" className="text-xs font-black text-sky-300">AI Feed →</Link></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{nearPlay.slice(0, 3).map((item) => { const summary = item?.intelligenceV2?.visibleGateSummary; return <Link href={recommendationHref(item)} key={`${item.eventId}-${item.selection}`} className="rounded-2xl border border-amber-400/15 bg-black/10 p-4"><div className="text-xs text-[var(--sc-muted)]">{leagueLabel(item.sportKey || item.league)}</div><div className="mt-1 font-black text-[var(--sc-text)]">{item.match}</div><div className="mt-2 text-sm text-amber-100">{tr({ fi: "Seurattava ehdokas – ei pelisuositus", en: "Candidate to watch – not a bet recommendation", es: "Candidato a seguir – no recomendación" })}</div><div className="mt-2 text-xs text-[var(--sc-muted)]">{item.selection} @ {number(item.odds)}{summary ? ` · ${summary.passed}/${summary.total} PLAY-${tr({ fi: "porttia", en: "gates", es: "filtros" })}` : ""}</div></Link>; })}</div></section> : null}

      <section className="grid gap-3 sm:grid-cols-3"><Link href="/events" className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 transition hover:border-sky-400/25"><div className="font-black text-[var(--sc-text)]">{tr({ fi: "Kaikki ottelut", en: "All matches", es: "Todos los partidos" })}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "Selaa koko verified event -hakemistoa", en: "Browse the verified event directory", es: "Explora el directorio verificado" })}</div></Link><Link href="/tracking" className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 transition hover:border-sky-400/25"><div className="font-black text-[var(--sc-text)]">{tr({ fi: "Oma paperiseuranta", en: "My paper tracking", es: "Mi seguimiento simulado" })}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "Tallennetut valinnat, settlement ja CLV", en: "Saved selections, settlement and CLV", es: "Selecciones, liquidación y CLV" })}</div></Link><Link href="/model-lab#validation-lab" className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 transition hover:border-sky-400/25"><div className="font-black text-[var(--sc-text)]">Validation Lab</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "Tutki mallien oikeaa testinäyttöä", en: "Inspect real model validation evidence", es: "Ver evidencia real del modelo" })}</div></Link></section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-xs leading-5 text-[var(--sc-muted)]"><span>{tr({ fi: "Scorecaster ei aseta oikeita vetoja. PLAY tarkoittaa vain, että nykyiset markkina-, mallievidence- ja turvaportit läpäistiin paperianalyysissä; se ei takaa lopputulosta.", en: "Scorecaster does not place real bets. PLAY only means the current market, model-evidence and safety gates passed in paper analysis; it does not guarantee an outcome.", es: "Scorecaster no realiza apuestas reales. PLAY solo indica que los filtros actuales se superaron en análisis simulado." })}</span><Link href="/data-layer" className="shrink-0 font-black text-sky-300 underline">{tr({ fi: "Datan lähteet ja tarkistus", en: "Data sources and audit", es: "Fuentes y auditoría" })}</Link></div>

      {Object.values(watchState).some((entry) => entry?.message) ? <div role="status" className="text-xs text-[var(--sc-muted)]">{Object.values(watchState).map((entry, index) => entry?.message ? <span key={index} className="mr-3">{entry.message}{entry.needsLogin ? <> <Link className="font-black underline" href={loginHref("/")}>{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link></> : null}</span> : null)}</div> : null}
    </div>
  );
}
