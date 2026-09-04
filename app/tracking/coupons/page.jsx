"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../components/LanguageProvider";
import { EmptyState, MetricTile, PageHero, SectionHeader } from "../../components/ProductUI";
import { getTrackedBets } from "../../../lib/tracking-storage";

const COUPON_STORAGE_KEY = "scorecaster_paper_coupons_v1";
const MAX_LEGS = 20;

function payloadOf(response) {
  return response.json().catch(() => ({}));
}

function normalizeStatus(value, result) {
  const status = String(value || "").toLowerCase();
  const outcome = String(result || "").toLowerCase();
  if (status === "won" || outcome === "win" || outcome === "won") return "won";
  if (status === "lost" || outcome === "loss" || outcome === "lost") return "lost";
  if (["push", "void"].includes(status) || ["push", "void"].includes(outcome)) return "push";
  return "open";
}

function normalizeCloudBet(bet = {}) {
  return {
    id: String(bet.id || ""),
    match: bet.match || [bet.home_team, bet.away_team].filter(Boolean).join(" – ") || "Paper pick",
    selection: bet.label || "—",
    odds: Number(bet.odds || 0),
    market: bet.market || "h2h",
    sport: bet.sport || null,
    league: bet.league || null,
    bookmaker: bet.bookmaker || null,
    edge: bet.edge,
    ev: bet.ev,
    confidence: bet.confidence,
    commenceTime: bet.commence_time || null,
    status: normalizeStatus(bet.status, bet.result),
    createdAt: bet.created_at || null
  };
}

function normalizeLocalBet(bet = {}) {
  return {
    id: String(bet.id || ""),
    match: bet.match || [bet.homeTeam, bet.awayTeam].filter(Boolean).join(" – ") || "Paper pick",
    selection: bet.selection || bet.label || "—",
    odds: Number(bet.odds || 0),
    market: bet.market || "h2h",
    sport: bet.sportKey || bet.sport || null,
    league: bet.league || null,
    bookmaker: bet.bookmaker || null,
    edge: bet.edge,
    ev: bet.ev,
    confidence: bet.confidence,
    commenceTime: bet.commenceTime || bet.commence_time || null,
    status: normalizeStatus(bet.status, bet.result),
    createdAt: bet.createdAt || bet.created_at || null
  };
}

function readCoupons() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(COUPON_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCoupons(coupons) {
  if (typeof window === "undefined") return;
  localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(coupons));
}

function statusClasses(status) {
  if (status === "won") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-200";
  if (status === "lost") return "border-rose-300/30 bg-rose-300/10 text-rose-200";
  if (status === "push") return "border-sky-300/30 bg-sky-300/10 text-sky-200";
  return "border-amber-300/30 bg-amber-300/10 text-amber-200";
}

