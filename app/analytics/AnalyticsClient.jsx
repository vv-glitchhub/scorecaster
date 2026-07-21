"use client";

import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import {
  DecisionBadge,
  EmptyState,
  MatchIdentity,
  MetricTile,
  PageHero,
  SectionHeader,
  TrustBar
} from "../components/ProductUI";

function percent(value) { return `${(Number(value || 0) * 100).toFixed(1)}%`; }
function number(value) { return Number(value || 0).toFixed(2); }
function score(value) { return Number(value || 0).toFixed(1); }

export default function AnalyticsClient({ learning, clv, agent }) {
  const { tr, t } = useLanguage();
  const learningSummary = learning?.summary || {};
  const clvSummary = clv?.summary || {};
  const agentSummary = agent?.summary || {};
  const weights = agent?.learningWeights || agent?.adaptiveWeights || {};
  const picks = Array.isArray(agent?.data) ? agent.data : [];
  const playPicks = picks.filter((item) => item.decision === "PLAY" || item.decision === "BET").slice(0, 5);
  const watchlist = picks.filter((item) => item.decision === "WATCH" || item.decision === "CAUTION").slice(0, 5);
  const topSegments = buildSegments(picks);

  const settled = learningSummary.settled || agent?.learningSummary?.settled || 0;
  const roi = learningSummary.roi || agent?.learningSummary?.roi || 0;
  const averageClv = learningSummary.averageCLV || clvSummary.averageCLVPercent || agent?.learningSummary?.averageCLV || 0;
  const hitRate = learningSummary.hitRate || agent?.learningSummary?.hitRate || 0;
  const grade = learningSummary.grade || agent?.learningSummary?.clvGrade || "N/A";

  const heroAside = <div className="grid grid-cols-2 gap-2"><MetricTile compact label="ROI" value={percent(roi)} tone={Number(roi) >= 0 ? "green" : "red"} /><MetricTile compact label="CLV" value={percent(averageClv)} tone={Number(averageClv) >= 0 ? "green" : "red"} /><MetricTile compact label={tr({ fi: "Osumat", en: "Hit rate", es: "Acierto" })} value={percent(hitRate)} tone="blue" /><MetricTile compact label={tr({ fi: "Otos", en: "Sample", es: "Muestra" })} value={settled} tone="purple" /></div>;

  return (
    <div className="space-y-7">
      <PageHero
        tone="sky"
        eyebrow="Scorecaster Analytics"
        title={tr({ fi: "Näe ensin, toimiiko päätöksenteko", en: "See first whether the decision process works", es: "Comprueba primero si funciona el proceso de decisión" })}
        description={tr({ fi: "Yhdistetty näkymä näyttää paperituloksen, CLV:n, osumatarkkuuden, kalibraation ja Agent V11:n nykyiset päätökset. Tekniset painot ja segmentit ovat alempana auditointia varten.", en: "The combined view shows paper result, CLV, hit rate, calibration and current Agent V11 decisions. Technical weights and segments remain below for audit.", es: "La vista combinada muestra resultado simulado, CLV, acierto, calibración y decisiones actuales de Agent V11. Pesos y segmentos quedan abajo para auditoría." })}
        actions={<><Link href="/tracking" className="sc-button-primary">{tr({ fi: "Avaa paperisalkku", en: "Open paper portfolio", es: "Abrir cartera simulada" })}</Link><Link href="/agent" className="sc-button-secondary">{tr({ fi: "Avaa AI-agentti", en: "Open AI Agent", es: "Abrir agente IA" })}</Link><Link href="/reports" className="sc-button-ghost">{tr({ fi: "Avaa raportit", en: "Open reports", es: "Abrir informes" })}</Link></>}
        aside={heroAside}
      />

      <TrustBar items={[
        { label: tr({ fi: "Oppimisen lähde", en: "Learning source", es: "Fuente de aprendizaje" }), value: learning?.source || "unknown", tone: learning?.ok === false ? "danger" : "default" },
        { label: "CLV", value: clv?.source || "unknown", tone: "info" },
        { label: "Agent", value: agent?.source || "unknown" },
        { label: tr({ fi: "Oppimistila", en: "Learning mode", es: "Modo de aprendizaje" }), value: agent?.learningMode || learning?.mode || "unknown", tone: "warning" }
      ]} />

      <section>
        <SectionHeader eyebrow={tr({ fi: "Tulos", en: "Performance", es: "Rendimiento" })} title={tr({ fi: "Neljä tärkeintä mittaria", en: "Four metrics that matter most", es: "Las cuatro métricas principales" })} description={tr({ fi: "Pieni otos voi näyttää hyvältä sattumalta. Arvioi ROI:n rinnalla aina CLV, osumatarkkuus ja ratkaistujen kohteiden määrä.", en: "A small sample can look good by chance. Always read ROI together with CLV, hit rate and settled sample size.", es: "Una muestra pequeña puede parecer buena por azar. Lee ROI junto con CLV, acierto y tamaño de muestra." })} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="ROI" value={percent(roi)} hint={`${settled} ${tr({ fi: "ratkaistua", en: "settled", es: "resueltos" })}`} tone={Number(roi) >= 0 ? "green" : "red"} />
          <MetricTile label={tr({ fi: "Keskimääräinen CLV", en: "Average CLV", es: "CLV medio" })} value={percent(averageClv)} hint={`${tr({ fi: "Luokka", en: "Grade", es: "Grado" })}: ${clvSummary.grade || agent?.learningSummary?.clvGrade || "N/A"}`} tone={Number(averageClv) >= 0 ? "green" : "red"} />
          <MetricTile label={tr({ fi: "Osumaprosentti", en: "Hit rate", es: "Porcentaje de acierto" })} value={percent(hitRate)} hint={`${learningSummary.wins || 0}W / ${learningSummary.losses || 0}L / ${learningSummary.pushes || 0}P`} tone="blue" />
          <MetricTile label={tr({ fi: "Oppimisen luokka", en: "Learning grade", es: "Grado de aprendizaje" })} value={grade} hint={learningSummary.note || learning?.warning || tr({ fi: "Odotetaan ratkaistuja paperikohteita.", en: "Waiting for settled paper records.", es: "Esperando pronósticos simulados resueltos." })} tone="purple" />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DecisionPanel title={tr({ fi: "Nykyiset PLAY-päätökset", en: "Current PLAY decisions", es: "Decisiones PLAY actuales" })} description={tr({ fi: "Korkeimman prioriteetin kohteet Agent V11:n tämänhetkisestä listasta.", en: "Highest-priority picks from the current Agent V11 list.", es: "Pronósticos de mayor prioridad de la lista actual de Agent V11." })} items={playPicks} empty={tr({ fi: "Ei PLAY-kohteita juuri nyt.", en: "No PLAY picks right now.", es: "No hay pronósticos PLAY ahora." })} tr={tr} t={t} />
        <DecisionPanel title="WATCH / CAUTION" description={tr({ fi: "Kohteet, joissa hinta, evidenssi tai riskiraja ei vielä riitä PLAY-päätökseen.", en: "Picks where price, evidence or risk limits do not yet support PLAY.", es: "Pronósticos donde cuota, evidencia o límites aún no permiten PLAY." })} items={watchlist} empty={tr({ fi: "Ei WATCH-kohteita juuri nyt.", en: "No WATCH picks right now.", es: "No hay pronósticos WATCH ahora." })} tr={tr} t={t} />
      </section>

      <section>
        <SectionHeader eyebrow={tr({ fi: "Laatu", en: "Quality", es: "Calidad" })} title={tr({ fi: "Segmentit ja otoksen rakenne", en: "Segments and sample structure", es: "Segmentos y estructura de muestra" })} description={tr({ fi: "Tarkista, kasaantuuko hyvä tai huono tulos yhteen liigaan tai päätösluokkaan.", en: "Check whether good or bad performance is concentrated in one league or decision class.", es: "Comprueba si el rendimiento se concentra en una liga o clase de decisión." })} />
        {topSegments.length === 0 ? <EmptyState title={tr({ fi: "Segmenttidataa ei ole vielä", en: "No segment data yet", es: "Aún no hay datos de segmentos" })} description={tr({ fi: "Segmentit ilmestyvät, kun Agentilla on analysoituja kohteita.", en: "Segments appear after the Agent has analyzed picks.", es: "Los segmentos aparecen cuando el Agent ha analizado pronósticos." })} /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{topSegments.map((segment) => <article key={segment.name} className="sc-surface rounded-[1.45rem] p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black text-[var(--sc-text)]">{segment.name}</h3><p className="mt-1 text-sm text-[var(--sc-muted)]">{segment.count} {tr({ fi: "kohdetta", en: "picks", es: "pronósticos" })}</p></div><span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-xs font-black text-sky-300">{score(segment.averageScore)}</span></div><div className="mt-4 grid grid-cols-2 gap-3"><MetricTile compact label="PLAY" value={segment.bets} tone="green" /><MetricTile compact label="WATCH" value={segment.watch} tone="yellow" /></div></article>)}</div>}
      </section>

      <details className="sc-surface rounded-[1.55rem] p-5"><summary className="cursor-pointer font-black text-[var(--sc-text)]">{tr({ fi: "Näytä Agent V11:n tekniset painot", en: "Show Agent V11 technical weights", es: "Mostrar pesos técnicos de Agent V11" })}</summary><p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Painot ovat auditointitietoa. Niitä ei pidä tulkita tuottolupauksena.", en: "Weights are audit information and must not be read as a profit promise.", es: "Los pesos son información de auditoría y no una promesa de beneficios." })}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><MetricTile label="Edge" value={number(weights.edgeWeight || 1)} /><MetricTile label={tr({ fi: "Laatu", en: "Quality", es: "Calidad" })} value={number(weights.qualityWeight || 1)} /><MetricTile label={tr({ fi: "Luottamus", en: "Trust", es: "Confianza" })} value={number(weights.trustWeight || 1)} /><MetricTile label="CLV" value={number(weights.clvWeight || 1)} /><MetricTile label="Sharp" value={number(weights.sharpWeight || 1)} /><MetricTile label={tr({ fi: "Konteksti", en: "Context", es: "Contexto" })} value={number(weights.contextWeight || 1)} /></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricTile label={tr({ fi: "Agent-versio", en: "Agent version", es: "Versión del Agent" })} value="V11" tone="purple" /><MetricTile label="PLAY" value={agentSummary.bets || playPicks.length || 0} tone="green" /><MetricTile label="WATCH" value={agentSummary.watchlist || watchlist.length || 0} tone="yellow" /><MetricTile label={tr({ fi: "Positiivinen CLV", en: "Positive CLV rate", es: "Tasa de CLV positivo" })} value={percent(clvSummary.positiveRate)} tone="blue" /></div></details>
    </div>
  );
}

function DecisionPanel({ title, description, items, empty, tr, t }) {
  return <div className="sc-surface rounded-[1.65rem] p-5"><SectionHeader title={title} description={description} />{items.length === 0 ? <EmptyState title={empty} /> : <div className="space-y-3">{items.map((pick) => <article key={pick.id || `${pick.selection}-${pick.match}`} className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><MatchIdentity homeTeam={pick.homeTeam} awayTeam={pick.awayTeam} meta={pick.leagueTitle || pick.league || pick.sportTitle} compact /><h3 className="mt-3 font-black text-[var(--sc-text)]">{pick.selection}</h3></div><DecisionBadge decision={pick.decision === "BET" ? "PLAY" : pick.decision} /></div><div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4"><MetricTile compact label={tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })} value={Number(pick.odds || 0).toFixed(2)} /><MetricTile compact label={t("term.edge")} value={percent(pick.edge)} tone="green" /><MetricTile compact label={tr({ fi: "Pisteet", en: "Score", es: "Puntuación" })} value={score(pick.finalScore100)} tone="blue" /><MetricTile compact label={tr({ fi: "Luokka", en: "Grade", es: "Grado" })} value={pick.gradeV9 || pick.qualityGrade || "N/A"} tone="purple" /></div></article>)}</div>}</div>;
}

function buildSegments(picks) {
  const groups = new Map();
  for (const pick of picks) {
    const key = pick.leagueTitle || pick.league || pick.sportTitle || "Unknown";
    const current = groups.get(key) || [];
    current.push(pick);
    groups.set(key, current);
  }
  return Array.from(groups.entries()).map(([name, group]) => ({ name, count: group.length, bets: group.filter((pick) => pick.decision === "BET" || pick.decision === "PLAY").length, watch: group.filter((pick) => pick.decision === "WATCH" || pick.decision === "CAUTION").length, averageScore: group.reduce((sum, pick) => sum + Number(pick.finalScore100 || 0), 0) / Math.max(group.length, 1) })).sort((a, b) => b.averageScore - a.averageScore).slice(0, 8);
}
