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

function watchKey(item) { return [item.eventId, item.marketKey, item.selection].join(":"); }

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
  if (item?.ownedModelStrongConflict) return tr({ fi: "Oma malli vastustaa tätä valintaa", en: "Own model strongly disagrees with this selection", es: "El modelo propio contradice esta selección" });
  if (item?.ownedModelQualified && item?.ownedModelSupportsSelection) return tr({ fi: "Oma malli tukee valintaa", en: "Own model supports the selection", es: "El modelo propio apoya la selección" });
  if (item?.ownedModelAvailable) return tr({ fi: "Oman mallin arvio on saatavilla, mutta evidence ei vielä riitä PLAYhin", en: "Own-model estimate is available, but evidence is not yet enough for PLAY", es: "La estimación propia está disponible, pero la evidencia no basta para PLAY" });
  if (item?.ownedModelMarketMapped) return tr({ fi: "Ottelu on yhdistetty omaan malliin, mutta kelpoinen valintakohtainen arvio puuttuu", en: "The event is mapped to the own model, but an eligible selection estimate is missing", es: "El evento está mapeado, pero falta una estimación apta para la selección" });
  return tr({ fi: "Oman mallin arvio ei ole vielä saatavilla tälle valinnalle", en: "Own-model estimate is not yet available for this selection", es: "La estimación propia aún no está disponible para esta selección" });
}

function playReasonText(reason, item, tr) {
  const code = reason?.code;
  if (code === "positive-edge") return tr({ fi: `Hintaetu ${percent(item.edge)}`, en: `Price edge ${percent(item.edge)}`, es: `Ventaja de precio ${percent(item.edge)}` });
  if (code === "positive-ev") return tr({ fi: `Odotusarvo ${percent(item.ev)}`, en: `Expected value ${percent(item.ev)}`, es: `Valor esperado ${percent(item.ev)}` });
  if (code === "price-above-fair") return tr({ fi: `Paras kerroin ${number(item.odds)} ylittää fair-kertoimen ${number(item.fairOdds)}`, en: `Best price ${number(item.odds)} is above fair odds ${number(item.fairOdds)}`, es: `La mejor cuota ${number(item.odds)} supera la cuota justa ${number(item.fairOdds)}` });
  if (code === "market-coverage") return tr({ fi: `${item.bookmakerCount} vedonvälittäjää mukana`, en: `${item.bookmakerCount} bookmakers in consensus`, es: `${item.bookmakerCount} casas en consenso` });
  if (code === "verified-evidence") return tr({ fi: "Riippumaton evidence varmennettu", en: "Independent evidence verified", es: "Evidencia independiente verificada" });
  if (code === "confidence") return tr({ fi: `Datavarmuus ${percent(item.confidence)}`, en: `Data confidence ${percent(item.confidence)}`, es: `Confianza de datos ${percent(item.confidence)}` });
  if (code === "fresh-data") return tr({ fi: "Markkinadata on tuore", en: "Market data is fresh", es: "Los datos de mercado están actualizados" });
  return null;
}

