"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { EmptyState, MetricTile, PageHero, SectionHeader, TrustBar } from "../components/ProductUI";

function pct(value, digits = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)}%` : "–";
}

function number(value, digits = 2) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : "–";
}

function dateTime(value, locale = "fi-FI") {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(date) : "–";
}

function sportLabel(catalog, sport) {
  return catalog?.sports?.find((item) => item.sport === sport)?.label || sport?.replaceAll("_", " ") || "Sport";
}

function latestPerEvent(rows = []) {
  const latest = new Map();
  for (const row of rows) {
    const current = latest.get(row.eventId);
    if (!current || Date.parse(row.capturedAt) > Date.parse(current.capturedAt)) latest.set(row.eventId, row);
  }
  return [...latest.values()];
}

function CoverageRing({ value = 0, label }) {
  const bounded = Math.max(0, Math.min(1, Number(value || 0)));
  const degrees = Math.round(bounded * 360);
  return (
    <div className="flex items-center gap-5">
      <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full p-2" style={{ background: `conic-gradient(var(--sc-brand) ${degrees}deg, var(--sc-surface-soft) ${degrees}deg)` }}>
        <div className="grid h-full w-full place-items-center rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface)] text-center">
          <div><div className="text-2xl font-black text-[var(--sc-text)]">{pct(bounded)}</div><div className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--sc-faint)]">coverage</div></div>
        </div>
      </div>
      <div><div className="text-sm font-black text-[var(--sc-text)]">{label}</div><p className="mt-1 text-sm leading-6 text-[var(--sc-muted)]">Advanced metric coverage is calculated only from observations actually received from configured providers.</p></div>
    </div>
  );
}

function FamilyBar({ label, coverage, observedRows, available, required }) {
  const value = Math.max(0, Math.min(1, Number(coverage || 0)));
  return (
    <div className="rounded-[1.1rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="flex items-center justify-between gap-3"><div className="text-sm font-black capitalize text-[var(--sc-text)]">{label.replaceAll("_", " ")}</div><div className="text-xs font-black text-[var(--sc-muted)]">{required ? `${available}/${required}` : `${observedRows || 0} rows`}</div></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--sc-surface-hover)]"><div className="h-full rounded-full bg-[var(--sc-brand)] transition-all" style={{ width: `${Math.max(value * 100, observedRows && !required ? 12 : 0)}%` }} /></div>
      <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]"><span>{observedRows || 0} observations</span><span>{required ? pct(value) : "operational"}</span></div>
    </div>
  );
}

function ProviderCard({ name, provider }) {
  const mode = provider?.mode || provider?.transport || "unknown";
  const ok = provider?.ok === true || mode === "live" || provider?.configured === true;
  return (
    <div className={`rounded-[1.2rem] border p-4 ${ok ? "border-emerald-400/25 bg-emerald-400/10" : "border-amber-400/25 bg-amber-400/10"}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">{name}</div>
      <div className="mt-2 text-lg font-black">{provider?.source || "Not configured"}</div>
      <div className="mt-1 text-sm opacity-80">{mode} · {Number(provider?.observationCount || 0)} observations</div>
      {provider?.reason && <div className="mt-2 text-xs leading-5 opacity-75">{provider.reason}</div>}
    </div>
  );
}

function GolfProfile({ rows = [], tr }) {
  if (!rows.length) return null;
  const maximum = Math.max(...rows.map((row) => Number(row.averageEndDistanceMeters || 0)), 1);
  return (
    <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
      <SectionHeader eyebrow="Golf proximity" title={tr({ fi: "Etäisyysprofiili eri lyöntimatkoilta", en: "Distance profile from every approach range", es: "Perfil de distancia por rango" })} description={tr({ fi: "Pylväs näyttää keskimääräisen jäljelle jäävän etäisyyden. Kortit näyttävät viheriöosumat, Proximity Gainedin ja tavoitealueet.", en: "Bars show average remaining distance. Cards show green-hit rate, Proximity Gained and target zones.", es: "Las barras muestran la distancia restante y las tarjetas la precisión." })} />
      <div className="mt-6 flex min-h-64 items-end gap-3 overflow-x-auto pb-2">
        {rows.map((row) => {
          const height = Math.max(12, Number(row.averageEndDistanceMeters || 0) / maximum * 190);
          return <div key={row.bucket} className="min-w-28 flex-1"><div className="flex h-52 items-end justify-center"><div className="w-14 rounded-t-2xl bg-[var(--sc-brand)]" style={{ height }} /></div><div className="mt-3 text-center text-xs font-black text-[var(--sc-text)]">{row.bucket}</div><div className="mt-1 text-center text-[11px] text-[var(--sc-muted)]">{number(row.averageEndDistanceMeters, 1)} m left</div><div className="mt-2 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-2 text-[10px] leading-5 text-[var(--sc-muted)]"><div>GIR {pct(row.greenHitRate)}</div><div>PG {row.proximityGainedMeters === null ? "–" : `${number(row.proximityGainedMeters, 1)} m`}</div><div>≤5 m {pct(row.targetZoneRates?.["5m"])}</div></div></div>;
        })}
      </div>
    </section>
  );
}

