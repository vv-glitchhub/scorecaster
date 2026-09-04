"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import {
  EXTERNAL_SLIP_DECISION,
  deriveExternalSlipStatus,
  externalSlipFromRows,
  externalSlipItemRows,
  externalSlipParentRow,
  externalSlipProgress
} from "../../lib/external-slip-v1.mjs";

function newLeg(index = 0) {
  return { id: `leg-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`, match: "", market: "Voittaja (1X2)", selection: "", odds: "", status: "open" };
}

function freshDraft() {
  return { provider: "Veikkaus", externalReference: "", title: "Kuponki", currency: "EUR", stake: "", combinedOdds: "", potentialReturn: "", purchasedAt: "", resolvesAt: "", legs: [newLeg()] };
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
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        setSignedOut(true);
        setSlips([]);
        return;
      }
      const userId = userData.user.id;
      const { data: parentRows, error: parentError } = await supabase
        .from("bet_slips")
        .select("id,user_id,status,total_stake,potential_return,potential_profit,decision,warnings,blockers,created_at,updated_at")
        .eq("user_id", userId)
        .eq("decision", EXTERNAL_SLIP_DECISION)
        .order("created_at", { ascending: false })
        .limit(100);
      if (parentError) throw parentError;

      const parentIds = (parentRows || []).map((row) => row.id);
      let itemRows = [];
      if (parentIds.length) {
        const { data, error: itemError } = await supabase
          .from("bet_slip_items")
          .select("id,bet_slip_id,user_id,sport,league,match,market,selection,bookmaker,odds,stake,decision,risk_warnings,risk_blockers,created_at")
          .eq("user_id", userId)
          .in("bet_slip_id", parentIds)
          .order("created_at", { ascending: true });
        if (itemError) throw itemError;
        itemRows = data || [];
      }

      const grouped = new Map();
      for (const item of itemRows) {
        const list = grouped.get(item.bet_slip_id) || [];
        list.push(item);
        grouped.set(item.bet_slip_id, list);
      }
      const normalized = (parentRows || []).map((row) => {
        const rows = grouped.get(row.id) || [];
        const slip = externalSlipFromRows(row, rows);
        if (!slip) return null;
        slip.legs = slip.legs.map((leg, index) => ({ ...leg, databaseId: rows[index]?.id || null }));
        return slip;
      }).filter(Boolean);
      setSignedOut(false);
      setSlips(normalized);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "External slips could not be loaded");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const euro = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 2 }), [locale]);
  const money = (value, currency = "EUR") => {
    if (value === null || value === undefined || value === "") return "—";
    if (currency === "EUR") return euro.format(Number(value || 0));
    try { return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(value || 0)); }
    catch { return `${Number(value || 0).toFixed(2)} ${currency}`; }
  };
  const legLabel = (status) => status === "won" ? tr({ fi: "✓ Oikein", en: "✓ Correct", es: "✓ Correcto" }) : status === "lost" ? tr({ fi: "Ei osunut", en: "Missed", es: "Falló" }) : status === "push" ? tr({ fi: "Palautus", en: "Push", es: "Nulo" }) : status === "void" ? tr({ fi: "Mitätöity", en: "Void", es: "Anulado" }) : tr({ fi: "Avoin", en: "Open", es: "Abierto" });
  const slipLabel = (status) => status === "won" ? tr({ fi: "Voitettu", en: "Won", es: "Ganado" }) : status === "lost" ? tr({ fi: "Ei osunut", en: "Lost", es: "Perdido" }) : status === "void" ? tr({ fi: "Mitätöity", en: "Void", es: "Anulado" }) : tr({ fi: "Avoin", en: "Open", es: "Abierto" });
  const tone = (status) => status === "won" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : status === "lost" ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : ["void", "push"].includes(status) ? "border-sky-300/30 bg-sky-300/10 text-sky-100" : "border-amber-300/30 bg-amber-300/10 text-amber-100";

  function updateDraft(field, value) { setDraft((current) => ({ ...current, [field]: value })); }
  function updateLeg(index, field, value) { setDraft((current) => ({ ...current, legs: current.legs.map((leg, i) => i === index ? { ...leg, [field]: value } : leg) })); }
  function addLeg() { setDraft((current) => current.legs.length >= 50 ? current : { ...current, legs: [...current.legs, newLeg(current.legs.length)] }); }
  function removeLeg(index) { setDraft((current) => current.legs.length <= 1 ? current : { ...current, legs: current.legs.filter((_, i) => i !== index) }); }

  async function currentUser(supabase) {
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data?.user) throw new Error(tr({ fi: "Kirjaudu ensin Scorecasteriin.", en: "Sign in to Scorecaster first.", es: "Inicia sesión primero." }));
    return data.user;
  }

  async function saveDraft(event) {
    event.preventDefault(); setBusy("create"); setError(""); setMessage("");
    const supabase = createClient();
    let insertedId = null;
    try {
      const user = await currentUser(supabase);
      const parent = externalSlipParentRow({ ...draft, source: "external-slip-reference-v1" }, user.id);
      if (!parent) throw new Error(tr({ fi: "Lisää vähintään yksi kelvollinen kohde ja kerroin.", en: "Add at least one valid leg and odds.", es: "Añade al menos una selección válida y su cuota." }));
      const { data: savedParent, error: parentError } = await supabase.from("bet_slips").insert(parent).select("id").single();
      if (parentError || !savedParent?.id) throw parentError || new Error("Slip parent could not be saved");
      insertedId = savedParent.id;
      const items = externalSlipItemRows({ ...draft, source: "external-slip-reference-v1" }, insertedId, user.id);
      const { error: itemError } = await supabase.from("bet_slip_items").insert(items);
      if (itemError) throw itemError;
      setDraft(freshDraft()); setShowForm(false);
      setMessage(tr({ fi: "Kuponki tallennettiin. Se on erillään paperikassasta, Kellystä ja AI-agentin päätöksistä.", en: "Slip saved. It stays separate from the paper bankroll, Kelly staking and AI Agent decisions.", es: "Cupón guardado. Queda separado de la banca simulada, Kelly y las decisiones del agente IA." }));
      await load({ silent: true });
    } catch (cause) {
      if (insertedId) await supabase.from("bet_slips").delete().eq("id", insertedId).catch(() => null);
      setError(cause instanceof Error ? cause.message : "External slip could not be saved");
    } finally { setBusy(""); }
  }

  async function setLegStatus(slip, leg, status) {
    if (!leg.databaseId) return;
    setBusy(slip.id); setError(""); setMessage("");
    try {
      const supabase = createClient();
      const user = await currentUser(supabase);
      const { error: itemError } = await supabase.from("bet_slip_items").update({ decision: `EXTERNAL_${status.toUpperCase()}` }).eq("id", leg.databaseId).eq("user_id", user.id);
      if (itemError) throw itemError;
      const nextLegs = slip.legs.map((item) => item.databaseId === leg.databaseId ? { ...item, status } : item);
      const nextStatus = deriveExternalSlipStatus(nextLegs);
      const { error: parentError } = await supabase.from("bet_slips").update({ status: `external_${nextStatus}` }).eq("id", slip.id).eq("user_id", user.id);
      if (parentError) throw parentError;
      setSlips((current) => current.map((item) => item.id === slip.id ? { ...item, status: nextStatus, legs: nextLegs } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Slip status could not be updated"); }
    finally { setBusy(""); }
  }

  async function removeSlip(slip) {
    if (!window.confirm(tr({ fi: "Poistetaanko kuponki Scorecasterin seurannasta? Tämä ei peru muualla tehtyä vetoa.", en: "Remove this slip from Scorecaster tracking? This does not cancel anything placed elsewhere.", es: "¿Eliminar el cupón del seguimiento? Esto no cancela nada realizado fuera." }))) return;
    setBusy(slip.id); setError(""); setMessage("");
    try {
      const supabase = createClient(); const user = await currentUser(supabase);
      const { error: deleteError } = await supabase.from("bet_slips").delete().eq("id", slip.id).eq("user_id", user.id);
      if (deleteError) throw deleteError;
      setSlips((current) => current.filter((item) => item.id !== slip.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "External slip could not be deleted"); }
    finally { setBusy(""); }
  }

  return <section className="space-y-5" data-external-slip-tracker="v1">
    <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
      <div className="max-w-3xl"><div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">{tr({ fi: "Kuponkiseuranta", en: "Slip tracking", es: "Seguimiento de cupón" })}</div><h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">{tr({ fi: "Seuraa myös muualla tehtyä yhdistelmäkuponkia", en: "Track an accumulator created elsewhere", es: "Sigue un cupón combinado creado fuera" })}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{tr({ fi: "Kokonaiskerroin, mahdollinen palautus ja kaikki kohteet näkyvät yhdessä. Kohteen tila on Oikein, Avoin, Ei osunut, Palautus tai Mitätöity.", en: "Total odds, potential return and every leg stay together. Each leg is Correct, Open, Missed, Push or Void.", es: "Cuota total, retorno potencial y todas las selecciones quedan juntas." })}</p></div>
      {!signedOut ? <button type="button" onClick={() => setShowForm((value) => !value)} className="sc-button-primary shrink-0">{showForm ? tr({ fi: "Sulje", en: "Close", es: "Cerrar" }) : tr({ fi: "+ Lisää kuponki", en: "+ Add slip", es: "+ Añadir cupón" })}</button> : null}
    </div>

    <div className="rounded-2xl border border-sky-300/25 bg-sky-300/10 p-4 text-sm leading-6 text-sky-100"><strong>{tr({ fi: "Raja:", en: "Boundary:", es: "Límite:" })}</strong> {tr({ fi: "Tämä on vain ulkopuolella tehdyn kupongin seurantaa. Scorecaster ei kirjaudu vedonvälittäjälle, aseta vetoa tai siirrä rahaa. Kuponki ei vaikuta paperikassaan, Kelly-panokseen, ROI/CLV-mittareihin tai autonomiseen agenttiin.", en: "This only tracks a slip created elsewhere. Scorecaster does not sign in to a bookmaker, place bets or move money. The slip does not affect the paper bankroll, Kelly staking, ROI/CLV or the autonomous agent.", es: "Solo registra un cupón creado fuera. Scorecaster no inicia sesión, apuesta ni mueve dinero." })}</div>
    {signedOut ? <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">{tr({ fi: "Kirjaudu sisään, jotta kupongit tallentuvat suojatusti tilillesi.", en: "Sign in to store slips securely on your account.", es: "Inicia sesión para guardar los cupones." })}</div> : null}
    {error ? <div role="alert" className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</div> : null}
    {message ? <div aria-live="polite" className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100">{message}</div> : null}

    {showForm && !signedOut ? <form onSubmit={saveDraft} className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-bold text-slate-300">{tr({ fi: "Vedonvälittäjä", en: "Provider", es: "Proveedor" })}<input required maxLength={120} value={draft.provider} onChange={(e) => updateDraft("provider", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
        <label className="text-sm font-bold text-slate-300">{tr({ fi: "Pelin / kupongin numero", en: "Slip reference", es: "Referencia" })}<input maxLength={180} value={draft.externalReference} onChange={(e) => updateDraft("externalReference", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
        <label className="text-sm font-bold text-slate-300">{tr({ fi: "Ostopäivä", en: "Purchased", es: "Comprado" })}<input type="date" value={draft.purchasedAt} onChange={(e) => updateDraft("purchasedAt", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
        <label className="text-sm font-bold text-slate-300">{tr({ fi: "Ratkeaa", en: "Resolves", es: "Se resuelve" })}<input type="date" value={draft.resolvesAt} onChange={(e) => updateDraft("resolvesAt", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
        <label className="text-sm font-bold text-slate-300">{tr({ fi: "Kokonaiskerroin", en: "Total odds", es: "Cuota total" })}<input inputMode="decimal" value={draft.combinedOdds} onChange={(e) => updateDraft("combinedOdds", e.target.value)} placeholder="72,17" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
        <label className="text-sm font-bold text-slate-300">{tr({ fi: "Panos (valinnainen)", en: "Stake (optional)", es: "Importe (opcional)" })}<input inputMode="decimal" value={draft.stake} onChange={(e) => updateDraft("stake", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
        <label className="text-sm font-bold text-slate-300">{tr({ fi: "Mahdollinen palautus", en: "Potential return", es: "Retorno potencial" })}<input inputMode="decimal" value={draft.potentialReturn} onChange={(e) => updateDraft("potentialReturn", e.target.value)} placeholder="3117,60" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
        <label className="text-sm font-bold text-slate-300">{tr({ fi: "Nimi", en: "Title", es: "Título" })}<input maxLength={180} value={draft.title} onChange={(e) => updateDraft("title", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white" /></label>
      </div>
      <div className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="font-black text-white">{tr({ fi: "Valitut kohteet", en: "Selected legs", es: "Selecciones" })}</h3><button type="button" onClick={addLeg} className="sc-button-secondary">{tr({ fi: "+ Kohde", en: "+ Leg", es: "+ Selección" })}</button></div>
        {draft.legs.map((leg, index) => <div key={leg.id} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 lg:grid-cols-[44px_1.5fr_1fr_1fr_110px_auto] lg:items-end"><div className="text-xl font-black text-slate-500">{index + 1}.</div><label className="text-xs font-bold text-slate-400">{tr({ fi: "Ottelu", en: "Match", es: "Partido" })}<input required maxLength={240} value={leg.match} onChange={(e) => updateLeg(index, "match", e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white" /></label><label className="text-xs font-bold text-slate-400">{tr({ fi: "Markkina", en: "Market", es: "Mercado" })}<input maxLength={120} value={leg.market} onChange={(e) => updateLeg(index, "market", e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white" /></label><label className="text-xs font-bold text-slate-400">{tr({ fi: "Oma merkki", en: "Selection", es: "Selección" })}<input required maxLength={180} value={leg.selection} onChange={(e) => updateLeg(index, "selection", e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white" /></label><label className="text-xs font-bold text-slate-400">{tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })}<input required inputMode="decimal" value={leg.odds} onChange={(e) => updateLeg(index, "odds", e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white" /></label><button type="button" disabled={draft.legs.length <= 1} onClick={() => removeLeg(index)} className="min-h-11 rounded-xl border border-rose-300/20 px-3 text-xs font-black text-rose-200 disabled:opacity-30">{tr({ fi: "Poista", en: "Remove", es: "Quitar" })}</button></div>)}
      </div>
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy !== ""} className="sc-button-primary disabled:opacity-50">{busy === "create" ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Tallenna kuponki", en: "Save slip", es: "Guardar cupón" })}</button><button type="button" onClick={() => { setDraft(freshDraft()); setShowForm(false); }} className="sc-button-ghost">{tr({ fi: "Peruuta", en: "Cancel", es: "Cancelar" })}</button></div>
    </form> : null}

    {loading ? <div className="h-44 animate-pulse rounded-3xl border border-white/10 bg-white/[0.035]" /> : !signedOut && slips.length === 0 ? <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center"><div className="text-lg font-black text-white">{tr({ fi: "Ei vielä kuponkeja", en: "No slips yet", es: "Aún no hay cupones" })}</div><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{tr({ fi: "Lisää esimerkiksi Veikkauksessa tehty yhdistelmäkuponki seurantaan.", en: "Add an accumulator created at a bookmaker for reference tracking.", es: "Añade un cupón combinado para seguimiento." })}</p></div> : null}

    <div className="space-y-5">{slips.map((slip) => { const progress = externalSlipProgress(slip.legs); return <article key={slip.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
      <div className="border-b border-white/10 p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{slip.provider}</div><h3 className="mt-1 text-xl font-black text-white">{slip.title}</h3>{slip.externalReference ? <div className="mt-1 text-xs text-slate-500">{tr({ fi: "Pelin numero", en: "Slip reference", es: "Referencia" })}: {slip.externalReference}</div> : null}</div><span className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-black ${tone(slip.status)}`}>{slipLabel(slip.status)}</span></div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-2xl bg-slate-950/45 p-3"><div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{tr({ fi: "Kokonaiskerroin", en: "Total odds", es: "Cuota total" })}</div><div className="mt-1 text-xl font-black text-white">{slip.combinedOdds?.toLocaleString(locale, { maximumFractionDigits: 4 }) || "—"}</div></div><div className="rounded-2xl bg-slate-950/45 p-3"><div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{tr({ fi: "Panos", en: "Stake", es: "Importe" })}</div><div className="mt-1 text-xl font-black text-white">{money(slip.stake, slip.currency)}</div></div><div className="rounded-2xl bg-slate-950/45 p-3"><div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{tr({ fi: "Mahdollinen palautus", en: "Potential return", es: "Retorno potencial" })}</div><div className="mt-1 text-xl font-black text-white">{money(slip.potentialReturn, slip.currency)}</div></div><div className="rounded-2xl bg-slate-950/45 p-3"><div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{tr({ fi: "Kohteet", en: "Legs", es: "Selecciones" })}</div><div className="mt-1 text-xl font-black text-white">{progress.won}/{progress.total} <span className="text-sm font-bold text-slate-500">{tr({ fi: "oikein", en: "correct", es: "correctas" })}</span></div></div></div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">{slip.purchasedAt ? <span>{tr({ fi: "Ostettu", en: "Purchased", es: "Comprado" })} {new Date(slip.purchasedAt).toLocaleDateString(locale)}</span> : null}{slip.resolvesAt ? <span>{tr({ fi: "Ratkeaa", en: "Resolves", es: "Se resuelve" })} {new Date(slip.resolvesAt).toLocaleDateString(locale)}</span> : null}<span>{progress.open} {tr({ fi: "avoinna", en: "open", es: "abiertas" })}</span></div></div>
      <div className="divide-y divide-white/10">{slip.legs.map((leg, index) => <div key={leg.databaseId || leg.id} className="grid gap-3 p-4 sm:grid-cols-[44px_1fr_auto] sm:items-center sm:p-5"><div className="text-lg font-black text-slate-500">{index + 1}.</div><div><div className="font-black text-white">{leg.match}</div><div className="mt-1 text-sm text-slate-400">{leg.market}</div><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-xl border border-[var(--sc-brand)]/35 bg-[var(--sc-brand)]/15 px-3 py-2 text-sm font-black text-white">{leg.selection}</span><span className="rounded-xl border border-[var(--sc-brand)]/35 px-3 py-2 text-sm font-black text-white">{Number(leg.odds).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span></div></div><div className="flex min-w-40 flex-col gap-2 sm:items-end"><span className={`rounded-full border px-3 py-2 text-center text-xs font-black ${tone(leg.status)}`}>{legLabel(leg.status)}</span><select aria-label={tr({ fi: "Päivitä kohteen tila", en: "Update leg status", es: "Actualizar estado" })} value={leg.status} disabled={busy !== ""} onChange={(e) => void setLegStatus(slip, leg, e.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-slate-900 px-3 text-xs font-bold text-white"><option value="open">{tr({ fi: "Avoin", en: "Open", es: "Abierto" })}</option><option value="won">{tr({ fi: "Oikein", en: "Correct", es: "Correcto" })}</option><option value="lost">{tr({ fi: "Ei osunut", en: "Missed", es: "Falló" })}</option><option value="push">{tr({ fi: "Palautus", en: "Push", es: "Nulo" })}</option><option value="void">{tr({ fi: "Mitätöity", en: "Void", es: "Anulado" })}</option></select></div></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950/30 p-4 sm:p-5"><div className="text-xs text-slate-500">{tr({ fi: "Ulkoinen kuponki · ei mukana Scorecasterin paperituloksessa", en: "External slip · excluded from Scorecaster paper performance", es: "Cupón externo · excluido del rendimiento simulado" })}</div><button type="button" disabled={busy !== ""} onClick={() => void removeSlip(slip)} className="min-h-10 rounded-xl border border-rose-300/20 px-3 text-xs font-black text-rose-200 disabled:opacity-40">{tr({ fi: "Poista seurannasta", en: "Remove from tracking", es: "Quitar seguimiento" })}</button></div>
    </article>; })}</div>
  </section>;
}
