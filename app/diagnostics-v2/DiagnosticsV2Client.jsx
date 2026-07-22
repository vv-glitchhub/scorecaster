"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import {
  DecisionBadge,
  EmptyState,
  MetricTile,
  PageHero,
  SectionHeader,
  TrustBar
} from "../components/ProductUI";

function percent(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)} %` : "–";
}

function number(value, digits = 1) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : "–";
}

function money(value, locale) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function statusTone(status) {
  if (["healthy", "good"].includes(status)) return "green";
  if (["watch", "degraded"].includes(status)) return "yellow";
  if (["blocked", "down"].includes(status)) return "red";
  return "default";
}

function AlertCard({ alert, tr }) {
  const danger = alert.severity === "high";
  return (
    <div className={`rounded-[1.25rem] border p-5 ${danger ? "border-rose-400/30 bg-rose-400/10" : "border-amber-400/30 bg-amber-400/10"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${danger ? "bg-rose-400/15 text-rose-200" : "bg-amber-400/15 text-amber-200"}`}>{alert.severity}</span>
        <span className="text-xs text-[var(--sc-faint)]">{alert.active === false ? tr({ fi: "Ratkaistu", en: "Resolved", es: "Resuelto" }) : tr({ fi: "Aktiivinen", en: "Active", es: "Activo" })}</span>
      </div>
      <h3 className="mt-3 text-lg font-black text-[var(--sc-text)]">{alert.title}</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--sc-muted)]">{alert.message}</p>
    </div>
  );
}

function HistoryRow({ item, locale }) {
  const total = Math.max(1, Number(item.total || 0));
  return (
    <div className="rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-black text-[var(--sc-text)]">{new Date(item.capturedAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
          <div className="mt-0.5 text-xs text-[var(--sc-muted)]">{item.total} selections · provider {item.providerHealth?.score ?? "–"}/100</div>
        </div>
        <div className="flex gap-2 text-xs font-black"><span className="text-emerald-300">PLAY {item.counts.PLAY}</span><span className="text-amber-300">CAUTION {item.counts.CAUTION}</span><span className="text-rose-300">SKIP {item.counts.SKIP}</span></div>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[var(--sc-border)]">
        <span className="bg-emerald-400" style={{ width: `${item.counts.PLAY / total * 100}%` }} />
        <span className="bg-amber-400" style={{ width: `${item.counts.CAUTION / total * 100}%` }} />
        <span className="bg-rose-400" style={{ width: `${item.counts.SKIP / total * 100}%` }} />
      </div>
    </div>
  );
}

export default function DiagnosticsV2Client({ focus = "all" }) {
  const { tr, locale } = useLanguage();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [thresholds, setThresholds] = useState({ playEdge: 0.02, playEv: 0.03, playConfidence: 0.55, playBookmakers: 4 });

  const load = useCallback(async (values = thresholds) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        limit: "72",
        playEdge: String(values.playEdge),
        playEv: String(values.playEv),
        playConfidence: String(values.playConfidence),
        playBookmakers: String(values.playBookmakers)
      });
      const response = await fetch(`/api/diagnostics-v2?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.error || "Diagnostics V2 unavailable");
      setPayload(data);
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Diagnostics V2 unavailable");
    } finally {
      setLoading(false);
    }
  }, [thresholds]);

  useEffect(() => { void load(thresholds); }, []);

  const activeAlerts = useMemo(() => {
    if (!payload) return [];
    const stored = (payload.alerts?.stored || []).filter((item) => item.active);
    return stored.length ? stored : payload.alerts?.live || [];
  }, [payload]);

  const current = payload?.current;
  const provider = payload?.providerHealth;
  const outcomes = payload?.outcomes?.analysis;
  const simulation = payload?.simulator;
  const history = payload?.history?.items || [];
  const production = payload?.productionThresholds || {};
  const showAll = focus === "all";

  return (
    <div className="space-y-8">
      <PageHero
        tone="purple"
        eyebrow="Decision Diagnostics V2"
        title={tr({ fi: "Mittaa päätösvirtaa ajan, datan ja tulosten läpi", en: "Measure the decision flow across time, data and outcomes", es: "Mide el flujo de decisiones en el tiempo, datos y resultados" })}
        description={tr({ fi: "Historia, automaattiset incidentit, Provider Health, paperitulokset, CLV ja turvallinen kynnysarvosimulaatio samassa auditoinnissa.", en: "History, automatic incidents, Provider Health, paper outcomes, CLV and a safe threshold simulator in one audit.", es: "Historial, incidencias, salud del proveedor, resultados, CLV y simulador seguro." })}
        actions={<><button type="button" className="sc-button-primary" onClick={() => void load()} disabled={loading}>{loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä diagnostiikka", en: "Refresh diagnostics", es: "Actualizar diagnóstico" })}</button><Link href="/diagnostics" className="sc-button-secondary">{tr({ fi: "Avaa V1-päätösloki", en: "Open V1 decision log", es: "Abrir registro V1" })}</Link></>}
        aside={current ? <div className="grid grid-cols-2 gap-2"><MetricTile compact label="PLAY" value={current.counts.PLAY} tone="green" /><MetricTile compact label="CAUTION" value={current.counts.CAUTION} tone="yellow" /><MetricTile compact label="SKIP" value={current.counts.SKIP} tone="red" /><MetricTile compact label="Provider" value={`${provider?.score ?? 0}/100`} tone={statusTone(provider?.status)} /></div> : null}
      />

      {error && <div className="rounded-[1.25rem] border border-rose-400/30 bg-rose-400/10 p-5 text-rose-200">{error}</div>}
      {payload && <TrustBar items={[
        { label: tr({ fi: "Versio", en: "Version", es: "Versión" }), value: payload.version },
        { label: tr({ fi: "Historia", en: "History", es: "Historial" }), value: payload.history.available ? `${history.length} snapshots` : payload.history.warning, tone: payload.history.available ? "info" : "warning" },
        { label: tr({ fi: "Tulokset", en: "Outcomes", es: "Resultados" }), value: payload.outcomes.available ? `${outcomes.settled} settled` : payload.outcomes.warning, tone: payload.outcomes.available ? "info" : "warning" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: tr({ fi: "kuvaileva, paperitila", en: "descriptive, paper-only", es: "descriptivo, simulado" }), tone: "warning" }
      ]} />}

      {!loading && !payload && !error && <EmptyState title="Diagnostics V2 unavailable" />}

      {payload && <>
        {(showAll || focus === "alerts") && <section id="alerts">
          <SectionHeader eyebrow={tr({ fi: "Automaattinen valvonta", en: "Automatic monitoring", es: "Monitorización automática" })} title={tr({ fi: "All-SKIP-, stale-data- ja provider-hälytykset", en: "All-SKIP, stale-data and provider alerts", es: "Alertas all-SKIP, datos antiguos y proveedor" })} description={tr({ fi: "Tuntityöntekijä tallentaa snapshotin ja avaa tai sulkee incidentit ilman, että päätösrajoja muutetaan.", en: "An hourly worker stores a snapshot and opens or resolves incidents without changing decision thresholds.", es: "Un proceso horario guarda snapshots y gestiona incidencias sin cambiar umbrales." })} />
          {activeAlerts.length ? <div className="grid gap-4 md:grid-cols-2">{activeAlerts.map((alert) => <AlertCard key={alert.fingerprint || alert.id} alert={alert} tr={tr} />)}</div> : <EmptyState title={tr({ fi: "Aktiivisia diagnostiikkahälytyksiä ei ole", en: "No active diagnostic alerts", es: "No hay alertas activas" })} description={payload.alerts.warning || tr({ fi: "Nykyinen päätösvirta ei laukaise all-SKIP-, stale- tai provider-sääntöjä.", en: "The current decision flow does not trigger all-SKIP, stale or provider rules.", es: "El flujo actual no activa reglas de alerta." })} />}
        </section>}

        {(showAll || focus === "history") && <section id="history">
          <SectionHeader eyebrow={tr({ fi: "Supabase-historia", en: "Supabase history", es: "Historial de Supabase" })} title={tr({ fi: "Päätösjakauma tunti tunnilta", en: "Decision distribution hour by hour", es: "Distribución de decisiones por hora" })} description={tr({ fi: "Historia paljastaa, onko all-SKIP yksittäinen datahetki vai jatkuva järjestelmätila.", en: "History shows whether all-SKIP is a single data moment or a persistent system state.", es: "El historial muestra si all-SKIP es puntual o persistente." })} />
          {!payload.history.available ? <EmptyState title={tr({ fi: "Historia odottaa Supabase-migraatiota", en: "History is waiting for the Supabase migration", es: "El historial espera la migración" })} description={payload.history.warning} /> : history.length === 0 ? <EmptyState title={tr({ fi: "Ensimmäinen tuntisnapshot ei ole vielä tallentunut", en: "The first hourly snapshot has not been stored yet", es: "Aún no se ha guardado el primer snapshot" })} description={tr({ fi: "Cron alkaa täyttää tämän näkymän automaattisesti.", en: "The cron worker will populate this view automatically.", es: "El cron llenará esta vista automáticamente." })} /> : <div className="grid gap-3 lg:grid-cols-2">{history.slice(0, 24).map((item) => <HistoryRow key={item.id} item={item} locale={locale} />)}</div>}
        </section>}

        {(showAll || focus === "provider") && <section id="provider-health">
          <SectionHeader eyebrow="Provider Health V1" title={tr({ fi: "Erota datantarjoajan ongelma mallin ongelmasta", en: "Separate provider problems from model problems", es: "Separa problemas del proveedor y del modelo" })} description={tr({ fi: "Saatavuus, hyväksyttyjen otteluiden osuus, tuoreus, vedonvälittäjäkattavuus ja liigakohtainen tila.", en: "Availability, accepted-fixture rate, freshness, bookmaker coverage and league-level health.", es: "Disponibilidad, aceptación, actualidad, cobertura y salud por liga." })} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><MetricTile label={tr({ fi: "Terveys", en: "Health", es: "Salud" })} value={`${provider.score}/100`} tone={statusTone(provider.status)} /><MetricTile label={tr({ fi: "Tila", en: "Status", es: "Estado" })} value={provider.status.toUpperCase()} tone={statusTone(provider.status)} /><MetricTile label={tr({ fi: "Hyväksyntä", en: "Acceptance", es: "Aceptación" })} value={percent(provider.coverageRate)} tone={provider.coverageRate >= 0.5 ? "green" : "yellow"} /><MetricTile label={tr({ fi: "Stale-osuus", en: "Stale rate", es: "Datos antiguos" })} value={percent(provider.staleRate)} tone={provider.staleRate >= 0.5 ? "red" : "green"} /><MetricTile label={tr({ fi: "Vedonvälittäjiä", en: "Bookmakers", es: "Casas" })} value={number(provider.averageBookmakers)} tone={Number(provider.averageBookmakers) >= 4 ? "green" : "yellow"} /></div>
          <div className="mt-5 overflow-x-auto rounded-[1.35rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]"><table className="min-w-full text-left text-sm"><thead className="text-[10px] uppercase tracking-[0.14em] text-[var(--sc-faint)]"><tr><th className="p-4">League</th><th className="p-4">Status</th><th className="p-4">PLAY</th><th className="p-4">CAUTION</th><th className="p-4">SKIP</th><th className="p-4">Bookmakers</th><th className="p-4">Stale</th></tr></thead><tbody>{provider.leagues.map((league) => <tr key={league.league} className="border-t border-[var(--sc-border)]"><td className="p-4 font-black text-[var(--sc-text)]">{league.league}</td><td className="p-4"><span className="font-black uppercase text-[var(--sc-muted)]">{league.status}</span></td><td className="p-4 text-emerald-300">{league.PLAY}</td><td className="p-4 text-amber-300">{league.CAUTION}</td><td className="p-4 text-rose-300">{league.SKIP}</td><td className="p-4">{number(league.averageBookmakers)}</td><td className="p-4">{percent(league.staleRate)}</td></tr>)}</tbody></table></div>
        </section>}

        {(showAll || focus === "outcomes") && <section id="outcomes">
          <SectionHeader eyebrow={tr({ fi: "Tulokset ja CLV", en: "Outcomes and CLV", es: "Resultados y CLV" })} title={tr({ fi: "Miten tallennetut päätökset ovat oikeasti toimineet", en: "How saved decisions actually performed", es: "Cómo rindieron las decisiones guardadas" })} description={outcomes?.limitation} />
          {!payload.outcomes.available ? <EmptyState title={tr({ fi: "Kirjaudu nähdäksesi oman paperihistorian", en: "Sign in to see your paper history", es: "Inicia sesión para ver tu historial" })} description={payload.outcomes.warning} actionHref="/login" actionLabel={tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })} /> : <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><MetricTile label={tr({ fi: "Ratkaistut", en: "Settled", es: "Resueltos" })} value={outcomes.settled} /><MetricTile label="ROI" value={percent(outcomes.roi)} tone={outcomes.roi > 0 ? "green" : outcomes.roi < 0 ? "red" : "default"} /><MetricTile label={tr({ fi: "Paperitulos", en: "Paper result", es: "Resultado" })} value={money(outcomes.totalProfit, locale)} tone={outcomes.totalProfit > 0 ? "green" : outcomes.totalProfit < 0 ? "red" : "default"} /><MetricTile label="CLV" value={outcomes.averageClv === null ? "–" : `${number(outcomes.averageClv, 2)} %`} tone={outcomes.averageClv > 0 ? "green" : "default"} /><MetricTile label={tr({ fi: "Positiivinen CLV", en: "Positive CLV", es: "CLV positivo" })} value={outcomes.positiveClvRate === null ? "–" : percent(outcomes.positiveClvRate)} /></div><div className="mt-5 grid gap-4 md:grid-cols-3">{outcomes.byDecision.map((group) => <div key={group.decision} className="sc-surface rounded-[1.35rem] p-5"><DecisionBadge decision={group.decision} /><div className="mt-4 text-3xl font-black text-[var(--sc-text)]">{group.settled}</div><div className="text-xs uppercase tracking-[0.14em] text-[var(--sc-faint)]">settled</div><div className="mt-4 space-y-2 text-sm text-[var(--sc-muted)]"><div className="flex justify-between"><span>ROI</span><strong>{percent(group.roi)}</strong></div><div className="flex justify-between"><span>Win rate</span><strong>{percent(group.winRate)}</strong></div><div className="flex justify-between"><span>CLV</span><strong>{group.averageClv === null ? "–" : `${number(group.averageClv, 2)} %`}</strong></div></div></div>)}</div></>}
        </section>}

        {(showAll || focus === "simulator") && <section id="threshold-simulator">
          <SectionHeader eyebrow={tr({ fi: "Turvallinen simulaatio", en: "Safe simulation", es: "Simulación segura" })} title={tr({ fi: "Mitä päätösjakaumalle tapahtuisi eri PLAY-rajoilla?", en: "What would happen under different PLAY thresholds?", es: "¿Qué pasaría con otros umbrales PLAY?" })} description={tr({ fi: "Simulaatio ei kirjoita asetuksia, muuta tuotannon päätöksiä eikä nosta kohteita oikeasti PLAYksi.", en: "The simulator never writes settings, changes production decisions or actually upgrades a pick to PLAY.", es: "El simulador no guarda ajustes ni cambia decisiones reales." })} />
          <div className="grid gap-4 rounded-[1.45rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 md:grid-cols-4"><label className="text-xs font-black text-[var(--sc-muted)]">PLAY edge<input type="number" step="0.005" min="0.005" max="0.15" value={thresholds.playEdge} onChange={(event) => setThresholds((value) => ({ ...value, playEdge: Number(event.target.value) }))} className="sc-input mt-2 w-full" /></label><label className="text-xs font-black text-[var(--sc-muted)]">PLAY EV<input type="number" step="0.005" min="0.005" max="0.25" value={thresholds.playEv} onChange={(event) => setThresholds((value) => ({ ...value, playEv: Number(event.target.value) }))} className="sc-input mt-2 w-full" /></label><label className="text-xs font-black text-[var(--sc-muted)]">Confidence<input type="number" step="0.05" min="0.35" max="0.95" value={thresholds.playConfidence} onChange={(event) => setThresholds((value) => ({ ...value, playConfidence: Number(event.target.value) }))} className="sc-input mt-2 w-full" /></label><label className="text-xs font-black text-[var(--sc-muted)]">Bookmakers<input type="number" step="1" min="2" max="12" value={thresholds.playBookmakers} onChange={(event) => setThresholds((value) => ({ ...value, playBookmakers: Number(event.target.value) }))} className="sc-input mt-2 w-full" /></label><div className="md:col-span-4 flex flex-wrap gap-3"><button type="button" className="sc-button-primary" onClick={() => void load(thresholds)}>{tr({ fi: "Laske simulaatio", en: "Run simulation", es: "Calcular simulación" })}</button><button type="button" className="sc-button-secondary" onClick={() => { const reset = { playEdge: production.minimumPlayEdge ?? 0.02, playEv: production.minimumPlayEv ?? 0.03, playConfidence: production.minimumPlayConfidence ?? 0.55, playBookmakers: production.minimumPlayBookmakers ?? 4 }; setThresholds(reset); void load(reset); }}>{tr({ fi: "Palauta tuotantorajat", en: "Restore production thresholds", es: "Restaurar umbrales" })}</button></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4"><MetricTile label="PLAY" value={simulation.counts.PLAY} tone="green" /><MetricTile label="CAUTION" value={simulation.counts.CAUTION} tone="yellow" /><MetricTile label="SKIP" value={simulation.counts.SKIP} tone="red" /><MetricTile label={tr({ fi: "Muuttuvat päätökset", en: "Changed decisions", es: "Decisiones cambiadas" })} value={simulation.changedCount} tone="purple" /></div>
          {simulation.changed.length > 0 && <div className="mt-5 space-y-3">{simulation.changed.slice(0, 12).map((item) => <div key={item.id} className="sc-surface flex flex-col gap-3 rounded-[1.25rem] p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-black text-[var(--sc-text)]">{item.match}</div><div className="mt-1 text-sm text-[var(--sc-muted)]">{item.selection} · edge {percent(item.edge)} · EV {percent(item.ev)}</div></div><div className="flex items-center gap-2"><DecisionBadge decision={item.currentDecision} /><span className="text-[var(--sc-faint)]">→</span><DecisionBadge decision={item.simulatedDecision} /></div></div>)}</div>}
        </section>}

        <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 text-sm leading-6 text-[var(--sc-muted)]">{payload.disclaimer}</div>
      </>}
    </div>
  );
}