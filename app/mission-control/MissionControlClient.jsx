"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import {
  DecisionBadge,
  EmptyState,
  MetricTile,
  PageHero,
  SectionHeader,
  TrustBar
} from "../components/ProductUI";

function pct(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)} %` : "–";
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)} €` : "–";
}

function decimal(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "–";
}

function modeTone(mode) {
  if (mode === "ACTIVE") return "green";
  if (mode === "GUARDED") return "blue";
  if (mode === "BOOTSTRAP") return "purple";
  if (mode === "DEGRADED") return "yellow";
  return "red";
}

function modeClass(mode) {
  if (mode === "ACTIVE") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  if (mode === "GUARDED") return "border-blue-400/30 bg-blue-400/10 text-blue-100";
  if (mode === "BOOTSTRAP") return "border-purple-400/30 bg-purple-400/10 text-purple-100";
  if (mode === "DEGRADED") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-rose-400/30 bg-rose-400/10 text-rose-100";
}

export default function MissionControlClient() {
  const { tr, locale } = useLanguage();
  const [state, setState] = useState({ loading: true, error: "", data: null });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch("/api/cloud/autonomy-mission-control", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Mission Control unavailable");
      setState({ loading: false, error: "", data: payload });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Mission Control unavailable", data: null });
    }
  }

  useEffect(() => { void load(); }, []);

  const data = state.data;
  const autonomy = data?.autonomy;
  const history = autonomy?.history;
  const readiness = autonomy?.dataReadiness;
  const modelLab = data?.modelLab;
  const brief = data?.brief;
  const daily = data?.daily;
  const mode = autonomy?.mode || "FROZEN";
  const recentRuns = data?.runs || [];
  const currentCandidates = data?.currentCandidates || [];
  const activeRunDecisions = useMemo(() => {
    const decisions = data?.latestRun?.summary?.decisions;
    return Array.isArray(decisions) ? decisions : [];
  }, [data?.latestRun]);

  const date = (value) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-8">
      <PageHero
        tone="purple"
        eyebrow="AUTONOMOUS SCORECASTER V12"
        title={tr({ fi: "Autonomisen agentin Mission Control", en: "Autonomous Agent Mission Control", es: "Centro de control del agente autónomo" })}
        description={tr({
          fi: "Yksi ohjaamo paperivalinnoille, oppimiselle, pelikassalle, provider-datalle, circuit breakereille ja worker-ajoille. Pysyvä UTC-päiväkiintiö estää useita worker-kierroksia ylittämästä päivän rajoja.",
          en: "One cockpit for paper selections, learning, bankroll health, provider data, circuit breakers and worker runs. A persistent UTC daily budget prevents repeated cycles from exceeding daily limits.",
          es: "Un centro para selecciones simuladas, aprendizaje, banca, proveedores y límites. Un presupuesto UTC persistente impide superar los límites diarios."
        })}
        actions={<><button type="button" onClick={() => void load()} disabled={state.loading} className="sc-button-primary">{state.loading ? "…" : tr({ fi: "Päivitä tila", en: "Refresh state", es: "Actualizar" })}</button><Link href="/autonomous-agent" className="sc-button-secondary">{tr({ fi: "Agentin asetukset", en: "Agent settings", es: "Configuración" })}</Link><Link href="/tracking" className="sc-button-ghost">{tr({ fi: "Paperisalkku", en: "Paper portfolio", es: "Cartera simulada" })}</Link></>}
        aside={<div className={`rounded-[1.4rem] border p-5 ${modeClass(mode)}`}><div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Autonomy mode</div><div className="mt-2 text-3xl font-black">{mode}</div><div className="mt-2 text-sm leading-6 opacity-90">{autonomy?.reason || tr({ fi: "Tilaa ladataan.", en: "Loading state.", es: "Cargando estado." })}</div></div>}
      />

      <TrustBar items={[
        { label: tr({ fi: "Toteutus", en: "Execution", es: "Ejecución" }), value: tr({ fi: "vain paperitila", en: "paper only", es: "solo simulado" }), tone: "warning" },
        { label: tr({ fi: "Päiväkiintiö", en: "Daily budget", es: "Presupuesto diario" }), value: "persistent UTC", tone: "good" },
        { label: tr({ fi: "Kovat katot", en: "Hard caps", es: "Límites duros" }), value: "1% / 5% / 2.5%", tone: "info" },
        { label: tr({ fi: "Automaattinen korotus", en: "Automatic upgrade", es: "Mejora automática" }), value: tr({ fi: "estetty", en: "disabled", es: "desactivada" }), tone: "warning" }
      ]} />

      {state.error && <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-5 text-rose-100">{state.error}</div>}
      {!state.loading && data?.available === false && <EmptyState title={tr({ fi: "Autonominen tuotantokerros ei ole vielä aktiivinen", en: "Autonomous production layer is not active", es: "La capa autónoma no está activa" })} description={data?.warning || "Migration and worker configuration required."} />}

      {data?.available && <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label={tr({ fi: "Päivän valinnat", en: "Daily picks", es: "Selecciones diarias" })} value={`${daily?.picksUsed || 0}/${daily?.pickLimit || 0}`} tone={Number(daily?.picksRemaining || 0) > 0 ? "green" : "red"} />
          <MetricTile label={tr({ fi: "Päivän virtuaalipanos", en: "Daily virtual stake", es: "Apuesta virtual diaria" })} value={`${money(daily?.stakeUsed)} / ${money(daily?.exposureCap)}`} tone={Number(daily?.exposureRemaining || 0) > 0 ? "blue" : "red"} />
          <MetricTile label={tr({ fi: "Jäljellä tänään", en: "Remaining today", es: "Restante hoy" })} value={`${daily?.picksRemaining || 0} · ${money(daily?.exposureRemaining)}`} tone={Number(daily?.picksRemaining || 0) > 0 && Number(daily?.exposureRemaining || 0) > 0 ? "green" : "yellow"} />
          <MetricTile label={tr({ fi: "Uniikit tapahtumat", en: "Unique events", es: "Eventos únicos" })} value={daily?.uniqueEvents || 0} tone="purple" />
          <MetricTile label={tr({ fi: "Ratkaistu otos", en: "Settled sample", es: "Muestra resuelta" })} value={history?.settledCount ?? 0} tone="blue" />
          <MetricTile label="ROI" value={pct(history?.roi)} tone={Number(history?.roi || 0) >= 0 ? "green" : "red"} />
          <MetricTile label="Average CLV" value={pct(history?.clv?.average)} tone={Number(history?.clv?.average || 0) >= 0 ? "green" : "yellow"} />
          <MetricTile label={tr({ fi: "Maksimidrawdown", en: "Maximum drawdown", es: "Drawdown máximo" })} value={`${money(history?.maxDrawdown)} · ${pct(history?.maxDrawdownRate)}`} tone={Number(history?.maxDrawdownRate || 0) >= 0.05 ? "red" : "default"} />
          <MetricTile label={tr({ fi: "Tappioputki", en: "Losing streak", es: "Racha de pérdidas" })} value={history?.currentLosingStreak ?? 0} tone={Number(history?.currentLosingStreak || 0) >= 4 ? "red" : "default"} />
          <MetricTile label={tr({ fi: "Varmennettu data", en: "Verified data", es: "Datos verificados" })} value={pct(readiness?.averageVerifiedCoverage)} tone={Number(readiness?.averageVerifiedCoverage || 0) >= 0.6 ? "green" : "yellow"} />
          <MetricTile label="Multi-provider" value={pct(readiness?.multiProviderRate)} tone={Number(readiness?.multiProviderRate || 0) >= 0.5 ? "green" : "yellow"} />
          <MetricTile label={tr({ fi: "Avoin paperialtistus", en: "Open paper exposure", es: "Exposición abierta" })} value={`${autonomy?.exposure?.openCount || 0} · ${money(autonomy?.exposure?.openStake)}`} tone="purple" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="sc-surface rounded-[1.7rem] p-6">
            <SectionHeader eyebrow={tr({ fi: "Päivittäinen brief", en: "Daily brief", es: "Resumen diario" })} title={brief?.headline || autonomy?.reason} description={tr({ fi: "Brief yhdistää autonomiatilan ja koko UTC-vuorokauden pysyvän valinta- ja altistusbudjetin.", en: "The brief combines autonomy state with the persistent pick and exposure budget for the whole UTC day.", es: "El resumen combina el estado con el presupuesto persistente de todo el día UTC." })} />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MetricTile compact label={tr({ fi: "Uusi altistus", en: "New exposure", es: "Nueva exposición" })} value={brief?.canCreateNewPaperExposure ? tr({ fi: "SALLITTU", en: "ALLOWED", es: "PERMITIDA" }) : tr({ fi: "ESTETTY", en: "BLOCKED", es: "BLOQUEADA" })} tone={brief?.canCreateNewPaperExposure ? "green" : "red"} />
              <MetricTile compact label={tr({ fi: "Panoskerroin", en: "Stake multiplier", es: "Multiplicador" })} value={`${decimal(autonomy?.stakeMultiplier, 2)}×`} tone={modeTone(mode)} />
              <MetricTile compact label={tr({ fi: "Tilakohtainen valintakatto", en: "Mode pick cap", es: "Límite por modo" })} value={autonomy?.pickCap ?? 0} />
              <MetricTile compact label={tr({ fi: "Pysyvä päiväkiintiö", en: "Persistent daily quota", es: "Cuota diaria persistente" })} value={`${daily?.picksRemaining || 0} / ${money(daily?.exposureRemaining)}`} tone={Number(daily?.picksRemaining || 0) > 0 ? "green" : "red"} />
              <MetricTile compact label={tr({ fi: "Yksittäinen PLAY", en: "Single PLAY", es: "PLAY individual" })} value={`≤ ${daily?.hardLimits?.maxStakePercent || 1}%`} />
              <MetricTile compact label={tr({ fi: "Päivä / avoin", en: "Daily / open", es: "Diario / abierto" })} value={`≤ ${daily?.hardLimits?.maxDailyExposurePercent || 5}%`} />
              <MetricTile compact label={tr({ fi: "Yksi liiga", en: "Single league", es: "Una liga" })} value={`≤ ${daily?.hardLimits?.maxLeagueExposurePercent || 2.5}%`} />
              <MetricTile compact label={tr({ fi: "Seuraava worker-tarkistus", en: "Next worker check", es: "Próxima revisión" })} value={date(data?.state?.next_check_at)} />
            </div>
            <div className="mt-5 space-y-2">{(brief?.recommendations || []).map((item) => <div key={item} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-sm leading-6 text-[var(--sc-text-secondary)]">{item}</div>)}</div>
          </div>

          <div className="sc-surface rounded-[1.7rem] p-6">
            <SectionHeader eyebrow="CIRCUIT BREAKERS" title={tr({ fi: "Miksi autonomia toimii tai pysähtyy", en: "Why autonomy runs or stops", es: "Por qué funciona o se detiene" })} />
            <div className="mt-4 space-y-3">
              {(autonomy?.blockers || []).length === 0 && <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">{tr({ fi: "Yksikään kova circuit breaker ei ole aktiivinen.", en: "No hard circuit breaker is active.", es: "No hay límites críticos activos." })}</div>}
              {(autonomy?.blockers || []).map((item) => <div key={item} className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-4"><div className="text-xs font-black uppercase tracking-[0.12em] text-rose-200">BLOCKER</div><div className="mt-1 font-bold text-rose-50">{item}</div></div>)}
              {(autonomy?.warnings || []).map((item) => <div key={item} className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4"><div className="text-xs font-black uppercase tracking-[0.12em] text-amber-200">WARNING</div><div className="mt-1 font-bold text-amber-50">{item}</div></div>)}
            </div>
          </div>
        </section>

        <section className="sc-surface rounded-[1.7rem] p-6">
          <SectionHeader eyebrow="CHAMPION / CHALLENGER" title={tr({ fi: "Mallin oppiminen ja promootiovalmius", en: "Model learning and promotion readiness", es: "Aprendizaje y preparación del modelo" })} description={tr({ fi: "Ehdokas valitaan koulutusjaksolla ja arvioidaan koskemattomalla kronologisella holdoutilla. Se ei muuta tuotannon todennäköisyyttä automaattisesti.", en: "The challenger is selected on training data and evaluated on an untouched chronological holdout. It never changes production probability automatically.", es: "El candidato se evalúa en un holdout cronológico y no cambia la probabilidad automáticamente." })} />
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricTile label={tr({ fi: "Labran tila", en: "Lab status", es: "Estado" })} value={modelLab?.status || "–"} tone={modelLab?.status === "promotion-ready" ? "green" : modelLab?.status === "frozen-drift" ? "red" : "yellow"} />
            <MetricTile label={tr({ fi: "Otos", en: "Sample", es: "Muestra" })} value={`${modelLab?.sampleSize || 0}/${modelLab?.minimumSamples || 120}`} />
            <MetricTile label="Challenger" value={modelLab?.challenger?.id || "–"} tone="purple" />
            <MetricTile label={tr({ fi: "Drift", en: "Drift", es: "Deriva" })} value={modelLab?.drift?.status || "–"} tone={modelLab?.drift?.status === "critical" ? "red" : modelLab?.drift?.status === "stable" ? "green" : "yellow"} />
          </div>
          {(modelLab?.promotion?.reasons || []).length > 0 && <div className="mt-5 grid gap-2 md:grid-cols-2">{modelLab.promotion.reasons.map((reason) => <div key={reason} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm leading-6 text-[var(--sc-muted)]">{reason}</div>)}</div>}
        </section>

        <section className="sc-surface rounded-[1.7rem] p-6">
          <SectionHeader eyebrow={tr({ fi: "Nykyiset ehdokkaat", en: "Current candidates", es: "Candidatos actuales" })} title={tr({ fi: "Mitä agentti näkee juuri nyt", en: "What the agent sees now", es: "Lo que ve el agente" })} description={tr({ fi: "Tämä lista näyttää markkinapäätöksen sekä datakattavuuden ennen käyttäjäkohtaista pelikassa-, päiväbudjetti- ja circuit breaker -porttia.", en: "This list shows market decisions and data readiness before user bankroll, daily-budget and circuit-breaker gates.", es: "La lista muestra decisiones y calidad antes de los límites personales y diarios." })} />
          {currentCandidates.length === 0 ? <EmptyState title={tr({ fi: "Nykyisiä ehdokkaita ei ole", en: "No current candidates", es: "No hay candidatos" })} description={tr({ fi: "Top Picks ei palauttanut tällä hetkellä varmennettuja kohteita.", en: "Top Picks did not return verified selections now.", es: "Top Picks no devolvió selecciones verificadas." })} /> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--sc-faint)]"><tr><th className="p-3">Match</th><th className="p-3">Selection</th><th className="p-3">Decision</th><th className="p-3">Odds</th><th className="p-3">Edge</th><th className="p-3">Verified</th><th className="p-3">Providers</th><th className="p-3">Safety</th></tr></thead><tbody>{currentCandidates.map((row) => <tr key={`${row.eventId}:${row.selection}`} className="border-t border-[var(--sc-border)]"><td className="p-3 font-bold text-[var(--sc-text)]">{row.match}</td><td className="p-3 text-[var(--sc-muted)]">{row.selection}</td><td className="p-3"><DecisionBadge decision={row.decision} /></td><td className="p-3">{decimal(row.odds)}</td><td className="p-3">{pct(row.edge)}</td><td className="p-3">{pct(row.verifiedCoverage)}</td><td className="p-3">{row.oddsProviders || 1}</td><td className="p-3 text-xs text-[var(--sc-muted)]">{row.safetyAction || "–"}</td></tr>)}</tbody></table></div>}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="sc-surface rounded-[1.7rem] p-6">
            <SectionHeader eyebrow={tr({ fi: "Viimeisin ajo", en: "Latest run", es: "Última ejecución" })} title={tr({ fi: "Tallennetut paperipäätökset", en: "Saved paper decisions", es: "Decisiones guardadas" })} />
            {activeRunDecisions.length === 0 ? <div className="mt-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Viimeisimmässä ajossa ei tallennettu uusia valintoja.", en: "The latest run saved no new selections.", es: "La última ejecución no guardó selecciones." })}</div> : <div className="mt-4 space-y-3">{activeRunDecisions.map((item, index) => <article key={`${item.eventId || index}:${item.selection}`} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-black text-[var(--sc-text)]">{item.match}</div><div className="mt-1 text-sm text-[var(--sc-muted)]">{item.selection} · {decimal(item.odds)} · {money(item.stake)}</div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${item.saved ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"}`}>{item.saved ? "SAVED" : item.reason || "SKIPPED"}</span></div></article>)}</div>}
          </div>

          <div className="sc-surface rounded-[1.7rem] p-6">
            <SectionHeader eyebrow={tr({ fi: "Ajohistoria", en: "Run history", es: "Historial" })} title={tr({ fi: "Viimeiset suojatut worker-kierrokset", en: "Recent protected worker cycles", es: "Ciclos protegidos recientes" })} />
            <div className="mt-4 space-y-3">{recentRuns.slice(0, 10).map((run) => <article key={run.id} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex items-center justify-between gap-3"><div><div className="font-black text-[var(--sc-text)]">{date(run.started_at)}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{run.candidate_count} candidates · {run.saved_count} saved · {money(run.total_stake)}</div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${run.status === "success" ? "bg-emerald-400/15 text-emerald-200" : run.status === "deferred" ? "bg-amber-400/15 text-amber-200" : "bg-rose-400/15 text-rose-200"}`}>{run.status?.toUpperCase()}</span></div>{run.error && <div className="mt-2 text-xs leading-5 text-rose-200">{run.error}</div>}</article>)}{recentRuns.length === 0 && <div className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Ajohistoriaa ei ole vielä.", en: "No run history yet.", es: "Todavía no hay historial." })}</div>}</div>
          </div>
        </section>

        <section className="rounded-[1.7rem] border border-purple-300/20 bg-purple-300/10 p-6">
          <SectionHeader eyebrow="SAFETY CONTRACT" title={tr({ fi: "Autonomia ei tarkoita hallitsematonta pelaamista", en: "Autonomy does not mean uncontrolled betting", es: "La autonomía no significa apuestas sin control" })} />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm leading-6 text-purple-50"><div>✓ {tr({ fi: "Vain virtuaalinen pelikassa", en: "Virtual bankroll only", es: "Solo banca virtual" })}</div><div>✓ {tr({ fi: "Pysyvät UTC-päivärajat", en: "Persistent UTC daily limits", es: "Límites diarios UTC persistentes" })}</div><div>✓ {tr({ fi: "Ei automaattista mallipromootiota", en: "No automatic model promotion", es: "Sin promoción automática" })}</div><div>✓ {tr({ fi: "Fail-closed circuit breakerit", en: "Fail-closed circuit breakers", es: "Límites fail-closed" })}</div></div>
        </section>
      </>}
    </div>
  );
}
