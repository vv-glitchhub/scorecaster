"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../components/LanguageProvider";

function percent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)} %` : "–";
}

function decimal(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "–";
}

function tone(decision) {
  if (decision === "PLAY") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (decision === "SKIP") return "border-red-400/30 bg-red-400/10 text-red-200";
  return "border-yellow-400/30 bg-yellow-400/10 text-yellow-100";
}

function Metric({ label, value, note }) {
  return <div className="rounded-xl bg-slate-950/60 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-black text-white">{value}</div>{note && <div className="mt-1 text-xs text-slate-500">{note}</div>}</div>;
}

export default function EventDetailClient({ eventId, sport, initialSelection }) {
  const { tr, locale } = useLanguage();
  const [payload, setPayload] = useState(null);
  const [selectedName, setSelectedName] = useState(initialSelection || "");
  const [stake, setStake] = useState("5.00");
  const [bankroll, setBankroll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ eventId, sport });
      if (initialSelection) query.set("selection", initialSelection);
      const response = await fetch(`/api/event-detail?${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Event unavailable");
      setPayload(data);
      const preferred = initialSelection || data.detail?.selectedSelection || data.detail?.selections?.[0]?.selection || "";
      setSelectedName((current) => current || preferred);
      try {
        const bankResponse = await fetch("/api/cloud/bankroll", { cache: "no-store" });
        if (bankResponse.ok) setBankroll((await bankResponse.json())?.data || null);
      } catch {
        setBankroll(null);
      }
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : tr({ fi: "Ottelua ei voitu ladata.", en: "The event could not be loaded.", es: "No se pudo cargar el evento." }));
    } finally {
      setLoading(false);
    }
  }, [eventId, sport, initialSelection, tr]);

  useEffect(() => { void load(); }, [load]);

  const detail = payload?.detail;
  const selected = useMemo(() => detail?.selections?.find((item) => item.selection === selectedName) || detail?.selections?.[0] || null, [detail, selectedName]);
  const maximumStake = bankroll ? Number(bankroll.bankroll || 0) * Number(bankroll.max_stake_percent || 0) / 100 : null;
  const money = (value) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));
  const kickoff = detail?.commenceTime ? new Date(detail.commenceTime).toLocaleString(locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : tr({ fi: "Alkamisaika puuttuu", en: "Kickoff unavailable", es: "Hora no disponible" });

  async function watch() {
    if (!selected) return;
    setBusy("watch");
    setMessage("");
    try {
      const response = await fetch("/api/cloud/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: detail.eventId, selection: selected.selection, sport: detail.sportKey })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Watchlist save failed");
      setMessage(tr({ fi: "Kohde lisättiin varmennettuun seurantaan. Panosta ei luotu.", en: "The selection was added to the verified watchlist. No stake was created.", es: "La selección se añadió a la lista verificada. No se creó ningún importe." }));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Watchlist save failed");
    } finally { setBusy(""); }
  }

  async function savePaper() {
    if (!selected) return;
    const paperStake = Number(String(stake).replace(",", "."));
    if (!Number.isFinite(paperStake) || paperStake <= 0 || (maximumStake !== null && paperStake > maximumStake + 0.001)) {
      setError(maximumStake === null ? tr({ fi: "Tarkista paperipanos ja kirjaudu sisään.", en: "Check the paper stake and sign in.", es: "Revisa el importe simulado e inicia sesión." }) : tr({ fi: `Paperipanos saa olla enintään ${money(maximumStake)}.`, en: `The paper stake may be at most ${money(maximumStake)}.`, es: `El importe simulado puede ser como máximo ${money(maximumStake)}.` }));
      return;
    }
    setBusy("paper");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/cloud/bets/audited", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bets: [{
          id: `${detail.eventId}-${selected.selection}`,
          eventId: detail.eventId,
          match: detail.match,
          homeTeam: detail.homeTeam,
          awayTeam: detail.awayTeam,
          selection: selected.selection,
          odds: selected.odds,
          stake: paperStake,
          edge: selected.edge,
          ev: selected.ev,
          confidence: selected.confidence,
          league: detail.league,
          sport: detail.sportKey,
          bookmaker: selected.bookmaker,
          decision: selected.decision,
          qualityGrade: selected.qualityGrade,
          qualityScore: selected.trustScore,
          modelProbability: selected.consensusProbability,
          impliedProbability: selected.marketProbability,
          source: "scorecaster-web-event-detail-v1"
        }] })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Paper save failed");
      setMessage(tr({ fi: `Tallennettu paperiseurantaan: ${selected.selection} · ${money(paperStake)}. Oikeaa vetoa ei asetettu.`, en: `Saved to paper tracking: ${selected.selection} · ${money(paperStake)}. No real bet was placed.`, es: `Guardado en seguimiento simulado: ${selected.selection} · ${money(paperStake)}. No se realizó ninguna apuesta real.` }));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Paper save failed");
    } finally { setBusy(""); }
  }

  if (loading) return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-slate-300">{tr({ fi: "Varmennetaan ottelua…", en: "Verifying event…", es: "Verificando evento…" })}</div>;
  if (!detail) return <div className="space-y-4"><div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-5 text-red-100">{error || tr({ fi: "Ottelua ei löydy nykyisestä varmennetusta analyysistä.", en: "The event is not in the current verified analysis.", es: "El evento no está en el análisis verificado actual." })}</div><Link href="/" className="font-black text-emerald-300">← {tr({ fi: "Etusivulle", en: "Back home", es: "Volver al inicio" })}</Link></div>;

  const intelligence = detail.sportsIntelligence || {};
  const formRest = detail.formRestShadow || {};
  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.2),transparent_35%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-9">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200">Event Detail V1 · {detail.league}</div><button onClick={() => void load()} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-black">{tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button></div>
        <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">{detail.match}</h1>
        <p className="mt-3 text-lg text-slate-300">{kickoff} · {detail.fixtureSource}</p>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-400">{tr({ fi: "Ottelu ratkaistiin uudelleen palvelimen nykyisestä live-analyysistä. Puuttuvaa dataa ei täytetä arvauksilla, eikä tämä näkymä aseta oikean rahan vetoja.", en: "The event was resolved again from the server's current live analysis. Missing data is not filled with guesses, and this view does not place real-money bets.", es: "El evento se resolvió de nuevo desde el análisis en vivo actual del servidor. No se inventan datos faltantes ni se realizan apuestas con dinero real." })}</p>
      </section>

      {error && <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-100">{error} {/sign|auth|session/i.test(error) && <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link>}</div>}
      {message && <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-emerald-100">{message}</div>}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><h2 className="text-2xl font-black">{tr({ fi: "Markkina ja valinnat", en: "Market and selections", es: "Mercado y selecciones" })}</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{detail.selections.map((item) => <button key={item.id} onClick={() => setSelectedName(item.selection)} className={`rounded-2xl border p-4 text-left ${selected?.selection === item.selection ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-slate-950/60"}`}><div className="flex items-start justify-between gap-2"><div><div className="font-black">{item.selection}</div><div className="mt-1 text-3xl font-black">{decimal(item.odds)}</div></div><span className={`rounded-full border px-3 py-1 text-xs font-black ${tone(item.decision)}`}>{item.decision}</span></div><div className="mt-2 text-sm text-emerald-300">{item.bookmaker || tr({ fi: "Paras hinta", en: "Best price", es: "Mejor cuota" })}</div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300"><span>{tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} {percent(item.consensusProbability)}</span><span>Edge {percent(item.edge)}</span><span>EV {percent(item.ev)}</span><span>Trust {decimal(item.trustScore)}/100</span></div></button>)}</div></div>

          {selected && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black">{selected.selection}</h2><span className={`rounded-full border px-3 py-1 text-sm font-black ${tone(selected.decision)}`}>{selected.decision}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label={tr({ fi: "Nykykerroin", en: "Current odds", es: "Cuota actual" })} value={decimal(selected.odds)} /><Metric label={tr({ fi: "Reilu kerroin", en: "Fair odds", es: "Cuota justa" })} value={decimal(selected.fairOdds)} /><Metric label={tr({ fi: "PLAY-raja", en: "PLAY floor", es: "Límite PLAY" })} value={decimal(selected.priceGuard.minimumPlayOdds)} /><Metric label={tr({ fi: "Hintapuskuri", en: "Price buffer", es: "Margen de cuota" })} value={decimal(selected.priceGuard.buffer)} /></div><p className="mt-4 text-sm leading-6 text-slate-300">{selected.decisionReason || tr({ fi: "Päätös perustuu markkinakonsensukseen ja turvaportteihin.", en: "The decision is based on market consensus and safety gates.", es: "La decisión se basa en el consenso de mercado y filtros de seguridad." })}</p></div>}

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><h2 className="text-2xl font-black">Sports Intelligence</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label={tr({ fi: "Valmius", en: "Readiness", es: "Preparación" })} value={intelligence.readiness?.level || "market-only"} /><Metric label={tr({ fi: "Lähteitä", en: "Sources", es: "Fuentes" })} value={intelligence.sourceCount || 0} /><Metric label={tr({ fi: "Ristiriitoja", en: "Conflicts", es: "Conflictos" })} value={intelligence.conflicts?.length || 0} /></div><div className="mt-4 space-y-2">{(intelligence.evidence || []).length === 0 && <p className="text-sm text-slate-400">{tr({ fi: "Riippumatonta evidenssiä ei ole saatavilla. Markkinatodennäköisyys pysyy ainoana todennäköisyyslähteenä.", en: "Independent evidence is unavailable. Market probability remains the only probability source.", es: "No hay evidencia independiente. La probabilidad de mercado sigue siendo la única fuente." })}</p>}{(intelligence.evidence || []).map((item, index) => <div key={`${item.category}-${item.subject}-${index}`} className="rounded-xl bg-slate-950/60 p-3"><div className="font-black">{item.subject || item.category} · {item.status}</div><div className="mt-1 text-sm text-slate-300">{item.detail}</div><div className="mt-1 text-xs text-slate-500">{item.source} · {item.freshness}</div></div>)}</div>{(intelligence.readiness?.missing || []).length > 0 && <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-sm text-yellow-100">{tr({ fi: "Puuttuu", en: "Missing", es: "Falta" })}: {intelligence.readiness.missing.join(", ")}</div>}</div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><h2 className="text-2xl font-black">{tr({ fi: "Vire ja lepo · varjomalli", en: "Form and rest · shadow model", es: "Forma y descanso · modelo sombra" })}</h2><p className="mt-2 text-sm text-slate-400">{tr({ fi: "Varjomalli ei vaikuta PLAY-päätökseen, edgeen, EV:hen tai panokseen.", en: "The shadow model does not affect PLAY, edge, EV or stake.", es: "El modelo sombra no afecta PLAY, ventaja, EV ni importe." })}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label={tr({ fi: "Tila", en: "Status", es: "Estado" })} value={formRest.status || "unavailable"} /><Metric label={tr({ fi: "Markkina", en: "Market", es: "Mercado" })} value={percent(formRest.marketProbability)} /><Metric label="Shadow" value={percent(formRest.shadowProbability)} /><Metric label="Δ" value={percent(formRest.probabilityDelta)} /></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Metric label={detail.homeTeam} value={`${formRest.home?.sampleSize || 0} ${tr({ fi: "ottelua", en: "games", es: "partidos" })}`} note={`${tr({ fi: "lepo", en: "rest", es: "descanso" })} ${decimal(formRest.home?.restDays)} d · 7d ${formRest.home?.gamesLast7Days || 0}`} /><Metric label={detail.awayTeam} value={`${formRest.away?.sampleSize || 0} ${tr({ fi: "ottelua", en: "games", es: "partidos" })}`} note={`${tr({ fi: "lepo", en: "rest", es: "descanso" })} ${decimal(formRest.away?.restDays)} d · 7d ${formRest.away?.gamesLast7Days || 0}`} /></div></div>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-32 xl:self-start">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><h2 className="text-xl font-black">{tr({ fi: "Paperitoiminnot", en: "Paper actions", es: "Acciones simuladas" })}</h2><p className="mt-2 text-sm text-slate-400">{selected?.selection || "–"} · {decimal(selected?.odds)}</p><label className="mt-4 block text-sm font-bold text-slate-300">{tr({ fi: "Paperipanos (€)", en: "Paper stake (€)", es: "Importe simulado (€)" })}<input value={stake} onChange={(event) => setStake(event.target.value)} inputMode="decimal" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white" /></label>{maximumStake !== null && <div className="mt-2 text-xs text-slate-500">{tr({ fi: "Oma enimmäispanos", en: "Your maximum stake", es: "Tu importe máximo" })}: {money(maximumStake)}</div>}<div className="mt-4 space-y-2"><button onClick={() => void watch()} disabled={busy !== "" || !selected} className="w-full rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 font-black text-sky-200 disabled:opacity-50">{busy === "watch" ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Lisää seurantaan", en: "Add to watchlist", es: "Añadir a la lista" })}</button><button onClick={() => void savePaper()} disabled={busy !== "" || !selected || selected?.decision === "SKIP"} className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-black text-slate-950 disabled:opacity-40">{busy === "paper" ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Tallenna paperiseurantaan", en: "Save to paper tracking", es: "Guardar en seguimiento simulado" })}</button></div><div className="mt-4 text-xs leading-5 text-slate-500">{tr({ fi: "Ei talletusta, maksua, vedonvälittäjälinkkiä tai oikean rahan vetoa.", en: "No deposit, payment, bookmaker link or real-money bet.", es: "Sin depósito, pago, enlace a casa de apuestas ni apuesta con dinero real." })}</div></div>
          <Link href="/agent" className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center font-black">{tr({ fi: "Avaa Agent-portfolio", en: "Open Agent portfolio", es: "Abrir cartera Agent" })}</Link>
        </aside>
      </section>
    </div>
  );
}