function deriveCouponStatus(legs) {
  if (legs.some((leg) => leg.status === "lost")) return "lost";
  if (legs.some((leg) => leg.status === "open")) return "open";
  if (legs.length > 0 && legs.every((leg) => leg.status === "push")) return "push";
  return legs.length ? "won" : "open";
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

export default function PaperCouponsPage() {
  const { tr, locale } = useLanguage();
  const [bets, setBets] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [stake, setStake] = useState("10");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sourceMode, setSourceMode] = useState("loading");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const currency = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }), [locale]);
  const decimal = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }), [locale]);
  const money = (value) => currency.format(Number(value || 0));
  const metricPercent = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)} %` : "—";

  const statusLabel = (status) => status === "won"
    ? tr({ fi: "Oikein", en: "Won", es: "Acertado" })
    : status === "lost"
      ? tr({ fi: "Ei osunut", en: "Lost", es: "Fallado" })
      : status === "push"
        ? tr({ fi: "Palautus", en: "Push", es: "Nulo" })
        : tr({ fi: "Avoin", en: "Open", es: "Abierto" });

  const couponStatusLabel = (status) => status === "won"
    ? tr({ fi: "Voitto", en: "Won", es: "Ganado" })
    : status === "lost"
      ? tr({ fi: "Ei osunut", en: "Lost", es: "Fallado" })
      : status === "push"
        ? tr({ fi: "Palautus", en: "Push", es: "Nulo" })
        : tr({ fi: "Avoin", en: "Open", es: "Abierto" });

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    let nextBets = [];
    let nextMode = "local";
    try {
      const response = await fetch("/api/cloud/bets", { cache: "no-store" });
      const payload = await payloadOf(response);
      if (response.ok && payload.ok !== false) {
        nextBets = (payload.data || []).map(normalizeCloudBet);
        nextMode = "cloud";
      } else if (response.status === 401) {
        nextBets = getTrackedBets().map(normalizeLocalBet);
      } else {
        throw new Error(payload.error || "Paper picks could not be loaded");
      }
    } catch (cause) {
      nextBets = getTrackedBets().map(normalizeLocalBet);
      nextMode = "local";
      if (!nextBets.length) setError(cause instanceof Error ? cause.message : "Paper picks could not be loaded");
    }

    const currentCoupons = readCoupons();
    const betById = new Map(nextBets.map((bet) => [bet.id, bet]));
    let changed = false;
    const refreshedCoupons = currentCoupons.map((coupon) => ({
      ...coupon,
      legs: (coupon.legs || []).map((leg) => {
        const current = betById.get(String(leg.sourceBetId || ""));
        if (!current) return leg;
        const updated = {
          ...leg,
          status: current.status,
          edge: current.edge,
          ev: current.ev,
          confidence: current.confidence,
          commenceTime: current.commenceTime || leg.commenceTime || null
        };
        if (JSON.stringify(updated) !== JSON.stringify(leg)) changed = true;
        return updated;
      })
    }));
    if (changed) saveCoupons(refreshedCoupons);
    setBets(nextBets);
    setCoupons(refreshedCoupons);
    setSourceMode(nextMode);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const openBets = useMemo(() => bets.filter((bet) => bet.status === "open" && bet.odds > 1).slice(0, 100), [bets]);
  const selectedBets = useMemo(() => selectedIds.map((id) => openBets.find((bet) => bet.id === id)).filter(Boolean), [selectedIds, openBets]);
  const totalOdds = useMemo(() => selectedBets.reduce((product, bet) => product * Number(bet.odds || 1), 1), [selectedBets]);
  const parsedStake = Number(String(stake).replace(",", "."));
  const potentialReturn = Number.isFinite(parsedStake) && parsedStake > 0 ? parsedStake * totalOdds : 0;

  const hydratedCoupons = useMemo(() => coupons.map((coupon) => {
    const legs = Array.isArray(coupon.legs) ? coupon.legs : [];
    const status = deriveCouponStatus(legs);
    const stakeValue = Number(coupon.stake || 0);
    const settledMultiplier = legs.reduce((product, leg) => leg.status === "push" ? product : product * Number(leg.odds || 1), 1);
    const returnValue = status === "lost" ? 0 : status === "push" ? stakeValue : status === "won" ? stakeValue * settledMultiplier : Number(coupon.potentialReturn || 0);
    return { ...coupon, legs, status, currentReturn: round(returnValue), currentProfit: round(returnValue - stakeValue) };
  }), [coupons]);

  const summary = useMemo(() => ({
    open: hydratedCoupons.filter((coupon) => coupon.status === "open").length,
    won: hydratedCoupons.filter((coupon) => coupon.status === "won").length,
    lost: hydratedCoupons.filter((coupon) => coupon.status === "lost").length,
    result: hydratedCoupons.reduce((sum, coupon) => coupon.status === "open" ? sum : sum + coupon.currentProfit, 0)
  }), [hydratedCoupons]);

  function toggleBet(bet) {
    setError("");
    setMessage("");
    setSelectedIds((current) => {
      if (current.includes(bet.id)) return current.filter((id) => id !== bet.id);
      if (current.length >= MAX_LEGS) return current;
      if (current.some((id) => openBets.find((candidate) => candidate.id === id)?.match === bet.match)) {
        setError(tr({ fi: "Yhdelle ottelulle voi olla kupongissa vain yksi valinta.", en: "A coupon can contain only one selection from the same match.", es: "Un cupón solo puede contener una selección del mismo partido." }));
        return current;
      }
      return [...current, bet.id];
    });
  }

  function createCoupon() {
    if (selectedBets.length < 2) {
      setError(tr({ fi: "Valitse vähintään kaksi avointa paperikohdetta.", en: "Select at least two open paper picks.", es: "Selecciona al menos dos pronósticos abiertos." }));
      return;
    }
    if (!Number.isFinite(parsedStake) || parsedStake < 0.1) {
      setError(tr({ fi: "Anna kelvollinen paperipanos.", en: "Enter a valid paper stake.", es: "Introduce un importe simulado válido." }));
      return;
    }

    setBusy(true);
    const coupon = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      stake: round(parsedStake),
      totalOdds: round(totalOdds, 6),
      potentialReturn: round(parsedStake * totalOdds),
      potentialProfit: round(parsedStake * totalOdds - parsedStake),
      legs: selectedBets.map((bet) => ({
        sourceBetId: bet.id,
        match: bet.match,
        selection: bet.selection,
        odds: bet.odds,
        market: bet.market,
        sport: bet.sport,
        league: bet.league,
        bookmaker: bet.bookmaker,
        edge: bet.edge,
        ev: bet.ev,
        confidence: bet.confidence,
        commenceTime: bet.commenceTime,
        status: bet.status
      }))
    };
    const next = [coupon, ...readCoupons()].slice(0, 100);
    saveCoupons(next);
    setCoupons(next);
    setSelectedIds([]);
    setMessage(tr({ fi: "Paperikuponki luotiin tälle laitteelle. Kohteiden tilat päivittyvät My Picks -tuloksista.", en: "Paper coupon created on this device. Leg status follows My Picks results.", es: "Cupón simulado creado en este dispositivo. El estado sigue los resultados de Mis apuestas." }));
    setBusy(false);
  }

  function deleteCoupon(id) {
    if (!window.confirm(tr({ fi: "Poistetaanko tämä paperikuponki? Yksittäisiä paperikohteita ei poisteta.", en: "Delete this paper coupon? The underlying paper picks are kept.", es: "¿Eliminar este cupón simulado? Los pronósticos se conservarán." }))) return;
    const next = readCoupons().filter((coupon) => coupon.id !== id);
    saveCoupons(next);
    setCoupons(next);
    setMessage(tr({ fi: "Paperikuponki poistettiin.", en: "Paper coupon deleted.", es: "Cupón simulado eliminado." }));
  }

  const heroAside = <div className="grid grid-cols-2 gap-2"><MetricTile compact label={tr({ fi: "Avoinna", en: "Open", es: "Abiertos" })} value={summary.open} tone="yellow" /><MetricTile compact label={tr({ fi: "Voitot", en: "Wins", es: "Ganados" })} value={summary.won} tone="green" /><MetricTile compact label={tr({ fi: "Ei osunut", en: "Lost", es: "Fallados" })} value={summary.lost} tone="red" /><MetricTile compact label={tr({ fi: "Paperitulos", en: "Paper result", es: "Resultado" })} value={money(summary.result)} tone={summary.result >= 0 ? "green" : "red"} /></div>;

  return (
    <div className="space-y-7">
      <PageHero eyebrow={tr({ fi: "Paperikupongit", en: "Paper coupons", es: "Cupones simulados" })} title={tr({ fi: "Yhdistelmäkuponki Scorecasterin analytiikalla", en: "Accumulator tickets with Scorecaster analytics", es: "Cupones combinados con analítica de Scorecaster" })} description={tr({ fi: "Yhdistä My Picksiin tallennettuja paperikohteita, näe kokonaiskerroin ja seuraa jokaista riviä tiloilla Oikein / Avoin / Ei osunut. Kuponki ei aseta oikean rahan vetoa.", en: "Combine My Picks paper selections, see combined odds and follow each leg as Won / Open / Lost. Coupons never place real-money bets.", es: "Combina pronósticos de Mis apuestas, consulta la cuota total y sigue cada selección. Los cupones nunca realizan apuestas con dinero real." })} actions={<><Link href="/events" className="sc-button-primary">{tr({ fi: "Lisää paperikohteita", en: "Add paper picks", es: "Añadir pronósticos" })}</Link><button type="button" onClick={() => void refresh()} disabled={loading || busy} className="sc-button-secondary disabled:opacity-50">{tr({ fi: "Päivitä tulokset", en: "Refresh results", es: "Actualizar resultados" })}</button></>} aside={heroAside} />

      <div className="rounded-2xl border border-sky-300/25 bg-sky-300/10 p-4 text-sm leading-6 text-sky-100"><strong>PAPER ONLY.</strong> {tr({ fi: "Kuponki tallennetaan tässä versiossa vain tälle laitteelle. Kohteet tulevat kirjautuneena suojatulta käyttäjätililtä ja muuten paikallisesta paperihistoriasta. Yksikin hävinnyt kohde kaataa yhdistelmän.", en: "This version stores the coupon on this device only. When signed in, legs come from the protected account; otherwise they use local paper history. One losing leg loses the accumulator.", es: "Esta versión guarda el cupón solo en este dispositivo. Con sesión iniciada usa pronósticos protegidos; de lo contrario usa el historial local. Una selección fallada pierde la combinada." })}</div>
      <div className="text-xs text-[var(--sc-faint)]">{tr({ fi: "Kohdelähde", en: "Pick source", es: "Fuente" })}: {sourceMode === "cloud" ? tr({ fi: "suojattu käyttäjätili", en: "protected user account", es: "cuenta protegida" }) : sourceMode === "local" ? tr({ fi: "paikallinen paperihistoria", en: "local paper history", es: "historial local" }) : tr({ fi: "tarkistetaan", en: "checking", es: "comprobando" })}</div>

      {error ? <div role="alert" className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</div> : null}
      {message ? <div aria-live="polite" className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100">{message}</div> : null}

      <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 shadow-xl md:p-6">
        <SectionHeader eyebrow={tr({ fi: "Uusi kuponki", en: "New coupon", es: "Nuevo cupón" })} title={tr({ fi: "Valitse 2–20 avointa kohdetta", en: "Choose 2–20 open picks", es: "Elige 2–20 pronósticos abiertos" })} description={tr({ fi: "Samasta ottelusta voi olla vain yksi valinta. Kokonaiskerroin ja mahdollinen paperipalautus lasketaan heti.", en: "Only one selection per match is allowed. Combined odds and potential paper return update instantly.", es: "Solo se permite una selección por partido. La cuota total y el retorno se calculan al instante." })} />

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_270px]">
          <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
            {loading ? <div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" /> : openBets.length === 0 ? <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 text-sm text-[var(--sc-muted)]">{tr({ fi: "Avoimia paperikohteita ei ole. Lisää ensin kohde Ottelut-näkymästä.", en: "There are no open paper picks. Add one from Matches first.", es: "No hay pronósticos abiertos. Añade uno desde Partidos." })}</div> : openBets.map((bet) => {
              const selected = selectedIds.includes(bet.id);
              const duplicateMatch = !selected && selectedBets.some((candidate) => candidate.match === bet.match);
              return <button type="button" key={bet.id} onClick={() => toggleBet(bet)} disabled={duplicateMatch || (!selected && selectedIds.length >= MAX_LEGS)} className={`w-full rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)]" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] hover:border-[var(--sc-brand-border)]"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-black text-[var(--sc-text)]">{bet.match}</div><div className="mt-1 text-sm text-[var(--sc-text-secondary)]"><strong>{bet.selection}</strong> @ {decimal.format(bet.odds)}</div><div className="mt-1 truncate text-xs text-[var(--sc-faint)]">{[bet.league, bet.market, bet.bookmaker].filter(Boolean).join(" · ") || "Paper pick"}</div></div><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-black ${selected ? "border-[var(--sc-brand-border)] bg-[var(--sc-brand)] text-[var(--sc-brand-ink)]" : "border-[var(--sc-border)] text-[var(--sc-muted)]"}`}>{selected ? "✓" : "+"}</span></div></button>;
            })}
          </div>

          <aside className="h-fit rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 lg:sticky lg:top-24">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Kuponki", en: "Coupon", es: "Cupón" })}</div>
            <div className="mt-3 flex items-end justify-between gap-3"><span className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Kohteita", en: "Legs", es: "Selecciones" })}</span><strong className="text-lg text-[var(--sc-text)]">{selectedIds.length}</strong></div>
            <div className="mt-2 flex items-end justify-between gap-3"><span className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Kokonaiskerroin", en: "Combined odds", es: "Cuota total" })}</span><strong className="text-lg text-[var(--sc-text)]">{selectedIds.length ? decimal.format(totalOdds) : "—"}</strong></div>
            <label className="mt-4 block text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{tr({ fi: "Paperipanos", en: "Paper stake", es: "Importe simulado" })}<input value={stake} onChange={(event) => setStake(event.target.value)} inputMode="decimal" className="mt-2 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-bg)] px-3 py-3 text-lg font-black text-[var(--sc-text)]" /></label>
            <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3"><div className="text-xs font-bold text-emerald-200">{tr({ fi: "Mahdollinen paperipalautus", en: "Potential paper return", es: "Retorno simulado potencial" })}</div><div className="mt-1 text-2xl font-black text-emerald-100">{money(potentialReturn)}</div></div>
            <button type="button" onClick={createCoupon} disabled={busy || selectedIds.length < 2} className="sc-button-primary mt-4 w-full justify-center disabled:opacity-40">{tr({ fi: "Luo paperikuponki", en: "Create paper coupon", es: "Crear cupón simulado" })}</button>
          </aside>
        </div>
      </section>

      <section>
        <SectionHeader eyebrow={tr({ fi: "Kuponkihistoria", en: "Coupon history", es: "Historial de cupones" })} title={tr({ fi: "Oikein, avoin vai ei osunut", en: "Won, open or lost", es: "Acertado, abierto o fallado" })} description={tr({ fi: "Kuponkirivit seuraavat My Picks -kohteiden tuloksia. Paina Päivitä tulokset, jotta tuoreimmat ratkaisut tulevat kuponkiin.", en: "Coupon legs follow My Picks results. Use Refresh results to pull the latest settlement state.", es: "Las selecciones siguen los resultados de Mis apuestas. Usa Actualizar resultados para obtener el estado más reciente." })} />

        {loading ? <div className="mt-5 h-52 animate-pulse rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)]" /> : hydratedCoupons.length === 0 ? <div className="mt-5"><EmptyState title={tr({ fi: "Ei vielä paperikuponkeja", en: "No paper coupons yet", es: "Aún no hay cupones simulados" })} description={tr({ fi: "Valitse vähintään kaksi avointa paperikohdetta yllä ja luo ensimmäinen yhdistelmä.", en: "Choose at least two open paper picks above to create the first accumulator.", es: "Elige al menos dos pronósticos abiertos para crear la primera combinada." })} /></div> : <div className="mt-5 space-y-5">{hydratedCoupons.map((coupon) => <article key={coupon.id} className="overflow-hidden rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] shadow-xl"><header className="border-b border-[var(--sc-border)] p-5 md:p-6"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClasses(coupon.status)}`}>{couponStatusLabel(coupon.status)}</span><span className="text-xs text-[var(--sc-faint)]">{coupon.createdAt ? new Date(coupon.createdAt).toLocaleString(locale) : "—"}</span></div><h2 className="mt-3 text-xl font-black text-[var(--sc-text)]">{tr({ fi: `${coupon.legs.length} kohteen yhdistelmä`, en: `${coupon.legs.length}-leg accumulator`, es: `Combinada de ${coupon.legs.length} selecciones` })}</h2></div><button type="button" onClick={() => deleteCoupon(coupon.id)} className="sc-button-ghost shrink-0">{tr({ fi: "Poista kuponki", en: "Delete coupon", es: "Eliminar cupón" })}</button></div><div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4"><MetricTile compact label={tr({ fi: "Paperipanos", en: "Paper stake", es: "Importe" })} value={money(coupon.stake)} tone="purple" /><MetricTile compact label={tr({ fi: "Kokonaiskerroin", en: "Combined odds", es: "Cuota total" })} value={decimal.format(Number(coupon.totalOdds || 1))} tone="blue" /><MetricTile compact label={tr({ fi: "Mahd. palautus", en: "Potential return", es: "Retorno potencial" })} value={money(coupon.potentialReturn)} tone="green" /><MetricTile compact label={coupon.status === "open" ? tr({ fi: "Jos kaikki osuvat", en: "If all win", es: "Si todas aciertan" }) : tr({ fi: "Paperitulos", en: "Paper result", es: "Resultado" })} value={coupon.status === "open" ? money(coupon.potentialProfit) : money(coupon.currentProfit)} tone={coupon.status === "lost" ? "red" : "green"} /></div></header><div className="divide-y divide-[var(--sc-border)]">{coupon.legs.map((leg, index) => <div key={`${coupon.id}-${leg.sourceBetId}-${index}`} className="grid gap-3 p-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center md:p-5"><div className="text-sm font-black text-[var(--sc-faint)]">{index + 1}.</div><div className="min-w-0"><div className="font-black text-[var(--sc-text)]">{leg.match}</div><div className="mt-1 text-xs text-[var(--sc-faint)]">{[leg.league, leg.market].filter(Boolean).join(" · ") || "Paper pick"}</div><div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-lg border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-2.5 py-1 text-sm font-black text-[var(--sc-text)]">{leg.selection}</span><span className="rounded-lg border border-[var(--sc-border)] px-2.5 py-1 text-sm font-black text-[var(--sc-text-secondary)]">{decimal.format(Number(leg.odds || 0))}</span></div><details className="mt-3 text-xs text-[var(--sc-muted)]"><summary className="cursor-pointer font-bold">{tr({ fi: "Scorecaster-data", en: "Scorecaster data", es: "Datos de Scorecaster" })}</summary><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1"><span>Edge {metricPercent(leg.edge)}</span><span>EV {metricPercent(leg.ev)}</span><span>{tr({ fi: "Varmuus", en: "Confidence", es: "Confianza" })} {metricPercent(leg.confidence)}</span>{leg.commenceTime ? <span>{new Date(leg.commenceTime).toLocaleString(locale)}</span> : null}</div></details></div><div className={`justify-self-start rounded-full border px-3 py-1 text-sm font-black sm:justify-self-end ${statusClasses(leg.status)}`}>{leg.status === "won" ? "✓ " : ""}{statusLabel(leg.status)}</div></div>)}</div><footer className="border-t border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-5 py-3 text-xs text-[var(--sc-faint)]">{tr({ fi: "Scorecaster-paperikuponki · tallennettu tälle laitteelle", en: "Scorecaster paper coupon · stored on this device", es: "Cupón simulado Scorecaster · guardado en este dispositivo" })} · {coupon.id}</footer></article>)}</div>}
      </section>
    </div>
  );
}
