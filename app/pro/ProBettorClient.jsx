"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ProfessionalPreferenceControls from "../components/ProfessionalPreferenceControls";
import { useProfessionalPreferences } from "../components/ProfessionalPreferencesProvider";
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
import { buildAgentV9Portfolio } from "../../lib/agent-v9-engine.mjs";
import { applyProfessionalQualification } from "../../lib/pro-bettor-policy-v1.mjs";
import { getSettings } from "../../lib/settings-storage";

function percent(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)} %` : "–";
}

function statusTone(status) {
  if (status === "QUALIFIED") return "green";
  if (status === "REVIEW") return "yellow";
  if (status === "PASS") return "red";
  return "default";
}

export default function ProBettorClient() {
  const { tr, locale } = useLanguage();
  const { bookmakerLabel, proMode, proProfile } = useProfessionalPreferences();
  const [rawPicks, setRawPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [source, setSource] = useState("loading");
  const [agentSettings, setAgentSettings] = useState({
    bankroll: 1000,
    maxStakePercent: 1,
    maxTotalExposurePercent: 4,
    maxLeagueExposurePercent: 2,
    riskProfile: "balanced"
  });

  const money = useCallback((value) => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR"
  }).format(Number(value || 0)), [locale]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const settings = getSettings();
      setAgentSettings({
        bankroll: Number(settings.bankroll || 1000),
        maxStakePercent: Number(settings.agentMaxStakePercent || 1),
        maxTotalExposurePercent: Number(settings.agentMaxTotalExposurePercent || 4),
        maxLeagueExposurePercent: Number(settings.agentMaxLeagueExposurePercent || 2),
        riskProfile: String(settings.agentRiskProfile || "balanced")
      });
      const response = await fetch("/api/top-picks?view=summary", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Professional source data could not be loaded");
      setRawPicks(Array.isArray(payload?.data) ? payload.data : []);
      setSource(payload.fixtureSource || payload.source || "live-odds-provider-only");
    } catch (error) {
      setRawPicks([]);
      setSource("error");
      setMessage(error instanceof Error ? error.message : "Professional source data could not be loaded");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const corePortfolio = useMemo(() => buildAgentV9Portfolio(rawPicks, {
    bankroll: agentSettings.bankroll,
    maxStakePercent: agentSettings.maxStakePercent,
    maxTotalExposurePercent: agentSettings.maxTotalExposurePercent,
    maxLeagueExposurePercent: agentSettings.maxLeagueExposurePercent,
    riskProfile: agentSettings.riskProfile,
    learning: null
  }), [rawPicks, agentSettings]);

  const professional = useMemo(() => applyProfessionalQualification(corePortfolio.decisions, {
    enabled: proMode,
    profile: proProfile
  }), [corePortfolio.decisions, proMode, proProfile]);

  const ordered = useMemo(() => [...professional.decisions].sort((a, b) => {
    const rank = { QUALIFIED: 3, REVIEW: 2, PASS: 1, OFF: 0 };
    const statusDelta = (rank[b.professionalAssessment?.status] || 0) - (rank[a.professionalAssessment?.status] || 0);
    if (statusDelta) return statusDelta;
    return Number(b.priorityScore || 0) - Number(a.priorityScore || 0);
  }), [professional.decisions]);

  const qualified = ordered.filter((row) => row.professionalAssessment?.status === "QUALIFIED");
  const review = ordered.filter((row) => row.professionalAssessment?.status === "REVIEW");

  return (
    <div className="space-y-7" data-pro-bettor-desk="v2">
      <PageHero
        eyebrow="Pro Bettor Mode V2 · paper-only professional workflow"
        title={tr({ fi: "Ammattivedonlyöjän työpöytä", en: "Professional bettor desk", es: "Mesa profesional de apuestas" })}
        description={tr({
          fi: "Yhdistä hintalähde, markkinakattavuus, edge, EV, epävarmuus, stressitesti, CLV ja portfolioriski yhteen näkymään. Pro-laatuseula voi vain kiristää nykyistä päätöstä — se ei muuta todennäköisyyttä, edgeä tai EV:tä eikä avaa oikean rahan vedonlyöntiä.",
          en: "Combine price source, market coverage, edge, EV, uncertainty, stress testing, CLV and portfolio risk in one workspace. The professional gate can only make a decision stricter; it never changes probability, edge or EV and never enables real-money wagering.",
          es: "Combina proveedor, cobertura, edge, EV, incertidumbre, estrés, CLV y riesgo de cartera. El filtro profesional solo puede endurecer la decisión y nunca habilita apuestas con dinero real."
        })}
        actions={<>
          <button type="button" onClick={() => void load()} disabled={loading} className="sc-button-primary disabled:opacity-40">
            {loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä Pro Desk", en: "Refresh Pro Desk", es: "Actualizar Pro Desk" })}
          </button>
          <Link href="/agent" className="sc-button-secondary">AI Agent</Link>
          <Link href="/tracking" className="sc-button-secondary">{tr({ fi: "Paperisalkku", en: "Paper portfolio", es: "Cartera simulada" })}</Link>
        </>}
        aside={<div className="grid grid-cols-2 gap-2">
          <MetricTile compact label="QUALIFIED" value={professional.counts.QUALIFIED} tone="green" />
          <MetricTile compact label="REVIEW" value={professional.counts.REVIEW} tone="yellow" />
          <MetricTile compact label="PASS" value={professional.counts.PASS} tone="red" />
          <MetricTile compact label={tr({ fi: "Pro-paperpanos", en: "Pro paper stake", es: "Importe pro" })} value={money(professional.qualifiedPaperStake)} tone="purple" />
        </div>}
      />

      <TrustBar items={[
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: proMode ? "PRO" : "SIMPLE", tone: proMode ? "default" : "warning" },
        { label: tr({ fi: "Profiili", en: "Profile", es: "Perfil" }), value: proProfile, tone: "info" },
        { label: tr({ fi: "Hintalähde", en: "Price provider", es: "Proveedor" }), value: bookmakerLabel, tone: "default" },
        { label: tr({ fi: "Agent-riski", en: "Agent risk", es: "Riesgo Agent" }), value: agentSettings.riskProfile, tone: agentSettings.riskProfile === "aggressive" ? "warning" : "default" },
        { label: tr({ fi: "Datalähde", en: "Data source", es: "Fuente" }), value: source, tone: source === "error" ? "danger" : "default" },
        { label: tr({ fi: "Raja", en: "Boundary", es: "Límite" }), value: "paper only", tone: "warning" }
      ]} />

      {message && <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">{message}</div>}

      <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 md:p-6">
        <SectionHeader
          eyebrow="Professional quality gate"
          title={tr({ fi: "Ammattilaisen laatuseula", en: "Professional quality gate", es: "Filtro de calidad profesional" })}
          description={tr({
            fi: "Risk Control päättää kuinka rohkeasti Agent suosittelee. Pro-profiili on eri asia: se arvioi prosessin laatua ja voi merkitä jo olemassa olevan PLAY-kohteen REVIEW-tilaan. WATCH ei koskaan muutu tämän kautta PLAYksi.",
            en: "Risk Control determines recommendation aggressiveness. The professional profile is separate: it audits process quality and can mark an existing PLAY for REVIEW. It can never promote WATCH to PLAY.",
            es: "Risk Control define la agresividad. El perfil profesional audita la calidad y puede pasar PLAY a REVIEW, pero nunca WATCH a PLAY."
          })}
        />
        <ProfessionalPreferenceControls />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label={tr({ fi: "Min. bookmakerit", en: "Min bookmakers", es: "Mín. casas" })} value={professional.policy.minBookmakers} hint={tr({ fi: "Riippumaton hintakattavuus", en: "Independent price coverage", es: "Cobertura de cuotas" })} />
          <MetricTile label="Min edge" value={percent(professional.policy.minEdge)} hint={tr({ fi: "Ei muuta laskettua edgeä", en: "Does not alter computed edge", es: "No cambia el edge" })} />
          <MetricTile label="Min EV" value={percent(professional.policy.minEv)} hint={tr({ fi: "Perus-EV:n alaraja", en: "Base EV floor", es: "Umbral EV" })} />
          <MetricTile label={tr({ fi: "Max epävarmuus", en: "Max uncertainty", es: "Máx. incertidumbre" })} value={`±${percent(professional.policy.maxUncertaintyHalfWidth)}`} hint={tr({ fi: "Todennäköisyysvälin puolikas", en: "Probability interval half-width", es: "Semiancho del intervalo" })} />
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 md:p-6">
        <SectionHeader
          eyebrow="Professional shortlist"
          title={tr({ fi: "Pro-laatuseulan tulos", en: "Professional shortlist", es: "Lista profesional" })}
          description={tr({ fi: "QUALIFIED tarkoittaa, että nykyinen PLAY läpäisee myös valitun ammattiprofiilin. REVIEW vaatii lisäevidenssiä tai paremman hinnan. PASS ei kuulu pro-shortlistille.", en: "QUALIFIED means an existing PLAY also passes the selected professional profile. REVIEW needs more evidence or a better price. PASS is excluded from the professional shortlist.", es: "QUALIFIED supera también el perfil profesional. REVIEW requiere más evidencia o mejor cuota. PASS queda fuera." })}
        />

        {!loading && ordered.length === 0 && <EmptyState title={tr({ fi: "Ei varmennettuja kohteita", en: "No verified selections", es: "Sin selecciones verificadas" })} description={tr({ fi: "Puuttuvaa dataa ei täytetä demokohteilla.", en: "Missing data is not filled with demo selections.", es: "No se rellenan datos faltantes con ejemplos." })} actionHref="/events" actionLabel={tr({ fi: "Avaa ottelut", en: "Open matches", es: "Abrir partidos" })} />}

        <div className="grid gap-4 xl:grid-cols-2">
          {ordered.slice(0, 8).map((pick, index) => {
            const assessment = pick.professionalAssessment || {};
            const status = assessment.status || "OFF";
            return <article key={`${pick.gameId || pick.eventId || pick.id || index}:${pick.selection || index}`} className="rounded-[1.45rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <MatchIdentity homeTeam={pick.homeTeam} awayTeam={pick.awayTeam} meta={pick.leagueTitle || pick.league || pick.sportKey} />
                <div className="flex items-center gap-2">
                  <DecisionBadge decision={pick.decision} />
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.12em] ${statusTone(status) === "green" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : statusTone(status) === "yellow" ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : statusTone(status) === "red" ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : "border-[var(--sc-border)] text-[var(--sc-muted)]"}`}>{status}</span>
                </div>
              </div>

              <div className="mt-4 text-lg font-black text-[var(--sc-text)]">{pick.selection || "Selection"} <span className="text-[var(--sc-brand)]">@ {Number(pick.odds || 0).toFixed(2)}</span></div>
              <div className="mt-1 text-xs font-bold text-[var(--sc-muted)]">{pick.bookmaker || bookmakerLabel}</div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MetricTile compact label="Edge" value={percent(pick.edge)} tone={Number(pick.edge || 0) >= professional.policy.minEdge ? "green" : "yellow"} />
                <MetricTile compact label="EV" value={percent(pick.ev)} tone={Number(pick.ev || 0) >= professional.policy.minEv ? "green" : "yellow"} />
                <MetricTile compact label={tr({ fi: "Bookit", en: "Books", es: "Casas" })} value={Number(pick.bookmakerCount || 0)} tone={Number(pick.bookmakerCount || 0) >= professional.policy.minBookmakers ? "green" : "yellow"} />
                <MetricTile compact label={tr({ fi: "Stress-EV", en: "Stress EV", es: "EV estrés" })} value={percent(pick.stressTest?.downsideEv)} tone={Number(pick.stressTest?.downsideEv || 0) > 0 ? "green" : "red"} />
              </div>

              {assessment.blockers?.length > 0 && <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/8 p-3 text-xs leading-5 text-amber-100"><strong>{tr({ fi: "Pro-estot:", en: "Professional blockers:", es: "Bloqueos pro:" })}</strong> {assessment.blockers.join(" · ")}</div>}
              {assessment.qualified && <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/8 p-3 text-xs leading-5 text-emerald-100">{tr({ fi: `Pro-laatuseula läpäisty. Virtuaalinen paperipanos ${money(assessment.qualifiedPaperStake)}.`, en: `Professional gate passed. Virtual paper stake ${money(assessment.qualifiedPaperStake)}.`, es: `Filtro profesional superado. Importe virtual ${money(assessment.qualifiedPaperStake)}.` })}</div>}
            </article>;
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 md:p-6">
        <SectionHeader eyebrow="Professional workflow" title={tr({ fi: "Ammattikäytön työkaluketju", en: "Professional workflow", es: "Flujo profesional" })} description={tr({ fi: "Ammattilaiskäyttö ei ole vain kohdelista. Prosessiin kuuluvat hinnan valinta, CLV, kalibraatio, riskirajat, drawdown ja jälkiarviointi.", en: "Professional use is more than a pick list. The process includes price selection, CLV, calibration, risk limits, drawdown and post-trade review.", es: "El uso profesional incluye cuota, CLV, calibración, límites de riesgo, drawdown y evaluación posterior." })} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["/betting", tr({ fi: "Bookmaker Hub", en: "Bookmaker Hub", es: "Bookmaker Hub" }), tr({ fi: "Paras hinta ja no-vig-konsensus", en: "Best price and no-vig consensus", es: "Mejor cuota y consenso no-vig" })],
            ["/calibration", "CLV & Calibration", tr({ fi: "Closing line, Brier ja kalibraatio", en: "Closing line, Brier and calibration", es: "Closing line, Brier y calibración" })],
            ["/risk-lab", "Risk Lab", tr({ fi: "Kelly, korrelaatio ja drawdown", en: "Kelly, correlation and drawdown", es: "Kelly, correlación y drawdown" })],
            ["/analytics", tr({ fi: "Tulokset", en: "Results", es: "Resultados" }), tr({ fi: "ROI, segmentit ja prosessin laatu", en: "ROI, segments and process quality", es: "ROI, segmentos y calidad" })],
            ["/changes", tr({ fi: "Markkinamuutokset", en: "Market changes", es: "Cambios de mercado" }), tr({ fi: "Hinnan ja markkinan liike", en: "Price and market movement", es: "Movimiento de cuota y mercado" })],
            ["/tracking", tr({ fi: "Paperisalkku", en: "Paper portfolio", es: "Cartera simulada" }), tr({ fi: "Jälkiarviointi ilman oikeaa rahaa", en: "Post-trade review without real money", es: "Evaluación sin dinero real" })]
          ].map(([href, title, description]) => <Link key={href} href={href} className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 transition hover:border-[var(--sc-brand-border)]"><div className="font-black text-[var(--sc-text)]">{title}</div><div className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">{description}</div></Link>)}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-400/20 bg-amber-400/8 p-4 text-xs leading-6 text-amber-100">
        <strong>{tr({ fi: "Tuoteraja:", en: "Product boundary:", es: "Límite del producto:" })}</strong> {tr({ fi: "Pro Bettor Mode on analyysi-, riskinhallinta- ja paperiseurantatyökalu. Se ei kirjaudu vedonvälittäjille, siirrä rahaa, aseta vetoja tai muuta mallin todennäköisyyksiä ammattiprofiilin perusteella.", en: "Pro Bettor Mode is an analysis, risk-control and paper-tracking tool. It never logs in to bookmakers, moves money, places bets or changes model probabilities because of the professional profile.", es: "Pro Bettor Mode es solo análisis, control de riesgo y seguimiento simulado; no inicia sesión, mueve dinero ni realiza apuestas." })}
      </section>
    </div>
  );
}
