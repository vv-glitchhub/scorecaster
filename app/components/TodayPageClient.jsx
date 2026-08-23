"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import DecisionTransparencyCard from "./DecisionTransparencyCard";

const number = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
const percent = (value, digits = 1) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";

function eventTitle(event, fallback) {
  if (event?.homeTeam && event?.awayTeam) return `${event.homeTeam} – ${event.awayTeam}`;
  return event?.eventName || event?.name || event?.title || fallback || "Ottelu";
}

function eventMeta(event) {
  return [event?.sport, event?.league].filter(Boolean).join(" · ") || "Scorecaster AI";
}

function decisionTone(decision) {
  if (decision === "WATCH") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (decision === "CAUTION") return "border-amber-400/30 bg-amber-500/10 text-amber-100";
  return "border-slate-500/30 bg-slate-500/10 text-slate-200";
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
      const response = await fetch("/api/scorecaster-app?hours=2160&limit=10000", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Data unavailable");
      setData(payload);
    } catch (cause) {
      setError(cause?.message || "Data unavailable");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => load({ silent: true }), 300000);
    return () => window.clearInterval(timer);
  }, []);

  const eventMap = useMemo(() => new Map((data?.events || []).map((event) => [event.eventId, event])), [data]);
  const picks = useMemo(() => (data?.controlCenter?.dailyTop3 || []).slice(0, 3).map((pick, index) => {
    const event = eventMap.get(pick.eventId) || {};
    return {
      ...pick,
      rank: index + 1,
      title: eventTitle(event, pick.eventId),
      meta: eventMeta(event),
      selection: pick.selection || event.selection || "",
      sport: pick.sport || event.sport || "",
      market: pick.market || event.market || "h2h",
      event
    };
  }), [data, eventMap]);

  const accumulator = useMemo(() => {
    const legs = picks
      .filter((pick) => pick.decision === "WATCH" && pick.selection && Number(pick.bestOdds) > 1)
      .slice(0, 3);
    const combinedOdds = legs.reduce((total, pick) => total * Number(pick.bestOdds), 1);
    const averageScore = legs.length ? legs.reduce((total, pick) => total + Number(pick.score || 0), 0) / legs.length : 0;
    return { legs, combinedOdds, averageScore, available: legs.length >= 2 };
  }, [picks]);

  const trends = useMemo(() => [...picks].sort((a, b) => Number(b.edge ?? -1) - Number(a.edge ?? -1)), [picks]);
  const updated = data?.generatedAt ? new Date(data.generatedAt).toLocaleString(locale) : "–";
  const summary = data?.controlCenter?.summary || {};

  function eventHref(pick) {
    const query = new URLSearchParams();
    if (pick.sport) query.set("sport", pick.sport);
    if (pick.selection) query.set("selection", pick.selection);
    const suffix = query.toString();
    return `/event/${encodeURIComponent(pick.eventId)}${suffix ? `?${suffix}` : ""}`;
  }

  async function addToWatchlist(pick) {
    if (!pick.selection || !pick.sport) {
      setWatchState((current) => ({
        ...current,
        [pick.eventId]: { state: "error", message: tr({ fi: "Avaa ottelu ja valitse ensin varmennettu kohde.", en: "Open the event and choose a verified selection first.", es: "Abre el evento y elige primero una selección verificada." }) }
      }));
      return;
    }

    setWatchState((current) => ({ ...current, [pick.eventId]: { state: "saving", message: "" } }));
    try {
      const response = await fetch("/api/cloud/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: pick.eventId, selection: pick.selection, sport: pick.sport })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Watchlist save failed");
      setWatchState((current) => ({
        ...current,
        [pick.eventId]: { state: "saved", message: tr({ fi: "Lisätty varmennettuun seurantaan.", en: "Added to the verified watchlist.", es: "Añadido a la lista verificada." }) }
      }));
    } catch (cause) {
      setWatchState((current) => ({
        ...current,
        [pick.eventId]: { state: "error", message: cause?.message || "Watchlist save failed" }
      }));
    }
  }

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[2rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6 shadow-2xl sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">{tr({ fi: "Scorecaster tänään", en: "Scorecaster today", es: "Scorecaster hoy" })}</div>
            <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.045em] text-[var(--sc-text)] sm:text-5xl">
              {tr({ fi: "Parhaat saatavilla olevat AI-havainnot – myös silloin, kun vastaus on varovainen.", en: "The best available AI observations – even when the answer is cautious.", es: "Las mejores observaciones disponibles, incluso cuando la respuesta es prudente." })}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--sc-muted)] sm:text-base">
              {tr({ fi: "Jokainen kortti näyttää päätöksen, perustelun, lähteet, puuttuvat tiedot ja laskukaavat. WATCH, CAUTION ja SKIP ovat näkyviä – mitään ei piiloteta vain siksi, ettei vahvaa kohdetta löytynyt.", en: "Every card exposes the verdict, reasoning, sources, missing inputs and formulas. WATCH, CAUTION and SKIP remain visible instead of leaving the product empty.", es: "Cada tarjeta muestra decisión, motivos, fuentes, datos faltantes y fórmulas. WATCH, CAUTION y SKIP siguen visibles." })}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/feed" className="sc-button-primary">{tr({ fi: "Avaa AI Feed", en: "Open AI Feed", es: "Abrir AI Feed" })}</Link>
              <Link href="/events" className="sc-button-secondary">{tr({ fi: "Kaikki ottelut", en: "All matches", es: "Todos los partidos" })}</Link>
              <Link href="/transparency" className="sc-button-secondary">{tr({ fi: "Kaavat ja lähteet", en: "Formulas and sources", es: "Fórmulas y fuentes" })}</Link>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-muted)]">{tr({ fi: "Tämän hetken tilanne", en: "Current status", es: "Estado actual" })}</div>
            <div className="mt-3 text-4xl font-black text-[var(--sc-text)]">{loading ? "…" : picks.length}</div>
            <div className="mt-1 text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "AI-korttia näkyvissä", en: "AI cards visible", es: "tarjetas IA visibles" })}</div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-[var(--sc-surface)]/60 p-2"><div className="font-black text-emerald-300">{summary.watchCards || 0}</div><div className="text-[var(--sc-muted)]">WATCH</div></div>
              <div className="rounded-xl bg-[var(--sc-surface)]/60 p-2"><div className="font-black text-amber-200">{summary.cautionCards || 0}</div><div className="text-[var(--sc-muted)]">CAUTION</div></div>
              <div className="rounded-xl bg-[var(--sc-surface)]/60 p-2"><div className="font-black text-slate-200">{summary.skipCards || 0}</div><div className="text-[var(--sc-muted)]">SKIP</div></div>
            </div>
            <div className="mt-4 text-xs text-[var(--sc-muted)]">{tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" })}: {updated}</div>
            <button type="button" onClick={() => load()} className="mt-4 text-xs font-black text-[var(--sc-brand)] hover:underline">{tr({ fi: "Päivitä nyt", en: "Refresh now", es: "Actualizar ahora" })}</button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-100">{error}</div>}

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Top 3</div>
            <h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "AI:n parhaat saatavilla olevat havainnot", en: "AI's best available observations", es: "Mejores observaciones disponibles" })}</h2>
          </div>
          <Link href="/events" className="text-sm font-black text-[var(--sc-brand)] hover:underline">{tr({ fi: "Näytä kaikki kohteet", en: "Show all picks", es: "Ver todos" })}</Link>
        </div>

        {loading && <div className="grid gap-4 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-96 animate-pulse rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]" />)}</div>}
        {!loading && !picks.length && (
          <div className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-8 text-center">
            <div className="text-lg font-black text-[var(--sc-text)]">{tr({ fi: "Julkaistavaa markkina- tai mallidataa ei löytynyt", en: "No publishable market or model data was found", es: "No se encontraron datos publicables" })}</div>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--sc-muted)]">{tr({ fi: "Tämä ei ole käyttöliittymän tyhjä virhetila. Collector ei palauttanut yhtään tapahtumaa, jolle olisi markkinatodennäköisyys, malliarvio tai kelvollinen kerroin.", en: "This is not a hidden UI failure. The collector returned no event with a market probability, model estimate or valid odds.", es: "No es un fallo oculto de la interfaz. El recopilador no devolvió datos válidos." })}</p>
            <Link href="/transparency" className="mt-5 inline-block text-sm font-black text-[var(--sc-brand)]">{tr({ fi: "Tarkista avoin datatilanne", en: "Inspect open data status", es: "Revisar datos abiertos" })}</Link>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {picks.map((pick) => (
            <article key={pick.eventId} className="flex flex-col rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--sc-brand-border)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">#{pick.rank} · {pick.meta}</div>
                  <h3 className="mt-2 text-xl font-black leading-tight text-[var(--sc-text)]">{pick.title}</h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${decisionTone(pick.decision)}`}>{pick.decision || "SKIP"}</span>
              </div>

              <p className="mt-4 text-sm leading-6 text-[var(--sc-muted)]">{pick.reason}</p>

              <div className="mt-4 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Nykyinen valinta", en: "Current selection", es: "Selección actual" })}</div>
                <div className="mt-1 font-black text-[var(--sc-text)]">{pick.selection || tr({ fi: "Valinta varmistetaan ottelusivulla", en: "Selection is verified on the event page", es: "La selección se verifica en el evento" })}</div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">AI score</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{number(pick.score, 0)}</div></div>
                <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">Edge</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{percent(pick.edge)}</div></div>
                <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">{tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })}</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{number(pick.bestOdds)}</div></div>
              </div>

              <div className="mt-4"><DecisionTransparencyCard explanation={pick.explanation} compact /></div>

              <div className="mt-auto flex gap-2 pt-5">
                <Link href={eventHref(pick)} className="flex-1 rounded-xl bg-[var(--sc-brand)] px-3 py-3 text-center text-sm font-black text-[var(--sc-brand-ink)]">{tr({ fi: "Avaa ottelu", en: "Open event", es: "Abrir evento" })}</Link>
                <button type="button" onClick={() => void addToWatchlist(pick)} disabled={watchState[pick.eventId]?.state === "saving" || watchState[pick.eventId]?.state === "saved"} className="rounded-xl border border-[var(--sc-border)] px-4 py-3 text-sm font-black text-[var(--sc-text-secondary)] disabled:opacity-50">{watchState[pick.eventId]?.state === "saved" ? "✓" : watchState[pick.eventId]?.state === "saving" ? "…" : tr({ fi: "Seuraa", en: "Watch", es: "Seguir" })}</button>
              </div>
              {watchState[pick.eventId]?.message ? <div className={`mt-3 text-xs leading-5 ${watchState[pick.eventId]?.state === "error" ? "text-amber-200" : "text-emerald-200"}`}>{watchState[pick.eventId].message}{/sign|auth|session|kirjaudu/i.test(watchState[pick.eventId].message) ? <Link href="/login" className="ml-1 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link> : null}</div> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{tr({ fi: "Päivän pitkäveto", en: "Daily accumulator", es: "Combinada del día" })}</div>
          <h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "AI-paperiyhdistelmä", en: "AI paper accumulator", es: "Combinada simulada IA" })}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Yhdistelmä rakennetaan vain WATCH-korteista, joilla on varmennettu valinta ja kelvollinen kerroin. Se on aina paper-only.", en: "The accumulator uses only WATCH cards with a verified selection and valid odds. It is always paper-only.", es: "La combinada usa solo tarjetas WATCH con selección y cuota verificadas. Siempre es simulada." })}</p>

          {accumulator.available ? (
            <>
              <div className="mt-5 space-y-3">
                {accumulator.legs.map((pick) => <div key={pick.eventId} className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div><div className="font-black text-[var(--sc-text)]">{pick.title}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{pick.selection} · AI {number(pick.score, 0)} · {pick.decision}</div></div><div className="text-lg font-black text-[var(--sc-text)]">{number(pick.bestOdds)}</div></div>)}
              </div>
              <div className="mt-5 flex items-end justify-between rounded-2xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-5">
                <div><div className="text-xs font-bold uppercase text-[var(--sc-muted)]">{tr({ fi: "Yhteiskerroin", en: "Combined odds", es: "Cuota combinada" })}</div><div className="mt-1 text-4xl font-black text-[var(--sc-text)]">{number(accumulator.combinedOdds)}</div></div>
                <div className="text-right"><div className="text-xs text-[var(--sc-muted)]">{tr({ fi: "AI-keskiarvo", en: "AI average", es: "Media IA" })}</div><div className="text-xl font-black text-[var(--sc-text)]">{number(accumulator.averageScore, 0)}</div></div>
              </div>
              <Link href="/tracking" className="mt-4 block rounded-xl border border-[var(--sc-border)] px-4 py-3 text-center text-sm font-black text-[var(--sc-text)] hover:border-[var(--sc-brand-border)]">{tr({ fi: "Avaa paperiseuranta", en: "Open paper tracking", es: "Abrir seguimiento" })}</Link>
            </>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5">
              <div className="font-black text-amber-100">{tr({ fi: "Ei vielä turvallisesti rakennettavaa yhdistelmää", en: "No supportable accumulator yet", es: "Aún no hay combinada justificable" })}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Tarvitaan vähintään kaksi WATCH-kohdetta, joilla on varmennettu valinta ja kerroin. CAUTION ei riitä yhdistelmän rakentamiseen.", en: "At least two WATCH cards with a verified selection and odds are required. CAUTION is not enough to build an accumulator.", es: "Se requieren al menos dos tarjetas WATCH con selección y cuota verificadas. CAUTION no es suficiente." })}</p>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{tr({ fi: "Trendit", en: "Trends", es: "Tendencias" })}</div>
          <h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Mallietu ja puuttuvat tiedot", en: "Model edge and missing evidence", es: "Ventaja y datos faltantes" })}</h2>
          <div className="mt-5 space-y-3">
            {trends.map((pick, index) => <div key={pick.eventId} className="rounded-2xl border border-[var(--sc-border)] p-4"><div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sc-brand-soft)] text-xs font-black text-[var(--sc-text)]">{index + 1}</div><div className="min-w-0"><div className="truncate font-black text-[var(--sc-text)]">{pick.title}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{pick.missing?.length ? `${pick.missing.length} missing` : "All main inputs present"}</div></div><div className="font-black text-[var(--sc-brand)]">{percent(pick.edge)}</div></div></div>)}
          </div>
          <Link href="/feed" className="mt-5 block text-center text-sm font-black text-[var(--sc-brand)] hover:underline">{tr({ fi: "Katso kaikki perustelut AI Feedissä", en: "See every explanation in AI Feed", es: "Ver todas las explicaciones" })}</Link>
        </div>
      </section>

      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-xs leading-6 text-[var(--sc-muted)]">
        {tr({ fi: "Scorecaster on päätöksenteon tukityökalu. Kaikki kohteet ja yhdistelmät ovat paper-only-analyysiä. Avoimuus tarkoittaa kaavojen, päätösrajojen, normalisoitujen syötteiden ja lähdeviitteiden näyttämistä – ei palveluntarjoajien lisenssien tai tietoturvan rikkomista.", en: "Scorecaster is a decision-support tool. All picks and accumulators are paper-only analysis. Transparency means publishing formulas, gates, normalized inputs and source references without violating licences or security.", es: "Scorecaster es una herramienta de apoyo. Todo es análisis simulado y transparente sin violar licencias ni seguridad." })}
      </div>
    </div>
  );
}
