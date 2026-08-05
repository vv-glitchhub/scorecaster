"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import ProfessionalExplanationCard from "../components/ProfessionalExplanationCard";
import { EmptyState, PageHero, SectionHeader } from "../components/ProductUI";

export default function ModelLabClient() {
  const { tr, locale } = useLanguage();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [manualId, setManualId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/transparency?hours=720&limit=5000", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Model Lab events unavailable");
      const rows = Array.isArray(payload?.events) ? payload.events : [];
      setEvents(rows);
      setEventId((current) => current || rows[0]?.eventId || "");
    } catch (loadError) {
      setEvents([]);
      setError(loadError instanceof Error ? loadError.message : "Model Lab events unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function inspectManual(event) {
    event.preventDefault();
    const cleaned = manualId.trim();
    if (cleaned) setEventId(cleaned);
  }

  return (
    <div className="space-y-7">
      <PageHero
        tone="sky"
        eyebrow="Professional Explanation & Model Lab V1"
        title={tr({ fi: "Yksi laskelma, kaksi selitystasoa", en: "One calculation, two explanation levels", es: "Un cálculo, dos niveles de explicación" })}
        description={tr({
          fi: "Simple Mode näyttää vahvimman tekijän, suurimman riskin ja puuttuvan evidenssin. Pro Mode näyttää mallin, markkinan, hinnan, kontribuutiot, kaavat, cutoffit ja toistettavan input-snapshotin.",
          en: "Simple Mode shows the strongest factor, largest risk and missing evidence. Pro Mode exposes the model, market, selected price, contributions, formulas, cutoffs and a reproducible input snapshot.",
          es: "El modo simple muestra el factor principal, el mayor riesgo y la evidencia ausente. El modo profesional expone modelo, mercado, cuota, contribuciones, fórmulas, cortes y snapshot reproducible."
        })}
        actions={<button type="button" onClick={() => void load()} className="sc-button-secondary">{tr({ fi: "Päivitä tapahtumat", en: "Refresh events", es: "Actualizar eventos" })}</button>}
        aside={<div><div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">Public audit</div><div className="mt-2 text-3xl font-black text-[var(--sc-text)]">{events.length}</div><div className="mt-1 text-sm text-[var(--sc-muted)]">{tr({ fi: "julkaistavaa tapahtumaa", en: "publishable events", es: "eventos publicables" })}</div><div className="mt-4 text-xs leading-5 text-[var(--sc-muted)]">marketMislabeledAsIndependentModel=false<br />missingValuesConvertedToZero=false</div></div>}
      />

      {error && <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</div>}

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <SectionHeader eyebrow={tr({ fi: "Tapahtuma", en: "Event", es: "Evento" })} title={tr({ fi: "Valitse tarkastettava snapshot", en: "Choose a snapshot to inspect", es: "Elige un snapshot" })} />
        <form onSubmit={inspectManual} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <input value={manualId} onChange={(event) => setManualId(event.target.value)} placeholder="eventId" className="sc-input w-full" />
          <button type="submit" className="sc-button-primary">{tr({ fi: "Avaa eventId", en: "Open eventId", es: "Abrir eventId" })}</button>
        </form>
        {loading ? <div className="mt-5 text-sm text-[var(--sc-muted)]">{tr({ fi: "Ladataan julkisia auditointeja…", en: "Loading public audits…", es: "Cargando auditorías públicas…" })}</div> : events.length === 0 ? <div className="mt-5"><EmptyState title={tr({ fi: "Julkisia tapahtumasnapshoteja ei vielä ole", en: "No public event snapshots are available yet", es: "Aún no hay snapshots públicos" })} description={tr({ fi: "Model Lab ei täytä puuttuvia tietoja esimerkkidatalla.", en: "Model Lab does not fill missing records with sample data.", es: "Model Lab no completa datos ausentes con ejemplos." })} /></div> : <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{events.slice(0, 30).map((item) => <button key={item.eventId} type="button" onClick={() => setEventId(item.eventId)} className={`rounded-[1.2rem] border p-4 text-left ${eventId === item.eventId ? "border-[var(--sc-brand)] bg-[var(--sc-brand-soft)]" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)]"}`}><div className="truncate font-black text-[var(--sc-text)]">{item.eventId}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{item.league || item.sport || "unknown"} · {item.recordCount} records</div><div className="mt-2 text-xs text-[var(--sc-faint)]">{item.newestObservationAt ? new Date(item.newestObservationAt).toLocaleString(locale) : "–"}</div></button>)}</div>}
      </section>

      {eventId && <ProfessionalExplanationCard key={eventId} eventId={eventId} initialMode="pro" />}

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <SectionHeader eyebrow="Boundary" title={tr({ fi: "Selityksen turvallisuusraja", en: "Explanation safety boundary", es: "Límite de seguridad" })} />
        <div className="grid gap-3 md:grid-cols-2">
          {[
            tr({ fi: "Narratiivi ei ole evidenssiä: kaikki tekijät tulevat rakenteisista laskentakentistä.", en: "Narrative is not evidence: every factor comes from structured calculation fields.", es: "La narrativa no es evidencia: cada factor proviene de campos estructurados." }),
            tr({ fi: "Markkinatodennäköisyys näkyy markkinavertailuna, ei itsenäisenä mallina.", en: "Market probability is labeled as a benchmark, not an independent model.", es: "La probabilidad de mercado se etiqueta como referencia, no como modelo independiente." }),
            tr({ fi: "Puuttuva arvo pysyy puuttuvana eikä muutu hiljaisesti nollaksi.", en: "A missing value remains missing and is never silently converted to zero.", es: "Un valor ausente permanece ausente y no se convierte silenciosamente en cero." }),
            tr({ fi: "Snapshot ei sisällä avaimia, henkilötietoja eikä rajoitettuja raakapayload-tietoja.", en: "The snapshot excludes keys, personal data and restricted raw provider payloads.", es: "El snapshot excluye claves, datos personales y payloads restringidos." })
          ].map((item) => <div key={item} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm leading-6 text-[var(--sc-text-secondary)]">{item}</div>)}
        </div>
      </section>
    </div>
  );
}
