"use client";

import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";

function percent(value) { return `${(Number(value || 0) * 100).toFixed(1)}%`; }
function number(value) { return Number(value || 0).toFixed(2); }
function score(value) { return Number(value || 0).toFixed(1); }

function Card({ title, value, subtitle }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-lg"><p className="text-sm text-slate-400">{title}</p><p className="mt-2 text-3xl font-black text-white">{value}</p><p className="mt-2 text-sm text-slate-400">{subtitle}</p></div>;
}
function Panel({ title, children }) { return <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6"><h2 className="text-xl font-black">{title}</h2><div className="mt-4">{children}</div></div>; }
function Note({ label, value }) { return <div className="rounded-xl bg-slate-950/60 p-4"><span className="text-slate-500">{label}: </span>{value}</div>; }

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

  const PickList = ({ items, empty }) => !items.length ? <p className="text-sm text-slate-400">{empty}</p> : (
    <div className="space-y-3">{items.map((pick) => <div key={pick.id || `${pick.selection}-${pick.match}`} className="rounded-xl border border-white/10 bg-slate-950/70 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-bold">{pick.selection}</p><p className="text-sm text-slate-400">{pick.match || `${pick.homeTeam} vs ${pick.awayTeam}`}</p></div><span className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs text-cyan-200">{pick.decision === "BET" ? "PLAY" : pick.decision}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300 md:grid-cols-4"><span>{tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })} {pick.odds}</span><span>{t("term.edge")} {percent(pick.edge)}</span><span>{tr({ fi: "Pisteet", en: "Score", es: "Puntuación" })} {score(pick.finalScore100)}</span><span>{tr({ fi: "Luokka", en: "Grade", es: "Grado" })} {pick.gradeV9 || pick.qualityGrade || "N/A"}</span></div></div>)}</div>
  );

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 shadow-2xl md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div><p className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-300">Scorecaster Analytics</p><h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">{tr({ fi: "Paperiseurannan suorituskyky", en: "Paper-tracking performance", es: "Rendimiento del seguimiento simulado" })}</h1><p className="mt-4 max-w-3xl text-slate-300">{tr({ fi: "ROI, CLV, osumatarkkuus, oppimispainot ja Agent V10:n nykyiset päätökset yhdessä näkymässä.", en: "ROI, CLV, hit rate, learning weights and current Agent V10 decisions in one view.", es: "ROI, CLV, porcentaje de acierto, pesos de aprendizaje y decisiones actuales de Agent V10 en una sola vista." })}</p></div>
          <Link href="/agent" className="rounded-2xl border border-cyan-400/40 px-5 py-3 text-center font-black text-cyan-200 hover:bg-cyan-400/10">{tr({ fi: "Avaa AI-analyysi", en: "Open AI analysis", es: "Abrir análisis IA" })}</Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card title={tr({ fi: "Oppimisen luokka", en: "Learning grade", es: "Grado de aprendizaje" })} value={learningSummary.grade || agent?.learningSummary?.clvGrade || "N/A"} subtitle={learningSummary.note || learning?.warning || tr({ fi: "Odotetaan ratkaistuja paperikohteita.", en: "Waiting for settled paper records.", es: "Esperando pronósticos simulados resueltos." })} />
        <Card title="ROI" value={percent(learningSummary.roi || agent?.learningSummary?.roi)} subtitle={`${learningSummary.settled || agent?.learningSummary?.settled || 0} ${tr({ fi: "ratkaistua", en: "settled", es: "resueltos" })}`} />
        <Card title={tr({ fi: "Osumaprosentti", en: "Hit rate", es: "Porcentaje de acierto" })} value={percent(learningSummary.hitRate || agent?.learningSummary?.hitRate)} subtitle={`${learningSummary.wins || 0}W / ${learningSummary.losses || 0}L / ${learningSummary.pushes || 0}P`} />
        <Card title={tr({ fi: "Keskimääräinen CLV", en: "Average CLV", es: "CLV medio" })} value={number(learningSummary.averageCLV || clvSummary.averageCLVPercent || agent?.learningSummary?.averageCLV)} subtitle={`${tr({ fi: "CLV-luokka", en: "CLV grade", es: "Grado CLV" })} ${clvSummary.grade || agent?.learningSummary?.clvGrade || "N/A"}`} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card title={tr({ fi: "Agent-versio", en: "Agent version", es: "Versión del Agent" })} value="V10" subtitle={`${tr({ fi: "Tila", en: "Mode", es: "Modo" })}: ${weights.riskMode || agent?.learningSummary?.riskMode || "balanced"}`} />
        <Card title="PLAY" value={agentSummary.bets || playPicks.length || 0} subtitle={tr({ fi: "Nykyiset PLAY-kohteet", en: "Current PLAY picks", es: "Pronósticos PLAY actuales" })} />
        <Card title="WATCH" value={agentSummary.watchlist || watchlist.length || 0} subtitle={tr({ fi: "Nykyiset WATCH-kohteet", en: "Current WATCH picks", es: "Pronósticos WATCH actuales" })} />
        <Card title={tr({ fi: "Positiivinen CLV", en: "Positive CLV rate", es: "Tasa de CLV positivo" })} value={percent(clvSummary.positiveRate)} subtitle={`${clvSummary.count || 0} ${tr({ fi: "arviota", en: "estimates", es: "estimaciones" })}`} />
      </section>

      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card title="Edge" value={number(weights.edgeWeight || 1)} subtitle={tr({ fi: "Paino", en: "Weight", es: "Peso" })} /><Card title={tr({ fi: "Laatu", en: "Quality", es: "Calidad" })} value={number(weights.qualityWeight || 1)} subtitle={tr({ fi: "Paino", en: "Weight", es: "Peso" })} /><Card title={tr({ fi: "Luottamus", en: "Trust", es: "Confianza" })} value={number(weights.trustWeight || 1)} subtitle={tr({ fi: "Paino", en: "Weight", es: "Peso" })} /><Card title="CLV" value={number(weights.clvWeight || 1)} subtitle={tr({ fi: "Paino", en: "Weight", es: "Peso" })} /><Card title="Sharp" value={number(weights.sharpWeight || 1)} subtitle={tr({ fi: "Paino", en: "Weight", es: "Peso" })} /><Card title={tr({ fi: "Konteksti", en: "Context", es: "Contexto" })} value={number(weights.contextWeight || 1)} subtitle={tr({ fi: "Paino", en: "Weight", es: "Peso" })} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2"><Panel title={tr({ fi: "Parhaat Agent V10 -kohteet", en: "Best Agent V10 picks", es: "Mejores pronósticos Agent V10" })}><PickList items={playPicks} empty={tr({ fi: "Ei PLAY-kohteita juuri nyt.", en: "No PLAY picks right now.", es: "No hay pronósticos PLAY ahora." })} /></Panel><Panel title="WATCH"><PickList items={watchlist} empty={tr({ fi: "Ei WATCH-kohteita juuri nyt.", en: "No WATCH picks right now.", es: "No hay pronósticos WATCH ahora." })} /></Panel></section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title={tr({ fi: "Liiga- ja segmenttikooste", en: "League and segment snapshot", es: "Resumen por liga y segmento" })}><div className="space-y-3">{topSegments.length === 0 && <p className="text-sm text-slate-400">{tr({ fi: "Segmenttidataa ei ole vielä.", en: "No segment data yet.", es: "Aún no hay datos de segmentos." })}</p>}{topSegments.map((segment) => <div key={segment.name} className="rounded-xl border border-white/10 bg-slate-950/60 p-4"><div className="flex items-center justify-between gap-3"><div className="font-bold">{segment.name}</div><div className="text-sm text-emerald-300">Avg {score(segment.averageScore)}</div></div><div className="mt-2 text-sm text-slate-400">{segment.count} {tr({ fi: "kohdetta", en: "picks", es: "pronósticos" })} · {segment.bets} PLAY · {segment.watch} WATCH</div></div>)}</div></Panel>
        <Panel title={tr({ fi: "Järjestelmän lähteet", en: "System sources", es: "Fuentes del sistema" })}><div className="space-y-3 text-sm text-slate-300"><Note label={tr({ fi: "Oppimisen lähde", en: "Learning source", es: "Fuente de aprendizaje" })} value={learning?.source || "unknown"} /><Note label="CLV" value={clv?.source || "unknown"} /><Note label="Agent" value={agent?.source || "unknown"} /><Note label={tr({ fi: "Oppimistila", en: "Learning mode", es: "Modo de aprendizaje" })} value={agent?.learningMode || learning?.mode || "unknown"} /></div></Panel>
      </section>
    </div>
  );
}

function buildSegments(picks) {
  const groups = new Map();
  for (const pick of picks) {
    const key = pick.leagueTitle || pick.league || pick.sportTitle || "Unknown";
    const current = groups.get(key) || [];
    current.push(pick);
    groups.set(key, current);
  }
  return Array.from(groups.entries()).map(([name, group]) => ({
    name,
    count: group.length,
    bets: group.filter((pick) => pick.decision === "BET" || pick.decision === "PLAY").length,
    watch: group.filter((pick) => pick.decision === "WATCH" || pick.decision === "CAUTION").length,
    averageScore: group.reduce((sum, pick) => sum + Number(pick.finalScore100 || 0), 0) / Math.max(group.length, 1)
  })).sort((a, b) => b.averageScore - a.averageScore).slice(0, 8);
}
