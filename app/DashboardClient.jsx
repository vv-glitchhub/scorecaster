"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Panel from "./components/Panel";
import StatCard from "./components/StatCard";
import { useLanguage } from "./components/LanguageProvider";
import { getTrackedBets } from "../lib/tracking-storage";
import { calculateTrackingStats } from "../lib/tracking-engine";
import { formatPercent } from "../lib/analysis-engine";
import {
  ActionCard,
  DecisionBadge,
  EmptyState,
  MetricTile,
  PageHero,
  SectionHeader,
  TrustBar
} from "./components/ProductUI";

function decisionLabel(pick) {
  if (pick.productDecision) return pick.productDecision;
  if (pick.decision === "BET") return "PLAY";
  if (pick.decision === "PASS") return "SKIP";
  return pick.decision || "CAUTION";
}

function kickoffLabel(value, locale, fallback) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function DashboardClient() {
  const { t, tr, locale } = useLanguage();
  const [topPicks, setTopPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("loading");
  const [featuredHours, setFeaturedHours] = useState(72);
  const [trackingStats, setTrackingStats] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/top-picks?view=summary", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Top Picks unavailable");
        setTopPicks(Array.isArray(data.featured) ? data.featured : []);
        setFeaturedHours(Number(data.featuredWindowHours || 72));
        setSource(data.fixtureSource || data.source || "live-odds-provider-only");
        setGeneratedAt(data.generatedAt || new Date().toISOString());
      } catch {
        setTopPicks([]);
        setSource(tr({ fi: "ei saatavilla", en: "unavailable", es: "no disponible" }));
        setGeneratedAt(null);
      } finally {
        setLoading(false);
      }
    }

    const tracked = getTrackedBets();
    setTrackingStats(calculateTrackingStats(tracked));
    void load();
  }, [tr]);

  const summary = useMemo(() => {
    const play = topPicks.filter((pick) => decisionLabel(pick) === "PLAY").length;
    const caution = topPicks.filter((pick) => ["CAUTION", "WATCH", "WAIT"].includes(decisionLabel(pick))).length;
    const bestEdge = topPicks.reduce((best, pick) => Math.max(best, Number(pick.edge || 0)), 0);
    const averageConfidence = topPicks.length
      ? topPicks.reduce((sum, pick) => sum + Number(pick.confidence || 0), 0) / topPicks.length
      : 0;
    return { play, caution, bestEdge, averageConfidence };
  }, [topPicks]);

  const money = (value) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));
  const updated = generatedAt
    ? new Date(generatedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : tr({ fi: "ei saatavilla", en: "unavailable", es: "no disponible" });

  const heroAside = (
    <div>
      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{tr({ fi: "Tämän hetken yhteenveto", en: "Current summary", es: "Resumen actual" })}</div>
      <div className="mt-3 flex items-end gap-3">
        <div className="text-5xl font-black tracking-[-0.05em] text-white">{loading ? "…" : topPicks.length}</div>
        <div className="pb-1 text-sm leading-5 text-slate-400">{tr({ fi: "lähiajan kohdetta analysoitu", en: "near-term picks analyzed", es: "pronósticos próximos analizados" })}</div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MetricTile compact label="PLAY" value={loading ? "…" : summary.play} tone="green" />
        <MetricTile compact label="CAUTION" value={loading ? "…" : summary.caution} tone="yellow" />
      </div>
    </div>
  );

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow={tr({ fi: "Päivän päätöskeskus", en: "Daily decision center", es: "Centro diario de decisiones" })}
        title={tr({ fi: "Näe tärkein ensin. Avaa yksityiskohdat vasta tarvittaessa.", en: "See what matters first. Open the details only when needed.", es: "Ve primero lo importante. Abre los detalles solo cuando haga falta." })}
        description={tr({
          fi: "Scorecaster yhdistää live-kertoimet, no-vig-konsensuksen, evidenssin ja riskirajat yhdeksi selkeäksi PLAY-, CAUTION- tai SKIP-päätökseksi. Kaikki seuranta on virtuaalista.",
          en: "Scorecaster combines live odds, no-vig consensus, evidence and risk limits into one clear PLAY, CAUTION or SKIP decision. All tracking is virtual.",
          es: "Scorecaster combina cuotas en vivo, consenso sin margen, evidencia y límites de riesgo en una decisión clara PLAY, CAUTION o SKIP. Todo el seguimiento es virtual."
        })}
        actions={
          <>
            <Link href="/betting" className="sc-button-primary">{tr({ fi: "Näytä päivän kohteet", en: "View today’s picks", es: "Ver pronósticos de hoy" })}</Link>
            <Link href="/agent" className="sc-button-secondary">{tr({ fi: "Avaa AI-agentti", en: "Open AI Agent", es: "Abrir agente IA" })}</Link>
            <Link href="/autonomous-agent" className="sc-button-ghost">{tr({ fi: "Autonominen tila", en: "Autonomous mode", es: "Modo autónomo" })}</Link>
          </>
        }
        aside={heroAside}
      />

      <TrustBar items={[
        { label: tr({ fi: "Ottelulähde", en: "Fixture source", es: "Fuente" }), value: source },
        { label: tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" }), value: updated, tone: "info" },
        { label: tr({ fi: "Analyysi-ikkuna", en: "Analysis window", es: "Ventana" }), value: `${featuredHours} h`, tone: "info" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: tr({ fi: "vain paperiseuranta", en: "paper only", es: "solo simulación" }), tone: "warning" }
      ]} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={tr({ fi: "Analysoidut kohteet", en: "Analyzed picks", es: "Pronósticos analizados" })} value={loading ? "…" : String(topPicks.length)} subtitle={tr({ fi: `Seuraavat ${featuredHours} tuntia`, en: `Next ${featuredHours} hours`, es: `Próximas ${featuredHours} horas` })} tone="blue" />
        <StatCard title="PLAY" value={loading ? "…" : String(summary.play)} subtitle={tr({ fi: "Kaikki turvaportit läpäisseet", en: "Passed every safety gate", es: "Superaron todos los filtros" })} tone="green" />
        <StatCard title={tr({ fi: "Korkein edge", en: "Highest edge", es: "Mayor ventaja" })} value={loading ? "…" : formatPercent(summary.bestEdge)} subtitle={tr({ fi: `Keskimääräinen luottamus ${formatPercent(summary.averageConfidence)}`, en: `Average confidence ${formatPercent(summary.averageConfidence)}`, es: `Confianza media ${formatPercent(summary.averageConfidence)}` })} />
        <StatCard title={tr({ fi: "Paperitulos", en: "Paper result", es: "Resultado simulado" })} value={trackingStats ? money(trackingStats.totalProfit) : money(0)} subtitle={trackingStats ? `${trackingStats.totalBets} ${tr({ fi: "tallennettua valintaa", en: "saved picks", es: "selecciones guardadas" })}` : tr({ fi: "Ei vielä historiaa", en: "No history yet", es: "Sin historial" })} tone={Number(trackingStats?.totalProfit || 0) >= 0 ? "green" : "red"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div>
          <SectionHeader
            eyebrow={tr({ fi: "Lähiaika", en: "Near term", es: "Próximamente" })}
            title={tr({ fi: "Päivän tärkeimmät päätökset", en: "Today’s key decisions", es: "Decisiones clave de hoy" })}
            description={tr({ fi: "Kortissa näkyy vain toiminnan kannalta tärkein. Täysi auditointi löytyy AI-agentista.", en: "Each card shows only what matters for action. Full auditing is available in the AI Agent.", es: "Cada tarjeta muestra solo lo esencial. La auditoría completa está en el agente IA." })}
            action={<Link href="/betting" className="sc-button-secondary">{tr({ fi: "Kaikki kohteet", en: "All picks", es: "Todos" })}</Link>}
          />

          <div className="space-y-4">
            {loading && <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">{tr({ fi: "Tarkistetaan live-markkinaa ja turvaportteja…", en: "Checking the live market and safety gates…", es: "Comprobando el mercado y los filtros…" })}</div>}
            {!loading && topPicks.length === 0 && (
              <EmptyState
                title={tr({ fi: "Ei riittävän vahvoja lähiajan kohteita", en: "No sufficiently strong near-term picks", es: "No hay pronósticos próximos suficientemente sólidos" })}
                description={tr({ fi: "SKIP on hyväksytty tulos. Kokeile myöhemmin uudelleen tai avaa kaikki liigat.", en: "SKIP is a valid outcome. Try again later or open all leagues.", es: "SKIP es un resultado válido. Inténtalo más tarde o abre todas las ligas." })}
                actionHref="/betting"
                actionLabel={tr({ fi: "Avaa markkinat", en: "Open markets", es: "Abrir mercados" })}
              />
            )}
            {topPicks.map((pick, index) => {
              const decision = decisionLabel(pick);
              const readiness = pick.sportsIntelligence?.readiness?.level || pick.intelligenceReadiness?.level || "market-only";
              const polymarket = pick.polymarketSignal?.available
                ? tr({ fi: "tarkistettu", en: "checked", es: "comprobado" })
                : tr({ fi: "ei osumaa", en: "no match", es: "sin coincidencia" });
              return (
                <article key={`${pick.id || pick.match}-${pick.selection}-${index}`} className="sc-card-hover rounded-3xl border border-white/10 bg-slate-950/52 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)] sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-black uppercase tracking-[0.13em] text-emerald-300">{kickoffLabel(pick.commenceTime, locale, tr({ fi: "Alkamisaika puuttuu", en: "Kickoff unavailable", es: "Hora no disponible" }))}</div>
                      <div className="mt-1 text-xs text-slate-500">{pick.leagueTitle || pick.league || tr({ fi: "Urheilu", en: "Sport", es: "Deporte" })}</div>
                      <h3 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">{pick.match || `${pick.homeTeam || ""} – ${pick.awayTeam || ""}`}</h3>
                      <div className="mt-2 text-base font-bold text-slate-300">{pick.selection || pick.label} <span className="text-emerald-200">@ {Number(pick.odds || 0).toFixed(2)}</span></div>
                    </div>
                    <DecisionBadge decision={decision} />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MetricTile compact label={t("term.edge")} value={formatPercent(pick.edge)} tone={Number(pick.edge || 0) > 0 ? "green" : "default"} />
                    <MetricTile compact label={t("term.ev")} value={formatPercent(pick.ev)} tone={Number(pick.ev || 0) > 0 ? "green" : "default"} />
                    <MetricTile compact label={t("term.confidence")} value={formatPercent(pick.confidence)} />
                    <MetricTile compact label={tr({ fi: "Reilu kerroin", en: "Fair odds", es: "Cuota justa" })} value={pick.fairOdds ? Number(pick.fairOdds).toFixed(2) : "–"} />
                  </div>

                  <TrustBar className="mt-4" items={[
                    { label: tr({ fi: "Data", en: "Data", es: "Datos" }), value: pick.freshnessLabel || pick.dataQuality?.freshness || "live" },
                    { label: tr({ fi: "Vedonvälittäjät", en: "Bookmakers", es: "Casas" }), value: pick.bookmakerCount || 0, tone: "info" },
                    { label: tr({ fi: "Evidenssi", en: "Evidence", es: "Evidencia" }), value: readiness, tone: readiness === "verified" ? "good" : "warning" },
                    { label: "Polymarket", value: polymarket, tone: "info" }
                  ]} />

                  <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm leading-6 text-slate-400">{pick.evidenceGateReason || pick.decisionReason || tr({ fi: "Markkinakonsensus ja riskirajat muodostivat päätöksen.", en: "Market consensus and risk limits formed the decision.", es: "El consenso y los límites de riesgo formaron la decisión." })}</p>
                    <Link href="/agent" className="shrink-0 text-sm font-black text-emerald-200 hover:text-emerald-100">{tr({ fi: "Näytä auditointi", en: "View audit", es: "Ver auditoría" })} →</Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
          <Panel title={tr({ fi: "Seuraava paras toiminto", en: "Best next action", es: "Mejor siguiente acción" })} subtitle={tr({ fi: "Yksi selkeä polku tilanteen mukaan", en: "One clear path for the current situation", es: "Una ruta clara según la situación" })}>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/8 p-5">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">{summary.play > 0 ? "PLAY READY" : "REVIEW MODE"}</div>
              <h3 className="mt-2 text-xl font-black text-white">{summary.play > 0
                ? tr({ fi: "Avaa AI-agentti ennen tallennusta", en: "Open the AI Agent before saving", es: "Abre el agente IA antes de guardar" })
                : tr({ fi: "Markkina ei vaadi toimintaa juuri nyt", en: "The market does not require action now", es: "El mercado no requiere acción ahora" })}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{summary.play > 0
                ? tr({ fi: "Tarkista stressitesti, vastaväite ja paperipanoksen yläraja.", en: "Check the stress test, counterargument and virtual stake cap.", es: "Comprueba el estrés, el contraargumento y el límite simulado." })
                : tr({ fi: "SKIP ja odottaminen ovat osa järjestelmän riskikuria.", en: "SKIP and waiting are part of the system’s risk discipline.", es: "SKIP y esperar forman parte de la disciplina de riesgo." })}</p>
              <Link href={summary.play > 0 ? "/agent" : "/watchlist"} className="sc-button-primary mt-5 w-full">{summary.play > 0 ? tr({ fi: "Avaa agentti", en: "Open Agent", es: "Abrir agente" }) : tr({ fi: "Avaa seurantalista", en: "Open watchlist", es: "Abrir seguimiento" })}</Link>
            </div>
          </Panel>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <ActionCard href="/autonomous-agent" eyebrow="Automation" title={tr({ fi: "Autonominen paperiagentti", en: "Autonomous Paper Agent", es: "Agente simulado autónomo" })} description={tr({ fi: "Valitse rajat ja anna workerin tallentaa enintään kolme PLAY-kohdetta päivässä.", en: "Set limits and let the worker save up to three PLAY picks per day.", es: "Define límites y permite guardar hasta tres PLAY al día." })} badge="V1" tone="purple" />
            <ActionCard href="/analytics" eyebrow="Performance" title={tr({ fi: "Tarkista oikea suorituskyky", en: "Review real performance", es: "Revisar rendimiento real" })} description={tr({ fi: "Katso ROI, CLV, Brier ja kalibrointi ennen malliin luottamista.", en: "Review ROI, CLV, Brier and calibration before trusting the model.", es: "Revisa ROI, CLV, Brier y calibración antes de confiar." })} tone="sky" />
          </div>

          <Panel title={tr({ fi: "Miten Scorecaster toimii", en: "How Scorecaster works", es: "Cómo funciona Scorecaster" })}>
            <ol className="space-y-4 text-sm text-slate-300">
              {[
                tr({ fi: "Live-markkina muodostaa no-vig-konsensuksen.", en: "The live market forms a no-vig consensus.", es: "El mercado forma un consenso sin margen." }),
                tr({ fi: "Evidenssi ja Polymarket voivat vain heikentää päätöstä.", en: "Evidence and Polymarket may only downgrade a decision.", es: "La evidencia y Polymarket solo pueden rebajar." }),
                tr({ fi: "Riskimoottori rajaa virtuaalisen panoksen ja altistuksen.", en: "The risk engine caps virtual stake and exposure.", es: "El motor de riesgo limita importe y exposición." })
              ].map((step, index) => <li key={step} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-xs font-black text-emerald-200">{index + 1}</span><span className="pt-1 leading-6">{step}</span></li>)}
            </ol>
          </Panel>
        </aside>
      </section>
    </div>
  );
}
