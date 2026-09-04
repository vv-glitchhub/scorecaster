"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { externalSlipProgress } from "../../lib/external-slip-v1.mjs";

function newLeg(index = 0) {
  return {
    id: `leg-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    match: "",
    market: "Voittaja (1X2)",
    selection: "",
    odds: "",
    status: "open"
  };
}

function freshDraft() {
  return {
    provider: "Veikkaus",
    externalReference: "",
    title: "Kuponki",
    currency: "EUR",
    stake: "",
    combinedOdds: "",
    potentialReturn: "",
    purchasedAt: "",
    resolvesAt: "",
    legs: [newLeg(0)]
  };
}

function normalizeSlip(row = {}) {
  return {
    id: row.id,
    provider: row.provider || "manual",
    externalReference: row.external_reference || "",
    title: row.title || "External slip",
    currency: row.currency || "EUR",
    stake: row.stake,
    combinedOdds: Number(row.combined_odds || 0),
    potentialReturn: row.potential_return,
    purchasedAt: row.purchased_at,
    resolvesAt: row.resolves_at,
    status: row.status || "open",
    legs: Array.isArray(row.legs) ? row.legs : [],
    source: row.source || "manual",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function payloadOf(response) {
  return response.json().catch(() => ({}));
}

export default function ExternalSlipTracker({ tr, locale }) {
  const [slips, setSlips] = useState([]);
  const [draft, setDraft] = useState(() => freshDraft());
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cloud/external-slips", { cache: "no-store" });
      const payload = await payloadOf(response);
      if (response.status === 401) {
        setSignedOut(true);
        setSlips([]);
        return;
      }
      if (!response.ok || !payload.ok) throw new Error(payload.error || "External slips could not be loaded");
      setSignedOut(false);
      setSlips((payload.data || []).map(normalizeSlip));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "External slips could not be loaded");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const currencyFormatter = useMemo(() => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  }), [locale]);

  function money(value, currency = "EUR") {
    if (value === null || value === undefined || value === "") return "—";
    if (currency === "EUR") return currencyFormatter.format(Number(value || 0));
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(value || 0));
    } catch {
      return `${Number(value || 0).toFixed(2)} ${currency}`;
    }
  }

  const legStatusLabel = (status) => status === "won"
    ? tr({ fi: "✓ Oikein", en: "✓ Correct", es: "✓ Correcto" })
    : status === "lost"
      ? tr({ fi: "Ei osunut", en: "Missed", es: "Falló" })
      : status === "void"
        ? tr({ fi: "Mitätöity", en: "Void", es: "Anulado" })
        : status === "push"
          ? tr({ fi: "Palautus", en: "Push", es: "Nulo" })
          : tr({ fi: "Avoin", en: "Open", es: "Abierto" });

  const slipStatusLabel = (status) => status === "won"
    ? tr({ fi: "Voitettu", en: "Won", es: "Ganado" })
    : status === "lost"
      ? tr({ fi: "Ei osunut", en: "Lost", es: "Perdido" })
      : status === "void"
        ? tr({ fi: "Mitätöity", en: "Void", es: "Anulado" })
        : tr({ fi: "Avoin", en: "Open", es: "Abierto" });

  function statusClass(status) {
    if (status === "won") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
    if (status === "lost") return "border-rose-300/30 bg-rose-300/10 text-rose-100";
    if (["void", "push"].includes(status)) return "border-sky-300/30 bg-sky-300/10 text-sky-100";
    return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateDraftLeg(index, field, value) {
    setDraft((current) => ({
      ...current,
      legs: current.legs.map((leg, legIndex) => legIndex === index ? { ...leg, [field]: value } : leg)
    }));
  }

  function addDraftLeg() {
    setDraft((current) => current.legs.length >= 50
      ? current
      : { ...current, legs: [...current.legs, newLeg(current.legs.length)] });
  }

  function removeDraftLeg(index) {
    setDraft((current) => current.legs.length <= 1
      ? current
      : { ...current, legs: current.legs.filter((_, legIndex) => legIndex !== index) });
  }

  async function saveDraft(event) {
    event.preventDefault();
    setBusy("create"); setMessage(""); setError("");
    try {
      const response = await fetch("/api/cloud/external-slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, source: "external-slip-manual-v1" })
      });
      const payload = await payloadOf(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "External slip could not be saved");
      setSlips((current) => [normalizeSlip(payload.data), ...current]);
      setDraft(freshDraft());
      setShowForm(false);
      setMessage(tr({ fi: "Kuponki tallennettiin seurantaan. Se ei vaikuta paperikassaan tai panossuosituksiin.", en: "Slip saved for tracking. It does not affect the paper bankroll or stake recommendations.", es: "El cupón se guardó para seguimiento. No afecta a la banca simulada ni a las recomendaciones." }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "External slip could not be saved");
    } finally {
      setBusy("");
    }
  }

  async function updateLegStatus(slip, legId, status) {
    setBusy(slip.id); setMessage(""); setError("");
    const legs = slip.legs.map((leg) => leg.id === legId ? { ...leg, status } : leg);
    try {
      const response = await fetch("/api/cloud/external-slips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: slip.id, legs })
      });
      const payload = await payloadOf(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Slip status could not be updated");
      const updated = normalizeSlip(payload.data);
      setSlips((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Slip status could not be updated");
    } finally {
      setBusy("");
    }
  }

  async function removeSlip(id) {
    if (!window.confirm(tr({ fi: "Poistetaanko tämä ulkoinen kuponki Scorecasterin seurannasta? Tämä ei peru ulkopuolella tehtyä vetoa.", en: "Remove this external slip from Scorecaster tracking? This does not cancel anything placed elsewhere.", es: "¿Eliminar este cupón externo del seguimiento? Esto no cancela ninguna apuesta realizada fuera." }))) return;
    setBusy(id); setMessage(""); setError("");
    try {
      const response = await fetch("/api/cloud/external-slips", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const payload = await payloadOf(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "External slip could not be deleted");
      setSlips((current) => current.filter((item) => item.id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "External slip could not be deleted");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="space-y-5" data-external-slip-tracker="v1">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="max-w-3xl">
          <div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">{tr({ fi: "Kuponkiseuranta", en: "Slip tracking", es: "Seguimiento de cupón" })}</div>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">{tr({ fi: "Seuraa myös muualla tehtyä yhdistelmäkuponkia", en: "Track an accumulator created elsewhere", es: "Sigue un cupón combinado creado fuera" })}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{tr({ fi: "Tallenna kokonaiskerroin, mahdollinen palautus ja jokainen kohde. Näet Oikein / Avoin / Ei osunut -tilat samalla tavalla kuin vedonvälittäjän kuitissa.", en: "Save total odds, potential return and every leg. Correct / Open / Missed states stay visible like on a bookmaker receipt.", es: "Guarda la cuota total, retorno potencial y cada selección. Verás Correcto / Abierto / Falló como en el recibo." })}</p>
        </div>
        {!signedOut ? <button type="button" onClick={() => setShowForm((value) => !value)} className="sc-button-primary shrink-0">{showForm ? tr({ fi: "Sulje", en: "Close", es: "Cerrar" }) : tr({ fi: "+ Lisää kuponki", en: "+ Add slip", es: "+ Añadir cupón" })}</button> : null}
      </div>

      <div className="rounded-2xl border border-sky-300/25 bg-sky-300/10 p-4 text-sm leading-6 text-sky-100">
        <strong>{tr({ fi: "Raja:", en: "Boundary:", es: "Límite:" })}</strong> {tr({ fi: "Tämä on vain ulkoisen kupongin kirjanpitoa. Scorecaster ei kirjaudu vedonvälittäjälle, aseta vetoa tai siirrä rahaa. Kuponki ei vaikuta virtuaaliseen paperikassaan, Kelly-panokseen, ROI/CLV-mittareihin tai autonomiseen agenttiin.", en: "This is reference-only tracking for an external slip. Scorecaster does not sign in to a bookmaker, place a bet or move money. The slip is excluded from the virtual paper bankroll, Kelly staking, ROI/CLV metrics and the autonomous agent.", es: "Esto es solo seguimiento informativo de un cupón externo. Scorecaster no inicia sesión, apuesta ni mueve dinero. El cupón queda fuera de la banca simulada, Kelly, ROI/CLV y el agente autónomo." })}
      </div>

      {signedOut ? <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">{tr({ fi: "Kirjaudu sisään, jotta ulkoiset kupongit tallentuvat suojatusti tilillesi ja näkyvät kaikilla laitteilla.", en: "Sign in to store external slips securely on your account and access them on every device.", es: "Inicia sesión para guardar los cupones de forma segura y verlos en todos tus dispositivos." })}</div> : null}
      {error ? <div role="alert" className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</div> : null}
      {message ? <div aria-live="polite" className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100">{message}</div> : null}

      {showForm && !signedOut ? <form onSubmit={saveDraft} className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Vedonvälittäjä", en: "Provider", es: "Proveedor" })}<input value={draft.provider} onChange={(event) => updateDraft("provider", event.target.value)} maxLength={120} required className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Pelin / kupongin numero", en: "Slip reference", es: "Referencia" })}<input value={draft.externalReference} onChange={(event) => updateDraft("externalReference", event.target.value)} maxLength={180} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Ostopäivä", en: "Purchased", es: "Comprado" })}<input type="date" value={draft.purchasedAt} onChange={(event) => updateDraft("purchasedAt", event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Ratkeaa viimeistään", en: "Resolves by", es: "Se resuelve" })}<input type="date" value={draft.resolvesAt} onChange={(event) => updateDraft("resolvesAt", event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Kokonaiskerroin", en: "Total odds", es: "Cuota total" })}<input inputMode="decimal" value={draft.combinedOdds} onChange={(event) => updateDraft("combinedOdds", event.target.value)} placeholder={tr({ fi: "esim. 72,17", en: "e.g. 72.17", es: "p. ej. 72,17" })} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Panos (valinnainen)", en: "Stake (optional)", es: "Importe (opcional)" })}<input inputMode="decimal" value={draft.stake} onChange={(event) => updateDraft("stake", event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Mahdollinen palautus", en: "Potential return", es: "Retorno potencial" })}<input inputMode="decimal" value={draft.potentialReturn} onChange={(event) => updateDraft("potentialReturn", event.target.value)} placeholder={tr({ fi: "esim. 3117,60", en: "e.g. 3117.60", es: "p. ej. 3117,60" })} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Nimi", en: "Title", es: "Título" })}<input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} maxLength={180} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3"><h3 className="font-black text-white">{tr({ fi: "Valitut kohteet", en: "Selected legs", es: "Selecciones" })}</h3><button type="button" onClick={addDraftLeg} className="sc-button-secondary">{tr({ fi: "+ Kohde", en: "+ Leg", es: "+ Selección" })}</button></div>
          {draft.legs.map((leg, index) => <div key={leg.id} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 lg:grid-cols-[48px_1.6fr_1fr_1fr_110px_auto] lg:items-end">
            <div className="text-xl font-black text-slate-500">{index + 1}.</div>
            <label className="text-xs font-bold text-slate-400">{tr({ fi: "Ottelu", en: "Match", es: "Partido" })}<input value={leg.match} onChange={(event) => updateDraftLeg(index, "match", event.target.value)} maxLength={240} required className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white" /></label>
            <label className="text-xs font-bold text-slate-400">{tr({ fi: "Markkina", en: "Market", es: "Mercado" })}<input value={leg.market} onChange={(event) => updateDraftLeg(index, "market", event.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white" /></label>
            <label className="text-xs font-bold text-slate-400">{tr({ fi: "Oma merkki", en: "Selection", es: "Selección" })}<input value={leg.selection} onChange={(event) => updateDraftLeg(index, "selection", event.target.value)} maxLength={180} required className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white" /></label>
            <label className="text-xs font-bold text-slate-400">{tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })}<input inputMode="decimal" value={leg.odds} onChange={(event) => updateDraftLeg(index, "odds", event.target.value)} required className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white" /></label>
            <button type="button" onClick={() => removeDraftLeg(index)} disabled={draft.legs.length <= 1} className="min-h-11 rounded-xl border border-rose-300/20 px-3 text-sm font-black text-rose-200 disabled:opacity-30">{tr({ fi: "Poista", en: "Remove", es: "Quitar" })}</button>
          </div>)}
        </div>

        <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy !== ""} className="sc-button-primary disabled:opacity-50">{busy === "create" ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Tallenna kuponki", en: "Save slip", es: "Guardar cupón" })}</button><button type="button" onClick={() => { setDraft(freshDraft()); setShowForm(false); }} className="sc-button-ghost">{tr({ fi: "Peruuta", en: "Cancel", es: "Cancelar" })}</button></div>
      </form> : null}

      {loading ? <div className="h-44 animate-pulse rounded-3xl border border-white/10 bg-white/[0.035]" /> : !signedOut && slips.length === 0 ? <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center"><div className="text-lg font-black text-white">{tr({ fi: "Ei vielä ulkoisia kuponkeja", en: "No external slips yet", es: "Aún no hay cupones externos" })}</div><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{tr({ fi: "Lisää esimerkiksi Veikkauksessa tehty kuponki seurantaan. Kohteet pysyvät erillään Scorecasterin paperivedoista.", en: "Add a slip created at a bookmaker for reference tracking. Its legs stay separate from Scorecaster paper bets.", es: "Añade un cupón de una casa de apuestas para seguimiento. Queda separado de las apuestas simuladas." })}</p></div> : null}

      <div className="space-y-5">
        {slips.map((slip) => {
          const progress = externalSlipProgress(slip.legs);
          return <article key={slip.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
            <div className="border-b border-white/10 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div><div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{slip.provider}</div><h3 className="mt-1 text-xl font-black text-white">{slip.title}</h3>{slip.externalReference ? <div className="mt-1 text-xs text-slate-500">{tr({ fi: "Pelin numero", en: "Slip reference", es: "Referencia" })}: {slip.externalReference}</div> : null}</div>
                <span className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-black ${statusClass(slip.status)}`}>{slipStatusLabel(slip.status)}</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-950/45 p-3"><div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{tr({ fi: "Kokonaiskerroin", en: "Total odds", es: "Cuota total" })}</div><div className="mt-1 text-xl font-black text-white">{slip.combinedOdds ? slip.combinedOdds.toLocaleString(locale, { maximumFractionDigits: 4 }) : "—"}</div></div>
                <div className="rounded-2xl bg-slate-950/45 p-3"><div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{tr({ fi: "Panos", en: "Stake", es: "Importe" })}</div><div className="mt-1 text-xl font-black text-white">{money(slip.stake, slip.currency)}</div></div>
                <div className="rounded-2xl bg-slate-950/45 p-3"><div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{tr({ fi: "Mahdollinen palautus", en: "Potential return", es: "Retorno potencial" })}</div><div className="mt-1 text-xl font-black text-white">{money(slip.potentialReturn, slip.currency)}</div></div>
                <div className="rounded-2xl bg-slate-950/45 p-3"><div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{tr({ fi: "Kohteet", en: "Legs", es: "Selecciones" })}</div><div className="mt-1 text-xl font-black text-white">{progress.won}/{progress.total} <span className="text-sm font-bold text-slate-500">{tr({ fi: "oikein", en: "correct", es: "correctas" })}</span></div></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">{slip.purchasedAt ? <span>{tr({ fi: "Ostettu", en: "Purchased", es: "Comprado" })} {new Date(slip.purchasedAt).toLocaleString(locale)}</span> : null}{slip.resolvesAt ? <span>{tr({ fi: "Ratkeaa", en: "Resolves", es: "Se resuelve" })} {new Date(slip.resolvesAt).toLocaleDateString(locale)}</span> : null}<span>{progress.open} {tr({ fi: "avoinna", en: "open", es: "abiertas" })}</span>{progress.lost ? <span>{progress.lost} {tr({ fi: "ei osunut", en: "missed", es: "fallidas" })}</span> : null}</div>
            </div>

            <div className="divide-y divide-white/10">
              {slip.legs.map((leg, index) => <div key={leg.id || `${slip.id}-${index}`} className="grid gap-3 p-4 sm:grid-cols-[44px_1fr_auto] sm:items-center sm:p-5">
                <div className="text-lg font-black text-slate-500">{index + 1}.</div>
                <div><div className="font-black text-white">{leg.match}</div><div className="mt-1 text-sm text-slate-400">{leg.market || "—"}</div><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-xl border border-[var(--sc-brand)]/35 bg-[var(--sc-brand)]/15 px-3 py-2 text-sm font-black text-white">{leg.selection}</span><span className="rounded-xl border border-[var(--sc-brand)]/35 px-3 py-2 text-sm font-black text-white">{Number(leg.odds || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span></div></div>
                <div className="flex min-w-40 flex-col items-stretch gap-2 sm:items-end"><span className={`rounded-full border px-3 py-2 text-center text-xs font-black ${statusClass(leg.status)}`}>{legStatusLabel(leg.status)}</span><label className="text-[10px] font-black uppercase tracking-wider text-slate-500">{tr({ fi: "Päivitä tila", en: "Update status", es: "Actualizar estado" })}<select value={leg.status || "open"} disabled={busy !== ""} onChange={(event) => void updateLegStatus(slip, leg.id, event.target.value)} className="mt-1 min-h-10 rounded-xl border border-white/10 bg-slate-900 px-3 text-xs font-bold text-white"><option value="open">{tr({ fi: "Avoin", en: "Open", es: "Abierto" })}</option><option value="won">{tr({ fi: "Oikein", en: "Correct", es: "Correcto" })}</option><option value="lost">{tr({ fi: "Ei osunut", en: "Missed", es: "Falló" })}</option><option value="push">{tr({ fi: "Palautus", en: "Push", es: "Nulo" })}</option><option value="void">{tr({ fi: "Mitätöity", en: "Void", es: "Anulado" })}</option></select></label></div>
              </div>)}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950/30 p-4 sm:p-5"><div className="text-xs leading-5 text-slate-500">{tr({ fi: "Ulkoinen kuponki · ei mukana Scorecasterin paperituloksessa", en: "External slip · excluded from Scorecaster paper performance", es: "Cupón externo · excluido del rendimiento simulado" })}</div><button type="button" onClick={() => void removeSlip(slip.id)} disabled={busy !== ""} className="min-h-10 rounded-xl border border-rose-300/20 px-3 text-xs font-black text-rose-200 disabled:opacity-40">{tr({ fi: "Poista seurannasta", en: "Remove from tracking", es: "Quitar seguimiento" })}</button></div>
          </article>;
        })}
      </div>
    </section>
  );
}
