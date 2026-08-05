"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

function Badge({ children, tone = "default" }) {
  const classes = tone === "good"
    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
    : tone === "warn"
      ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
      : tone === "bad"
        ? "border-rose-400/25 bg-rose-400/10 text-rose-100"
        : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-muted)]";
  return <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${classes}`}>{children}</span>;
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{label}</div>
      <div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{value}</div>
    </div>
  );
}

export default function SourceRegistryClient() {
  const { tr } = useLanguage();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [sport, setSport] = useState("all");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/sources", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Source registry unavailable");
        if (active) setPayload(data);
      } catch (cause) {
        if (active) setError(cause?.message || "Source registry unavailable");
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const sources = payload?.sources || [];
  const sports = useMemo(() => [...new Set(sources.flatMap((source) => source.sports || []))].sort(), [sources]);
  const visible = sources.filter((source) => {
    if (status !== "all" && source.status !== status) return false;
    if (sport !== "all" && !(source.sports || []).includes(sport) && !(source.sports || []).includes("multi-sport")) return false;
    return true;
  });

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6 sm:p-8">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Source Registry V1</div>
        <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.045em] text-[var(--sc-text)] sm:text-5xl">
          {tr({ fi: "Mistä jokainen tieto tulee ja mitä siitä saa näyttää.", en: "Where every data point comes from and what may be shown.", es: "De dónde viene cada dato y qué se puede mostrar." })}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--sc-muted)]">
          {tr({
            fi: "Rekisteri julkaisee lähteen nimen, käyttötilan, lisenssin, attribuution, tuoreusrajan, säilytysajan ja sallitut normalisoidut kentät. API-avaimia ja raakoja palveluntarjoajavastauksia ei julkaista.",
            en: "The registry publishes source identity, operating status, licence, attribution, freshness threshold, retention and allowed normalized fields. API keys and raw provider responses are never published.",
            es: "El registro publica identidad, estado, licencia, atribución, frescura, retención y campos normalizados permitidos. Nunca publica claves ni respuestas sin procesar."
          })}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label={tr({ fi: "Lähteet", en: "Sources", es: "Fuentes" })} value={payload?.summary?.total ?? "–"} />
          <Metric label={tr({ fi: "Tuotanto", en: "Production", es: "Producción" })} value={payload?.summary?.production ?? "–"} />
          <Metric label={tr({ fi: "Julkaistavissa", en: "Publishable", es: "Publicables" })} value={payload?.summary?.publishable ?? "–"} />
          <Metric label={tr({ fi: "Tutkimus", en: "Research", es: "Investigación" })} value={payload?.summary?.researchOnly ?? "–"} />
          <Metric label={tr({ fi: "Raakadata julkinen", en: "Raw data public", es: "Datos brutos públicos" })} value={payload?.summary?.rawPayloadsPublic ?? 0} />
        </div>
        <div className="mt-5 rounded-2xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-4 text-sm text-[var(--sc-text-secondary)]">
          <strong className="text-[var(--sc-text)]">Public JSON API:</strong> <code>/api/sources</code> · CORS <code>*</code> · {tr({ fi: "ei kirjautumista", en: "no sign-in", es: "sin inicio" })}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">
            {tr({ fi: "Käyttötila", en: "Operating status", es: "Estado" })}
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="sc-input mt-2">
              <option value="all">{tr({ fi: "Kaikki", en: "All", es: "Todos" })}</option>
              <option value="production">Production</option>
              <option value="research-only">Research only</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">
            {tr({ fi: "Laji", en: "Sport", es: "Deporte" })}
            <select value={sport} onChange={(event) => setSport(event.target.value)} className="sc-input mt-2">
              <option value="all">{tr({ fi: "Kaikki", en: "All", es: "Todos" })}</option>
              {sports.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-5 text-sm text-rose-100">{error}</div>}
      {!payload && !error && <div className="h-80 animate-pulse rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]" />}

      <section className="grid gap-5 xl:grid-cols-2">
        {visible.map((source) => (
          <article key={source.id} className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.15em] text-[var(--sc-brand)]">{source.id}</div>
                <h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{source.name}</h2>
              </div>
              <Badge tone={source.status === "production" ? "good" : source.status === "research-only" ? "warn" : "bad"}>{source.status}</Badge>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Badge>{source.type}</Badge>
              <Badge tone={source.commercialUseAllowed ? "good" : "warn"}>commercial: {String(source.commercialUseAllowed)}</Badge>
              <Badge tone={source.redistributionAllowed ? "good" : "warn"}>redistribution: {String(source.redistributionAllowed)}</Badge>
              <Badge tone={source.modelTrainingAllowed ? "good" : "warn"}>training: {String(source.modelTrainingAllowed)}</Badge>
            </div>

            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><dt className="text-xs font-black text-[var(--sc-faint)]">License</dt><dd className="mt-2 leading-6 text-[var(--sc-text-secondary)]">{source.license}</dd></div>
              <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><dt className="text-xs font-black text-[var(--sc-faint)]">Attribution</dt><dd className="mt-2 leading-6 text-[var(--sc-text-secondary)]">{source.attributionRequired ? source.attribution || "required" : "not required"}</dd></div>
              <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><dt className="text-xs font-black text-[var(--sc-faint)]">Freshness threshold</dt><dd className="mt-2 font-black text-[var(--sc-text)]">{source.freshnessMinutes} min</dd></div>
              <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><dt className="text-xs font-black text-[var(--sc-faint)]">Retention</dt><dd className="mt-2 font-black text-[var(--sc-text)]">{source.retentionDays} days</dd></div>
            </dl>

            <div className="mt-5 rounded-2xl border border-[var(--sc-border)] p-4">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Julkiset normalisoidut kentät", en: "Public normalized fields", es: "Campos normalizados públicos" })}</div>
              <div className="mt-3 flex flex-wrap gap-2">{(source.publicFields || []).map((field) => <Badge key={field}>{field}</Badge>)}</div>
            </div>

            <details className="mt-4 rounded-2xl border border-[var(--sc-border)] p-4">
              <summary className="cursor-pointer text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Näytä rajoitetut kentät ja häiriötoiminta", en: "Show restricted fields and outage policy", es: "Ver campos restringidos y política de fallos" })}</summary>
              <div className="mt-4 text-sm leading-7 text-[var(--sc-muted)]">
                <p><strong className="text-[var(--sc-text-secondary)]">Restricted:</strong> {(source.restrictedFields || []).join(", ")}</p>
                <p className="mt-2"><strong className="text-[var(--sc-text-secondary)]">Outage:</strong> {source.outageBehavior}</p>
                <p className="mt-2"><strong className="text-[var(--sc-text-secondary)]">Cadence:</strong> {source.updateCadence}</p>
                <p className="mt-2"><strong className="text-[var(--sc-text-secondary)]">Sports:</strong> {(source.sports || []).join(", ")}</p>
              </div>
            </details>

            {source.notes && <p className="mt-4 text-sm leading-7 text-[var(--sc-muted)]">{source.notes}</p>}
            {source.termsUrl && <a href={source.termsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-4 text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Avaa käyttöehdot", en: "Open terms", es: "Abrir términos" })}</a>}
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-5 sm:p-6">
        <h2 className="text-xl font-black text-amber-100">{tr({ fi: "Fail-closed-sääntö", en: "Fail-closed rule", es: "Regla de cierre seguro" })}</h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-amber-50/80">{tr({
          fi: "Tuntematon lähde, vahvistamaton kaupallinen oikeus, tutkimuskäyttöön rajattu lähde tai rekisteriin kuulumaton kenttä estetään. Puuttuva tieto näkyy puuttuvana eikä sitä korvata AI:n keksimällä arvolla.",
          en: "An unknown source, unverified commercial right, research-only source or unregistered field is blocked. Missing information remains missing and is never replaced with an AI-invented value.",
          es: "Se bloquean fuentes desconocidas, derechos no verificados, fuentes solo de investigación y campos no registrados. Los datos faltantes nunca se inventan."
        })}</p>
      </section>
    </div>
  );
}