function ModelStrip({ item, tr, compact = false }) {
  const probability = finite(item?.independentModelProbability);
  const market = finite(item?.marketProbability);
  const conflict = item?.ownedModelStrongConflict === true;
  return (
    <div className={`rounded-xl border px-4 py-3 ${conflict ? "border-red-400/25 bg-red-500/8" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{tr({ fi: "Scorecasterin oma malli", en: "Scorecaster own model", es: "Modelo propio de Scorecaster" })}</div>
          <div className={`mt-1 text-sm font-black ${conflict ? "text-red-200" : "text-[var(--sc-text)]"}`}>{ownedModelText(item, tr)}</div>
        </div>
        {!compact || probability !== null ? <div className="flex gap-4 text-right text-xs">
          <div><div className="text-[var(--sc-faint)]">{tr({ fi: "Malli", en: "Model", es: "Modelo" })}</div><div className="font-black text-[var(--sc-text)]">{percent(probability)}</div></div>
          <div><div className="text-[var(--sc-faint)]">{tr({ fi: "Markkina", en: "Market", es: "Mercado" })}</div><div className="font-black text-[var(--sc-text)]">{percent(market)}</div></div>
        </div> : null}
      </div>
    </div>
  );
}

function PlayCard({ item, tr, onWatch, watchState }) {
  const stake = finite(item.suggestedStake);
  const saved = watchState[watchKey(item)];
  const state = saved?.state;
  const why = (Array.isArray(item.reasons) ? item.reasons : [])
    .map((reason) => playReasonText(reason, item, tr))
    .filter(Boolean)
    .slice(0, 3);
  return (
    <article className="overflow-hidden rounded-[2rem] border border-emerald-400/35 bg-emerald-500/10 shadow-2xl">
      <div className="border-b border-emerald-400/20 bg-emerald-400/10 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3"><div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">● PLAY</div><div className="text-xs font-bold text-[var(--sc-muted)]">{item.sportTitle || item.league || item.sportKey}</div></div>
      </div>
      <div className="p-5 sm:p-6">
        <h2 className="text-2xl font-black tracking-[-0.03em] text-[var(--sc-text)]">{item.match}</h2>
        <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-[var(--sc-surface)]/70 p-5">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-muted)]">{tr({ fi: "Pelaa näin", en: "How to play it", es: "Cómo jugar" })}</div>
          <div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{item.selection || "–"}</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-[var(--sc-text-secondary)]"><span>{marketLabel(item.marketKey, tr)}</span><span className="text-emerald-200">@ {number(item.odds)}</span>{item.bookmaker ? <span>{item.bookmaker}</span> : null}</div>
          <div className="mt-4 rounded-xl bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">{tr({ fi: "Yksittäinen paperiveto", en: "Single paper bet", es: "Apuesta simulada simple" })}{stake !== null ? ` · ${tr({ fi: "paperipanos", en: "paper stake", es: "stake simulado" })} ${number(stake, 1)} / 1000` : ""}</div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">Edge</div><div className="mt-1 text-xl font-black text-emerald-300">{percent(item.edge)}</div></div>
          <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">EV</div><div className="mt-1 text-xl font-black text-emerald-300">{percent(item.ev)}</div></div>
          <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">{tr({ fi: "Datan varmuus", en: "Data confidence", es: "Confianza de datos" })}</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">{percent(item.confidence)}</div></div>
          <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">{tr({ fi: "Oma malli", en: "Own model", es: "Modelo propio" })}</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">{percent(item.independentModelProbability)}</div></div>
          <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">{tr({ fi: "Markkina", en: "Market", es: "Mercado" })}</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">{percent(item.marketProbability)}</div></div>
        </div>
        <div className="mt-4"><ModelStrip item={item} tr={tr} compact /></div>
        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">{tr({ fi: "Miksi PLAY?", en: "Why PLAY?", es: "¿Por qué PLAY?" })}</div>
          <ul className="mt-2 space-y-1 text-sm font-bold text-[var(--sc-text-secondary)]">
            {(why.length ? why : [tr({ fi: "Markkina-, evidence- ja turvaportit läpäisty", en: "Market, evidence and safety gates passed", es: "Filtros de mercado, evidencia y seguridad superados" })]).map((reason) => <li key={reason}>✓ {reason}</li>)}
          </ul>
        </div>
        <div className="mt-5 flex gap-2"><Link href={recommendationHref(item)} className="flex-1 rounded-xl bg-[var(--sc-brand)] px-4 py-3 text-center text-sm font-black text-[var(--sc-brand-ink)]">{tr({ fi: "Avaa perustelut", en: "Open reasoning", es: "Abrir análisis" })}</Link><button type="button" onClick={() => onWatch(item)} disabled={state === "saving" || state === "saved"} className="rounded-xl border border-[var(--sc-border)] px-4 py-3 text-sm font-black text-[var(--sc-text)] disabled:opacity-50">{state === "saved" ? "✓" : state === "saving" ? "…" : tr({ fi: "Seuraa", en: "Watch", es: "Seguir" })}</button></div>
        {saved?.message ? <div role="status" className="mt-3 text-sm text-[var(--sc-text)]">{saved.message} {saved.needsLogin ? <Link className="font-bold underline" href={loginHref(recommendationHref(item))}>{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link> : null}</div> : null}
      </div>
    </article>
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
  const leagues = Array.isArray(data?.leagues) ? data.leagues : [];
  const updated = data?.generatedAt ? new Date(data.generatedAt).toLocaleString(locale) : "–";
  const analyzed = Number(data?.marketCandidateCount || data?.analyzedRecommendationCount || recommendations.length || 0);
  const closeCount = Number(data?.counts?.NEAR_PLAY ?? nearPlay.length);

  async function addToWatchlist(item) {
    if (!item?.eventId || !item?.selection || !item?.sportKey) return;
    const key = watchKey(item);
    setWatchState((current) => ({ ...current, [key]: { state: "saving" } }));
    try {
      await fetchJson("/api/cloud/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: item.eventId, selection: item.selection, sport: item.sportKey }) });
      setWatchState((current) => ({ ...current, [key]: { state: "saved", message: tr({ fi: "Lisätty seurantaan.", en: "Added to watchlist.", es: "Añadido al seguimiento." }) } }));
    } catch (cause) {
      setWatchState((current) => ({ ...current, [key]: { state: "error", message: requestErrorText(cause, tr), needsLogin: cause?.status === 401 } }));
    }
  }

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[2rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-6 shadow-2xl sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-5"><div><div className="text-xs font-black uppercase tracking-[0.2em] text-[var(--sc-brand)]">{tr({ fi: "Scorecaster tänään", en: "Scorecaster today", es: "Scorecaster hoy" })}</div><h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-[var(--sc-text)] sm:text-5xl">{tr({ fi: "Mitä pelata tänään?", en: "What to play today?", es: "¿Qué jugar hoy?" })}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--sc-muted)] sm:text-base">{tr({ fi: "Saat ensin lopullisen päätöksen. PLAY näkyy vain, kun hinta, data, riippumaton evidence ja turvaportit läpäisevät nykyiset rajat. Muussa tapauksessa Scorecaster sanoo suoraan: älä pelaa vielä.", en: "You get the final decision first. PLAY appears only when price, data, independent evidence and safety gates all pass. Otherwise Scorecaster says directly: do not play yet.", es: "Primero ves la decisión final. PLAY solo aparece cuando precio, datos, evidencia independiente y seguridad superan todos los filtros." })}</p></div><div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)]/70 px-5 py-4 text-right"><div className="text-3xl font-black text-[var(--sc-text)]">{loading ? "…" : error ? "–" : plays.length}</div><div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--sc-muted)]">PLAY</div><button type="button" onClick={load} disabled={loading} className="disabled:opacity-50 mt-2 text-xs font-black text-[var(--sc-brand)]">{tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button></div></div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-[var(--sc-muted)]"><span>{tr({ fi: "Analysoitu", en: "Analyzed", es: "Analizados" })}: {loading ? "…" : error ? "–" : analyzed}</span><span>·</span><span>{tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" })}: {updated}</span><span>·</span><span>{tr({ fi: "Liigoja", en: "Leagues", es: "Ligas" })}: {leagues.length || "–"}</span><span>·</span><span>{tr({ fi: "vain paperianalyysi", en: "paper analysis only", es: "solo análisis simulado" })}</span></div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--sc-border)] px-5 py-4 text-sm">
        <p className="max-w-3xl text-[var(--sc-muted)]">{tr({ fi: "Kehitysvaihe: mallien ennustekykyä tutkitaan. Datan varmuus kuvaa lähtötiedon laatua; valinnan todennäköisyys näkyy erikseen malliarviossa.", en: "Early stage: model performance is under evaluation. Data confidence describes input quality; the selection probability appears separately in the model estimate.", es: "Etapa inicial: se evalúa el rendimiento de los modelos. La confianza de datos describe la calidad de entrada; la probabilidad aparece por separado en la estimación." })}</p>
        <Link href="/model-lab#validation-lab" className="font-black text-[var(--sc-brand)]">{tr({ fi: "Tutki testinäyttöä →", en: "Inspect validation evidence →", es: "Ver evidencia de validación →" })}</Link>
      </div>

      {error ? <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-sm text-[var(--sc-text)]">{error} <button type="button" onClick={load} className="ml-2 font-bold underline">{tr({ fi: "Yritä uudelleen", en: "Try again", es: "Reintentar" })}</button></div> : null}
      {data?.partialUpstream ? <p role="status" className="rounded-xl border border-amber-400/30 p-4 text-sm text-[var(--sc-text)]">{tr({ fi: "Osa sarjoista tai markkinoista ei vastannut. Näytetään vain onnistuneesti haetut kohteet; tulos ei kata kaikkia otteluita.", en: "Some leagues or markets did not respond. Only successfully loaded selections are shown; this is not a complete scan.", es: "Algunas ligas o mercados no respondieron. Solo se muestran las selecciones disponibles." })}</p> : null}
      {loading ? <div role="status" className="rounded-2xl border border-[var(--sc-border)] p-6 text-[var(--sc-muted)]"><p>{tr({ fi: "Haetaan tuoreita kohteita ja tarkistetaan tiedot… Voit sillä aikaa selata otteluita.", en: "Loading current selections and checking the evidence… You can browse matches while this loads.", es: "Cargando selecciones y comprobando datos… Puedes explorar los partidos mientras tanto." })}</p><div aria-hidden="true" className="mt-4 grid gap-4 lg:grid-cols-2">{[1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-[2rem] border border-[var(--sc-border)] bg-[var(--sc-surface)]" />)}</div></div> : error ? null : plays.length ? <section><div className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-emerald-300">{tr({ fi: "Mitä pelata", en: "What to play", es: "Qué jugar" })}</div><div className="grid gap-5 lg:grid-cols-2">{plays.map((item) => <PlayCard key={`${item.eventId}-${item.selection}-${item.marketKey}`} item={item} tr={tr} onWatch={addToWatchlist} watchState={watchState} />)}</div></section> : <section className="rounded-[2rem] border border-amber-400/30 bg-amber-500/10 p-6 sm:p-8"><div className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">WAIT</div><h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--sc-text)]">{tr({ fi: "Ei PLAY-kohteita juuri nyt", en: "No PLAY picks right now", es: "No hay picks PLAY ahora" })}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--sc-muted)]">{tr({ fi: `Scorecaster analysoi ${analyzed} markkinaehdokasta. Yksikään ei täytä tällä hetkellä kaikkia PLAY-ehtoja.${closeCount ? ` ${closeCount} kohdetta on yhden näkyvän portin päässä.` : ""} Älä pelaa CAUTION-kohdetta pelkän markkinaedgen perusteella.`, en: `Scorecaster analyzed ${analyzed} market candidates. None currently pass every PLAY gate.${closeCount ? ` ${closeCount} candidates are one visible gate away.` : ""} Do not play CAUTION from market edge alone.`, es: `Scorecaster analizó ${analyzed} candidatos de mercado. Ninguno supera ahora todos los filtros PLAY.${closeCount ? ` ${closeCount} están a un filtro visible.` : ""}` })}</p></section>}

      {!loading && nearPlay.length ? <section><div className="mb-4 flex items-end justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">{tr({ fi: "Lähimpänä PLAYta", en: "Closest to PLAY", es: "Más cerca de PLAY" })}</div><h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Seuraa – älä pelaa vielä", en: "Watch – do not play yet", es: "Sigue – todavía no juegues" })}</h2></div><Link href="/feed" className="text-sm font-black text-[var(--sc-brand)]">{tr({ fi: "Kaikki analyysit", en: "All analysis", es: "Todos los análisis" })}</Link></div><div className="space-y-3">{nearPlay.map((item) => { const summary = item?.intelligenceV2?.visibleGateSummary; return <article key={`${item.eventId}-${item.selection}-${item.marketKey}`} className="rounded-3xl border border-amber-400/20 bg-[var(--sc-surface)] p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold text-[var(--sc-muted)]">{item.sportTitle || item.league || item.sportKey}</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">{item.match}</div></div><div className="text-right"><div className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black text-amber-100">WAIT</div>{summary ? <div className="mt-2 text-[10px] font-black text-amber-200">{summary.passed}/{summary.total} PLAY-{tr({ fi: "porttia", en: "gates", es: "filtros" })}</div> : null}</div></div><div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"><div><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">{tr({ fi: "Seurattava ehdokas – ei pelisuositus", en: "Candidate to watch – not a bet recommendation", es: "Candidato a seguir – no recomendación" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{item.selection || "–"} @ {number(item.odds)}</div></div><div><div className="text-[10px] text-[var(--sc-faint)]">Edge</div><div className="font-black text-[var(--sc-text)]">{percent(item.edge)}</div></div><div><div className="text-[10px] text-[var(--sc-faint)]">EV</div><div className="font-black text-[var(--sc-text)]">{percent(item.ev)}</div></div><Link href={recommendationHref(item)} className="rounded-xl border border-[var(--sc-border)] px-4 py-3 text-center text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Avaa", en: "Open", es: "Abrir" })}</Link></div><div className="mt-4"><ModelStrip item={item} tr={tr} /></div><div className="mt-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100"><span className="font-black">{tr({ fi: "Puuttuu:", en: "Still missing:", es: "Falta:" })}</span> {gateText(item, tr)}</div></article>; })}</div></section> : null}

      <section className="grid gap-4 sm:grid-cols-3"><Link href="/events" className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><div className="font-black text-[var(--sc-text)]">{tr({ fi: "Kaikki ottelut", en: "All matches", es: "Todos los partidos" })}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "Selaa lajeittain", en: "Browse by sport", es: "Explorar por deporte" })}</div></Link><Link href="/feed" className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><div className="font-black text-[var(--sc-text)]">AI Feed</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "WAIT, CAUTION ja perustelut", en: "WAIT, CAUTION and reasoning", es: "WAIT, CAUTION y motivos" })}</div></Link><Link href="/tracking" className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><div className="font-black text-[var(--sc-text)]">{tr({ fi: "Oma paperiseuranta", en: "My paper tracking", es: "Mi seguimiento simulado" })}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "Tallennetut valinnat ja tulokset", en: "Saved selections and results", es: "Selecciones guardadas y resultados" })}</div></Link></section>
      <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-xs leading-6 text-[var(--sc-muted)]">{tr({ fi: "Scorecaster ei aseta oikeita vetoja. PLAY tarkoittaa, että kohde läpäisi nykyiset markkina-, mallievidence- ja turvaportit paperianalyysissä; se ei takaa lopputulosta.", en: "Scorecaster does not place real bets. PLAY means the current market, model-evidence and safety gates passed in paper analysis; it does not guarantee an outcome.", es: "Scorecaster no realiza apuestas reales. PLAY significa que los filtros actuales se superaron en análisis simulado; no garantiza el resultado." })}</div>
    </div>
  );
}