export default function SportsAnalyticsClient() {
  const { tr } = useLanguage();
  const locale = "fi-FI";
  const [state, setState] = useState({ loading: true, error: "", payload: null, catalog: null });
  const [selectedSport, setSelectedSport] = useState("");
  const [definition, setDefinition] = useState(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const [dataResponse, catalogResponse] = await Promise.all([
        fetch("/api/sports-analytics?hours=168&limit=500", { cache: "no-store" }),
        fetch("/api/sports-analytics/catalog", { cache: "no-store" })
      ]);
      const [payload, catalog] = await Promise.all([dataResponse.json(), catalogResponse.json()]);
      if (!dataResponse.ok || payload?.ok === false) throw new Error(payload?.error || "Sports analytics unavailable");
      if (!catalogResponse.ok || catalog?.ok === false) throw new Error(catalog?.error || "Sports catalogue unavailable");
      setState({ loading: false, error: "", payload, catalog });
      setSelectedSport((current) => current || payload.summary?.sports?.[0]?.sport || catalog.sports?.[0]?.sport || "soccer");
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : "Sports analytics unavailable" }));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true;
    if (!selectedSport) return undefined;
    fetch(`/api/sports-analytics/catalog?sport=${encodeURIComponent(selectedSport)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => { if (active && payload?.ok) setDefinition(payload.definition); })
      .catch(() => { if (active) setDefinition(null); });
    return () => { active = false; };
  }, [selectedSport]);

  const payload = state.payload;
  const allSnapshots = payload?.snapshots || [];
  const snapshots = useMemo(() => latestPerEvent(allSnapshots.filter((row) => !selectedSport || row.canonicalSport === selectedSport)), [allSnapshots, selectedSport]);
  const observations = useMemo(() => (payload?.observations || []).filter((row) => !selectedSport || row.canonicalSport === selectedSport), [payload, selectedSport]);
  const availableMetrics = useMemo(() => [...new Set(snapshots.flatMap((row) => row.availableMetrics || []))].sort(), [snapshots]);
  const catalogMetrics = useMemo(() => Object.values(definition?.families || {}).flat(), [definition]);
  const missingMetrics = useMemo(() => catalogMetrics.filter((metric) => !availableMetrics.includes(metric)), [catalogMetrics, availableMetrics]);
  const coverage = snapshots.length ? snapshots.reduce((sum, row) => sum + Number(row.coverageScore || 0), 0) / snapshots.length : 0;
  const familyRows = useMemo(() => {
    const map = new Map();
    for (const snapshot of snapshots) {
      for (const row of snapshot.familyCoverage || []) {
        const current = map.get(row.family) || { family: row.family, required: 0, available: 0, observedRows: 0, samples: 0 };
        current.required += Number(row.requiredMetricCount || 0);
        current.available += Number(row.availableMetricCount || 0);
        current.observedRows += Number(row.observedRows || 0);
        current.samples += 1;
        map.set(row.family, current);
      }
    }
    if (!map.size) for (const family of Object.keys(definition?.families || {})) map.set(family, { family, required: definition.families[family].length, available: 0, observedRows: 0, samples: 1 });
    return [...map.values()].map((row) => ({ ...row, coverage: row.required ? row.available / row.required : 0 })).sort((a, b) => b.observedRows - a.observedRows || b.coverage - a.coverage);
  }, [snapshots, definition]);
  const providers = useMemo(() => {
    const result = new Map();
    for (const snapshot of snapshots) for (const [name, provider] of Object.entries(snapshot.providerStatus || {})) if (!result.has(name)) result.set(name, provider);
    if (payload?.externalProvider && !result.has("external")) result.set("external", payload.externalProvider);
    return [...result.entries()];
  }, [snapshots, payload]);
  const golfProfile = snapshots.find((row) => row.golfProfile?.length)?.golfProfile || [];
  const sportSummary = payload?.summary?.sports?.find((row) => row.sport === selectedSport) || {};

  return (
    <div className="space-y-10">
      <PageHero
        tone="purple"
        eyebrow="Sports Analytics V1"
        title={tr({ fi: "Automaattinen monilajinen datakeskus", en: "Automatic multi-sport data center", es: "Centro automático de datos multideporte" })}
        description={tr({ fi: "Scorecaster kerää jokaisesta varmennetusta tapahtumasta markkina-, laatu-, kokoonpano-, poissaolo-, lepo-, sää- ja kontekstihavainnot. Ulkoinen adapteri liittää samaan näkymään xG-, tracking-, pelaaja- ja golf-shot-datan.", en: "Scorecaster automatically captures market, quality, lineup, availability, workload, weather and context observations. One external adapter adds xG, tracking, player and golf-shot feeds.", es: "Scorecaster captura automáticamente datos de mercado, contexto, disponibilidad y rendimiento." })}
        actions={<><button type="button" className="sc-button-primary" onClick={() => void load()} disabled={state.loading}>{state.loading ? "…" : tr({ fi: "Päivitä näkymä", en: "Refresh view", es: "Actualizar" })}</button><Link className="sc-button-secondary" href="/data-layer">Unified Data</Link><Link className="sc-button-ghost" href="/api/sports-analytics">API JSON</Link></>}
        aside={<div className="grid grid-cols-2 gap-2"><MetricTile compact label={tr({ fi: "Tapahtumia", en: "Events", es: "Eventos" })} value={payload?.summary?.eventCount || 0} /><MetricTile compact label={tr({ fi: "Havaintoja", en: "Observations", es: "Observaciones" })} value={payload?.summary?.observationCount || 0} tone="purple" /><MetricTile compact label={tr({ fi: "Providereita", en: "Providers", es: "Proveedores" })} value={payload?.summary?.providerCount || 0} tone="green" /><MetricTile compact label={tr({ fi: "Automaattinen", en: "Automatic", es: "Automático" })} value="30 min" tone="blue" /></div>}
      />

      <TrustBar items={[
        { label: tr({ fi: "Keräys", en: "Capture", es: "Captura" }), value: "30 min", tone: "good" },
        { label: tr({ fi: "Todennäköisyys", en: "Probability", es: "Probabilidad" }), value: "no-vig market consensus", tone: "info" },
        { label: tr({ fi: "Ulkoinen data", en: "External data", es: "Datos externos" }), value: payload?.externalProvider?.configured ? "configured" : "adapter ready", tone: payload?.externalProvider?.configured ? "good" : "warning" },
        { label: tr({ fi: "Korotus", en: "Upgrade", es: "Mejora" }), value: "disabled", tone: "warning" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: "paper-only", tone: "warning" }
      ]} />

      {state.error && <div className="rounded-[1.2rem] border border-rose-400/30 bg-rose-400/10 p-5 text-rose-200">{state.error}</div>}
      {payload?.liveFallback && <div className="rounded-[1.2rem] border border-amber-400/25 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100"><strong>{tr({ fi: "Live fallback käytössä.", en: "Live fallback is active.", es: "Fallback en vivo activo." })}</strong> {tr({ fi: "Sivu näyttää nykyisen automaattisen datan, mutta pysyvä historia alkaa vasta kun Supabase-migraatio on ajettu.", en: "The page shows current automatic data, but persistent history starts after the Supabase migration is applied.", es: "La vista muestra datos actuales; el historial requiere la migración." })}</div>}

      {!state.loading && !state.error && !payload?.summary?.eventCount && <EmptyState title={tr({ fi: "Analytiikkatapahtumia ei ole vielä", en: "No analytics events yet", es: "Aún no hay eventos analíticos" })} description={tr({ fi: "Työntekijä täyttää näkymän automaattisesti varmennetuista Top Picks -tapahtumista.", en: "The worker fills this view automatically from verified Top Picks events.", es: "El proceso llena esta vista desde eventos verificados." })} />}

      <section className="space-y-4">
        <SectionHeader eyebrow={tr({ fi: "Lajit", en: "Sports", es: "Deportes" })} title={tr({ fi: "Valitse analysoitava laji", en: "Choose a sport to inspect", es: "Elige un deporte" })} description={tr({ fi: "Kortti näyttää viimeisimmän viikon tapahtumat, havainnot ja edistyneiden mittareiden kattavuuden.", en: "Each card shows events, observations and advanced-metric coverage from the latest week.", es: "Cada tarjeta muestra eventos, observaciones y cobertura." })} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {(state.catalog?.sports || []).map((sport) => {
            const summary = payload?.summary?.sports?.find((row) => row.sport === sport.sport);
            const active = selectedSport === sport.sport;
            return <button type="button" key={sport.sport} onClick={() => setSelectedSport(sport.sport)} className={`rounded-[1.2rem] border p-4 text-left transition ${active ? "border-[var(--sc-brand)] bg-[var(--sc-brand-soft)]" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] hover:border-[var(--sc-brand-border)]"}`}><div className="font-black text-[var(--sc-text)]">{sport.label}</div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--sc-muted)]"><span>{summary?.events || 0} events</span><span>{summary?.observations || 0} rows</span><span>{summary?.providers || 0} providers</span><span>{pct(summary?.coverage || 0)}</span></div></button>;
          })}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="sc-surface rounded-[1.65rem] p-5 sm:p-6"><CoverageRing value={coverage} label={`${sportLabel(state.catalog, selectedSport)} · ${sportSummary.observations || observations.length} observations`} /><div className="mt-6 grid grid-cols-2 gap-3"><MetricTile label={tr({ fi: "Tapahtumia", en: "Events", es: "Eventos" })} value={snapshots.length} /><MetricTile label={tr({ fi: "Saatavilla", en: "Available metrics", es: "Métricas disponibles" })} value={availableMetrics.length} tone="green" /><MetricTile label={tr({ fi: "Puuttuu", en: "Missing metrics", es: "Métricas faltantes" })} value={missingMetrics.length} tone="yellow" /><MetricTile label={tr({ fi: "Viimeisin", en: "Latest", es: "Último" })} value={dateTime(sportSummary.latestCapturedAt || payload?.summary?.latestCapturedAt, locale)} /></div></div>
        <div className="sc-surface rounded-[1.65rem] p-5 sm:p-6"><SectionHeader eyebrow="Coverage map" title={tr({ fi: "Dataperheiden kattavuus", en: "Data-family coverage", es: "Cobertura por familia" })} description={tr({ fi: "Operational-rivit näkyvät heti. Edistyneiden metriikoiden prosentti kasvaa vain, kun provider todella toimittaa kyseisen xG-, tracking- tai expected-mittarin.", en: "Operational rows appear immediately. Advanced coverage increases only when a provider actually supplies the xG, tracking or expected metric.", es: "La cobertura avanzada aumenta solo con métricas reales del proveedor." })} /><div className="mt-5 grid gap-3 sm:grid-cols-2">{familyRows.map((row) => <FamilyBar key={row.family} label={row.family} coverage={row.coverage} observedRows={row.observedRows} available={row.available} required={row.required} />)}</div></div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="sc-surface rounded-[1.65rem] p-5 sm:p-6"><SectionHeader eyebrow={tr({ fi: "Saatavilla", en: "Available", es: "Disponible" })} title={tr({ fi: "Automaattisesti kerätyt mittarit", en: "Automatically captured metrics", es: "Métricas capturadas" })} /><div className="mt-5 flex max-h-72 flex-wrap gap-2 overflow-y-auto">{availableMetrics.length ? availableMetrics.map((metric) => <span key={metric} className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200">{metric}</span>) : <span className="text-sm text-[var(--sc-muted)]">No metrics yet.</span>}</div></div>
        <div className="sc-surface rounded-[1.65rem] p-5 sm:p-6"><SectionHeader eyebrow={tr({ fi: "Puuttuu", en: "Missing", es: "Falta" })} title={tr({ fi: "Seuraavaksi aktivoitavat mittarit", en: "Metrics to activate next", es: "Métricas por activar" })} /><div className="mt-5 flex max-h-72 flex-wrap gap-2 overflow-y-auto">{missingMetrics.slice(0, 120).map((metric) => <span key={metric} className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-100">{metric}</span>)}</div></div>
      </section>

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6"><SectionHeader eyebrow="Providers" title={tr({ fi: "Automaattisten datalähteiden tila", en: "Automatic provider status", es: "Estado de proveedores" })} description={tr({ fi: "Scorecasterin sisäinen datakerros toimii ilman uutta avainta. Tracking- ja xG-provider aktivoituu palvelinympäristön asetuksilla.", en: "Scorecaster's internal layer works without a new key. The tracking/xG provider activates through server environment settings.", es: "La capa interna funciona sin clave adicional; el proveedor externo se activa en el servidor." })} /><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{providers.map(([name, provider]) => <ProviderCard key={name} name={name} provider={provider} />)}</div></section>

      <GolfProfile rows={golfProfile} tr={tr} />

      <section className="space-y-4"><SectionHeader eyebrow={tr({ fi: "Tapahtumat", en: "Events", es: "Eventos" })} title={tr({ fi: "Viimeisimmät analytiikkasnapshotit", en: "Latest analytics snapshots", es: "Últimos snapshots" })} /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{snapshots.map((row) => <article key={`${row.eventId}:${row.captureBucket}`} className="rounded-[1.3rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-faint)]">{row.league || row.sportKey}</div><h3 className="mt-2 text-lg font-black text-[var(--sc-text)]">{row.match}</h3><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-[var(--sc-surface)] p-2"><div className="font-black">{row.observationCount}</div><div className="text-[9px] uppercase text-[var(--sc-faint)]">rows</div></div><div className="rounded-xl bg-[var(--sc-surface)] p-2"><div className="font-black">{row.providerCount}</div><div className="text-[9px] uppercase text-[var(--sc-faint)]">providers</div></div><div className="rounded-xl bg-[var(--sc-surface)] p-2"><div className="font-black">{pct(row.coverageScore)}</div><div className="text-[9px] uppercase text-[var(--sc-faint)]">coverage</div></div></div><div className="mt-3 text-xs text-[var(--sc-muted)]">{dateTime(row.capturedAt, locale)}</div></article>)}</div></section>

      <section className="sc-surface overflow-hidden rounded-[1.65rem]"><div className="p-5 sm:p-6"><SectionHeader eyebrow={tr({ fi: "Havainnot", en: "Observations", es: "Observaciones" })} title={tr({ fi: "Viimeisin normalisoitu data", en: "Latest normalized data", es: "Datos normalizados recientes" })} description={tr({ fi: "Kaikki providerit muutetaan samaan muotoon: perhe, mittari, arvo, aika, luottamus ja confidence.", en: "Every provider is normalized into family, metric, value, time, trust and confidence.", es: "Todos los proveedores usan el mismo formato normalizado." })} /></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-y border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]"><tr><th className="px-5 py-3">Time</th><th className="px-5 py-3">Family</th><th className="px-5 py-3">Metric</th><th className="px-5 py-3">Value</th><th className="px-5 py-3">Provider</th><th className="px-5 py-3">Trust</th><th className="px-5 py-3">Confidence</th></tr></thead><tbody>{observations.slice(0, 80).map((row, index) => <tr key={`${row.eventId}:${row.metric}:${row.observedAt}:${index}`} className="border-b border-[var(--sc-border)] text-[var(--sc-muted)]"><td className="px-5 py-3">{dateTime(row.observedAt, locale)}</td><td className="px-5 py-3 font-bold capitalize text-[var(--sc-text)]">{row.family}</td><td className="px-5 py-3">{row.metric}</td><td className="px-5 py-3 font-mono text-[var(--sc-text)]">{number(row.value, 3)} {row.unit || ""}</td><td className="px-5 py-3">{row.provider}</td><td className="px-5 py-3">{pct(row.sourceTrust)}</td><td className="px-5 py-3">{pct(row.confidence)}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}
