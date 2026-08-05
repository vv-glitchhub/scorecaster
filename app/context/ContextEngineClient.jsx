"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const pct = (value, digits = 1) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";
const signedPct = (value) => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? "+" : ""}${(Number(value) * 100).toFixed(1)} pp` : "–";
const number = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";

function ProbabilitySet({ title, probabilities, expectedGoals }) {
  return (
    <div className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{title}</div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {["home", "draw", "away"].map((key) => (
          <div key={key} className="rounded-2xl bg-[var(--sc-surface-soft)] p-3">
            <div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">{key}</div>
            <div className="mt-1 text-2xl font-black text-[var(--sc-text)]">{pct(probabilities?.[key], 0)}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs text-[var(--sc-muted)]">xG {number(expectedGoals?.home)} – {number(expectedGoals?.away)}</div>
    </div>
  );
}

function StatusPill({ value }) {
  const tone = value === "available" || value === "confirmed"
    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
    : value === "conflict"
      ? "border-rose-400/25 bg-rose-400/10 text-rose-100"
      : "border-amber-400/25 bg-amber-400/10 text-amber-100";
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${tone}`}>{value}</span>;
}

export default function ContextEngineClient() {
  const { tr } = useLanguage();
  const [eventId, setEventId] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [neutral, setNeutral] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = eventId.trim() && home.trim() && away.trim() && kickoff;
  const strongestDelta = useMemo(() => {
    if (!result?.probabilityDelta) return null;
    return Object.entries(result.probabilityDelta).sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))[0];
  }, [result]);

  async function analyze(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const params = new URLSearchParams({
        eventId: eventId.trim(),
        home: home.trim(),
        away: away.trim(),
        kickoff: new Date(kickoff).toISOString()
      });
      if (neutral) params.set("neutral", "true");
      const response = await fetch(`/api/context?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || payload.reason || "Context Engine unavailable");
      setResult(payload);
    } catch (cause) {
      setError(cause?.message || "Context Engine unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6 sm:p-8">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Context Engine V1</div>
        <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.045em] text-[var(--sc-text)] sm:text-5xl">
          {tr({
            fi: "Mitä kokoonpanot, poissaolot ja olosuhteet oikeasti muuttavat?",
            en: "What do lineups, absences and conditions actually change?",
            es: "¿Qué cambian realmente las alineaciones, ausencias y condiciones?"
          })}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--sc-muted)]">
          {tr({
            fi: "Moottori hyväksyy vain lähteistetyn ja ennen aloitusta havaitun evidenssin. Ristiriitainen, vanhentunut tai vahvistamaton tieto näkyy omalla tilallaan eikä sitä esitetä varmana.",
            en: "The engine accepts only sourced evidence observed before kickoff. Conflicting, stale and unconfirmed information keeps its own status and is never presented as certain.",
            es: "El motor acepta solo evidencia con fuente observada antes del inicio. La información conflictiva, caducada o no confirmada nunca se presenta como segura."
          })}
        </p>
        <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4 text-sm leading-6 text-amber-50/85">
          {tr({
            fi: "Kontekstikorjattu tulos on rajattu herkkyysarvio. Se ei saa yksin tehdä PLAY-päätöstä eikä aseta oikeita vetoja.",
            en: "The context-adjusted result is a bounded sensitivity preview. It cannot make a PLAY decision by itself or place a real bet.",
            es: "El resultado ajustado por contexto es una sensibilidad limitada. No puede decidir PLAY ni realizar apuestas reales."
          })}
        </div>
      </section>

      <form onSubmit={analyze} className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">Event ID<input className="sc-input mt-2" value={eventId} onChange={(event) => setEventId(event.target.value)} required maxLength={180} placeholder="league:event:2026-08-05" /></label>
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">{tr({ fi: "Ottelun alku", en: "Kickoff", es: "Inicio" })}<input type="datetime-local" className="sc-input mt-2" value={kickoff} onChange={(event) => setKickoff(event.target.value)} required /></label>
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">{tr({ fi: "Kotijoukkue", en: "Home team", es: "Equipo local" })}<input className="sc-input mt-2" value={home} onChange={(event) => setHome(event.target.value)} required maxLength={120} /></label>
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">{tr({ fi: "Vierasjoukkue", en: "Away team", es: "Equipo visitante" })}<input className="sc-input mt-2" value={away} onChange={(event) => setAway(event.target.value)} required maxLength={120} /></label>
        </div>
        <label className="mt-4 flex min-h-11 items-center gap-3 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 text-sm font-bold text-[var(--sc-text-secondary)]"><input type="checkbox" checked={neutral} onChange={(event) => setNeutral(event.target.checked)} />{tr({ fi: "Neutraali pelipaikka", en: "Neutral venue", es: "Sede neutral" })}</label>
        <button disabled={!canSubmit || loading} className="sc-button-primary mt-5 disabled:opacity-40">{loading ? tr({ fi: "Tarkistetaan…", en: "Checking…", es: "Comprobando…" }) : tr({ fi: "Avaa kontekstianalyysi", en: "Open context analysis", es: "Abrir análisis de contexto" })}</button>
      </form>

      {error && <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-5 text-sm text-rose-100">{error}</div>}

      {result && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><div className="text-xs font-black uppercase tracking-[0.15em] text-[var(--sc-brand)]">{result.version}</div><h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{result.teams?.home} vs {result.teams?.away}</h2><div className="mt-2 text-xs text-[var(--sc-muted)]">{result.eventId}</div></div>
              <StatusPill value={result.contextStatus} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Evidence quality</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{pct(result.evidence?.evidenceQuality)}</div></div>
              <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Accepted</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{result.evidence?.accepted?.length || 0}</div></div>
              <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Conflicts</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{result.evidence?.conflicts?.length || 0}</div></div>
            </div>
            {strongestDelta && <p className="mt-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Suurin kontekstimuutos", en: "Largest context change", es: "Mayor cambio de contexto" })}: <strong className="text-[var(--sc-text)]">{strongestDelta[0].toUpperCase()} {signedPct(strongestDelta[1])}</strong></p>}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <ProbabilitySet title={tr({ fi: "Ennen kontekstia", en: "Before context", es: "Antes del contexto" })} probabilities={result.before?.probabilities} expectedGoals={result.before?.expectedGoals} />
            <ProbabilitySet title={tr({ fi: "Rajattu kontekstiesikatselu", en: "Bounded context preview", es: "Vista contextual limitada" })} probabilities={result.after?.probabilities} expectedGoals={result.after?.expectedGoals} />
          </section>

          <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
            <h3 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Kattavuus", en: "Coverage", es: "Cobertura" })}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{result.evidence?.coverage?.map((item) => <div key={item.category} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--sc-surface-soft)] p-4"><span className="text-sm font-black text-[var(--sc-text)]">{item.category}</span><StatusPill value={item.status} /></div>)}</div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
              <h3 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Hyväksytty evidenssi", en: "Accepted evidence", es: "Evidencia aceptada" })}</h3>
              <div className="mt-4 space-y-3">{result.evidence?.accepted?.length ? result.evidence.accepted.map((item) => <div key={item.id} className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-black text-[var(--sc-text)]">{item.category}: {item.subject}</span><StatusPill value={item.confirmation} /></div><div className="mt-2 text-xs leading-6 text-[var(--sc-muted)]">{item.status} · {item.teamRole} · source {item.sourceId} · weight {number(item.evidenceWeight, 3)}</div>{item.note && <p className="mt-2 text-xs leading-6 text-[var(--sc-text-secondary)]">{item.note}</p>}</div>) : <p className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Ei hyväksyttyä kontekstievidenssiä.", en: "No eligible context evidence.", es: "No hay evidencia contextual válida." })}</p>}</div>
            </div>
            <div className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
              <h3 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Riskit ja tuntemattomat", en: "Risks and unknowns", es: "Riesgos y desconocidos" })}</h3>
              <div className="mt-4 space-y-2">{result.unknowns?.map((item) => <div key={`${item.category}-${item.reason}`} className="rounded-xl border border-amber-400/15 bg-amber-400/5 px-4 py-3 text-sm text-amber-50/85"><strong>{item.category}</strong>: {item.reason}</div>)}</div>
              {result.evidence?.conflicts?.length > 0 && <div className="mt-4 space-y-2">{result.evidence.conflicts.map((item) => <div key={item.key} className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"><strong>{item.key}</strong>: {item.reason}</div>)}</div>}
            </div>
          </section>

          <details className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
            <summary className="cursor-pointer text-lg font-black text-[var(--sc-text)]">{tr({ fi: "Kaavat ja rajat", en: "Formulas and limits", es: "Fórmulas y límites" })}</summary>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--sc-muted)]">{result.formulas?.map((item) => <li key={item}>{item}</li>)}</ul>
            <div className="mt-5 space-y-2 text-xs leading-6 text-[var(--sc-faint)]">{result.limitations?.map((item) => <p key={item}>{item}</p>)}</div>
          </details>
        </div>
      )}
    </div>
  );
}
