"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { summarizeDecisionDiagnostics } from "../../lib/decision-diagnostics.mjs";

function percent(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)} %` : "–";
}

function decimal(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "–";
}

function eventHref(pick = {}) {
  const id = String(pick.gameId || pick.eventId || "").trim();
  const sport = String(pick.sportKey || pick.league || "").trim();
  const selection = String(pick.selection || pick.label || "").trim();
  if (!id || !sport) return null;
  return `/event/${encodeURIComponent(id)}?sport=${encodeURIComponent(sport)}&selection=${encodeURIComponent(selection)}`;
}

function reasonMeta(code, tr) {
  const reasons = {
    "stale-odds": {
      title: tr({ fi: "Kerroindata on vanhentunut", en: "Odds data is stale", es: "Las cuotas están desactualizadas" }),
      description: tr({ fi: "Viimeisin markkinapäivitys on yli 12 tuntia vanha.", en: "The latest market update is more than 12 hours old.", es: "La última actualización tiene más de 12 horas." }),
      tone: "red"
    },
    "insufficient-bookmakers": {
      title: tr({ fi: "Vedonvälittäjiä on liian vähän", en: "Too few bookmakers", es: "Hay muy pocas casas" }),
      description: tr({ fi: "Vähintään kaksi riippumatonta hintalähdettä vaaditaan edes seurantaan.", en: "At least two independent price sources are required even for monitoring.", es: "Se requieren al menos dos fuentes independientes." }),
      tone: "red"
    },
    "low-market-confidence": {
      title: tr({ fi: "Markkinadatan luottamus on liian matala", en: "Market-data confidence is too low", es: "La confianza del mercado es baja" }),
      description: tr({ fi: "Kattavuus, hintojen yksimielisyys tai tuoreus ei riitä 35 prosentin seurantaportaaseen.", en: "Coverage, price agreement or freshness does not reach the 35% watch gate.", es: "La cobertura, consenso o actualidad no alcanza el 35%." }),
      tone: "red"
    },
    "edge-below-watch-floor": {
      title: tr({ fi: "Edge jää seurantaportaan alle", en: "Edge is below the watch floor", es: "La ventaja queda bajo el mínimo" }),
      description: tr({ fi: "Parhaan hinnan etu konsensukseen nähden jää alle 0,5 prosentin.", en: "Best-price value versus consensus is below 0.5%.", es: "El valor frente al consenso es inferior al 0,5%." }),
      tone: "red"
    },
    "non-positive-ev": {
      title: tr({ fi: "EV ei ole positiivinen", en: "EV is not positive", es: "El EV no es positivo" }),
      description: tr({ fi: "Nykyinen hinta ei tuota positiivista odotusarvoa markkinakonsensuksella.", en: "The current price does not produce positive expected value against consensus.", es: "La cuota actual no produce valor esperado positivo." }),
      tone: "red"
    },
    "minimum-data-gate": {
      title: tr({ fi: "Vähimmäisportti ei täyty", en: "Minimum data gate failed", es: "No supera el filtro mínimo" }),
      description: tr({ fi: "Kohde ei läpäise varmennetun markkinadatan vähimmäisvaatimuksia.", en: "The selection does not pass minimum verified market-data requirements.", es: "La selección no supera los requisitos mínimos." }),
      tone: "red"
    },
    "intelligence-safety-downgrade": {
      title: tr({ fi: "Evidenssiportti alensi PLAYn", en: "Evidence gate downgraded PLAY", es: "La evidencia rebajó PLAY" }),
      description: tr({ fi: "Markkinaraja täyttyi, mutta riippumaton evidenssi ei sallinut PLAY-päätöstä.", en: "The market threshold passed, but independent evidence did not permit PLAY.", es: "El mercado pasó, pero la evidencia no permitió PLAY." }),
      tone: "yellow"
    },
    "intelligence-not-verified": {
      title: tr({ fi: "Riippumatonta evidenssiä ei ole varmennettu", en: "Independent evidence is not verified", es: "La evidencia no está verificada" }),
      description: tr({ fi: "Markkina voi olla vahva, mutta PLAY vaatii varmennetun evidenssitilan.", en: "The market may be strong, but PLAY requires verified evidence readiness.", es: "El mercado puede ser fuerte, pero PLAY exige evidencia verificada." }),
      tone: "yellow"
    },
    "intelligence-conflict": {
      title: tr({ fi: "Evidenssilähteissä on ristiriita", en: "Evidence sources conflict", es: "Las fuentes se contradicen" }),
      description: tr({ fi: "Poissaolo-, kokoonpano- tai uutislähteet eivät ole yksimielisiä.", en: "Injury, lineup or news sources are not in agreement.", es: "Las fuentes de lesiones, alineaciones o noticias no coinciden." }),
      tone: "yellow"
    },
    "play-bookmaker-coverage": {
      title: tr({ fi: "PLAY vaatii enemmän hintalähteitä", en: "PLAY needs more price sources", es: "PLAY necesita más fuentes" }),
      description: tr({ fi: "PLAY-portaaseen vaaditaan vähintään neljä vedonvälittäjää.", en: "The PLAY gate requires at least four bookmakers.", es: "PLAY requiere al menos cuatro casas." }),
      tone: "yellow"
    },
    "play-confidence": {
      title: tr({ fi: "Dataluottamus jää PLAY-rajan alle", en: "Data confidence is below PLAY", es: "La confianza queda bajo PLAY" }),
      description: tr({ fi: "PLAY vaatii vähintään 55 prosentin markkinadataluottamuksen.", en: "PLAY requires at least 55% market-data confidence.", es: "PLAY requiere al menos un 55% de confianza." }),
      tone: "yellow"
    },
    "play-edge": {
      title: tr({ fi: "Edge jää PLAY-rajan alle", en: "Edge is below PLAY", es: "La ventaja queda bajo PLAY" }),
      description: tr({ fi: "PLAY vaatii vähintään 2,0 prosentin edgen.", en: "PLAY requires at least 2.0% edge.", es: "PLAY requiere al menos un 2,0% de ventaja." }),
      tone: "yellow"
    },
    "play-ev": {
      title: tr({ fi: "EV jää PLAY-rajan alle", en: "EV is below PLAY", es: "El EV queda bajo PLAY" }),
      description: tr({ fi: "PLAY vaatii vähintään 3,0 prosentin odotusarvon.", en: "PLAY requires at least 3.0% expected value.", es: "PLAY requiere al menos un 3,0% de valor esperado." }),
      tone: "yellow"
    },
    "quality-grade": {
      title: tr({ fi: "Laatuluokka ei riitä PLAYhin", en: "Quality grade blocks PLAY", es: "La calidad bloquea PLAY" }),
      description: tr({ fi: "PLAY hyväksyy vain laatuluokat A–C.", en: "PLAY accepts only quality grades A through C.", es: "PLAY solo acepta calidades A–C." }),
      tone: "yellow"
    },
    "safety-watch": {
      title: tr({ fi: "Turvaportti pitää kohteen seurannassa", en: "Safety gate keeps the pick on watch", es: "El filtro mantiene seguimiento" }),
      description: tr({ fi: "Data on käyttökelpoista, mutta kokonaisuus ei vielä oikeuta PLAY-päätökseen.", en: "The data is usable, but the full case does not yet justify PLAY.", es: "Los datos sirven, pero aún no justifican PLAY." }),
      tone: "yellow"
    }
  };
  return reasons[code] || {
    title: code,
    description: tr({ fi: "Päätökseen vaikuttava turvaehto.", en: "A safety condition affecting the decision.", es: "Una condición de seguridad afecta la decisión." }),
    tone: "default"
  };
}

function healthCopy(status, diagnostics, tr) {
  if (status === "empty") return {
    title: tr({ fi: "Diagnosoitavaa aineistoa ei ole", en: "There is no data to diagnose", es: "No hay datos para diagnosticar" }),
    description: tr({ fi: "Top Picks ei palauttanut nykyiseen analyysi-ikkunaan varmennettuja kohteita.", en: "Top Picks returned no verified selections in the current analysis window.", es: "Top Picks no devolvió selecciones verificadas." }),
    tone: "default"
  };
  if (status === "blocked") return {
    title: tr({ fi: "Kaikki kohteet pysähtyvät turvaporttiin", en: "Every selection is stopped by a safety gate", es: "Todas las selecciones están bloqueadas" }),
    description: diagnostics.reasons[0]
      ? `${reasonMeta(diagnostics.reasons[0].code, tr).title} · ${diagnostics.reasons[0].count}/${diagnostics.total}`
      : tr({ fi: "Tarkista datan tuoreus ja kattavuus.", en: "Check data freshness and coverage.", es: "Comprueba actualidad y cobertura." }),
    tone: "danger"
  };
  if (status === "watch") return {
    title: tr({ fi: "PLAY-kohteita ei ole, mutta seurattavia löytyy", en: "No PLAY selections, but watchable cases exist", es: "No hay PLAY, pero sí casos observables" }),
    description: tr({ fi: "CAUTION-kohteet ovat läpäisseet vähimmäisportin. Lähellä PLAYta -lista näyttää pienimmät puutteet.", en: "CAUTION selections passed the minimum gate. Near PLAY shows the smallest remaining gaps.", es: "Las selecciones CAUTION superaron el mínimo. Cerca de PLAY muestra las brechas." }),
    tone: "warning"
  };
  return {
    title: tr({ fi: "Päätösvirta tuottaa myös PLAY-kohteita", en: "The decision flow is producing PLAY selections", es: "El flujo está produciendo selecciones PLAY" }),
    description: tr({ fi: "PLAYt näkyvät vain, kun hinta, markkinadata ja evidenssiportit täyttyvät samanaikaisesti.", en: "PLAY appears only when price, market data and evidence gates pass together.", es: "PLAY aparece solo cuando pasan precio, mercado y evidencia." }),
    tone: "good"
  };
}

function healthClass(tone) {
  if (tone === "danger") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (tone === "warning") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  if (tone === "good") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  return "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-text-secondary)]";
}

export default function DiagnosticsClient() {
  const { tr, locale } = useLanguage();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("ALL");
  const [leagueFilter, setLeagueFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/top-picks", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.error || data?.reason || "Diagnostics unavailable");
      setPayload(data);
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : tr({ fi: "Diagnostiikkaa ei voitu ladata.", en: "Diagnostics could not be loaded.", es: "No se pudo cargar el diagnóstico." }));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => { void load(); }, [load]);

  const diagnostics = useMemo(() => summarizeDecisionDiagnostics(payload || {}), [payload]);
  const health = healthCopy(diagnostics.status, diagnostics, tr);
  const generatedAt = diagnostics.generatedAt
    ? new Date(diagnostics.generatedAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : tr({ fi: "ei saatavilla", en: "unavailable", es: "no disponible" });
  const filteredPicks = useMemo(() => diagnostics.picks.filter((pick) => {
    const decisionOk = decisionFilter === "ALL" || pick.diagnosticDecision === decisionFilter;
    const leagueOk = leagueFilter === "ALL" || pick.diagnosticLeague === leagueFilter;
    return decisionOk && leagueOk;
  }), [decisionFilter, diagnostics.picks, leagueFilter]);

  return (
    <div className="space-y-7">
      <PageHero
        tone="purple"
        eyebrow="Decision Diagnostics V1"
        title={tr({ fi: "Näe miksi Scorecaster sanoo PLAY, CAUTION tai SKIP", en: "See why Scorecaster says PLAY, CAUTION or SKIP", es: "Descubre por qué Scorecaster dice PLAY, CAUTION o SKIP" })}
        description={tr({
          fi: "Diagnostiikka purkaa nykyiset päätökset hinta-, kattavuus-, tuoreus- ja evidenssiporteiksi. Se ei muuta mallia eikä löysennä turvarajoja.",
          en: "Diagnostics decomposes current decisions into price, coverage, freshness and evidence gates. It does not change the model or loosen safety limits.",
          es: "El diagnóstico descompone las decisiones en precio, cobertura, actualidad y evidencia. No cambia el modelo ni relaja límites."
        })}
        actions={
          <>
            <button type="button" onClick={() => void load()} disabled={loading} className="sc-button-primary disabled:opacity-50">
              {loading ? tr({ fi: "Analysoidaan…", en: "Analyzing…", es: "Analizando…" }) : tr({ fi: "Päivitä diagnostiikka", en: "Refresh diagnostics", es: "Actualizar diagnóstico" })}
            </button>
            <Link href="/events" className="sc-button-secondary">{tr({ fi: "Avaa ottelut", en: "Open events", es: "Abrir eventos" })}</Link>
          </>
        }
        aside={<div className="grid grid-cols-2 gap-2"><MetricTile compact label="PLAY" value={loading ? "…" : diagnostics.counts.PLAY} tone="green" /><MetricTile compact label="CAUTION" value={loading ? "…" : diagnostics.counts.CAUTION} tone="yellow" /><MetricTile compact label="SKIP" value={loading ? "…" : diagnostics.counts.SKIP} tone="red" /><MetricTile compact label={tr({ fi: "Yhteensä", en: "Total", es: "Total" })} value={loading ? "…" : diagnostics.total} tone="purple" /></div>}
      />

      <TrustBar items={[
        { label: tr({ fi: "Aineisto", en: "Dataset", es: "Datos" }), value: diagnostics.source || "Top Picks", tone: "info" },
        { label: tr({ fi: "Ottelulähde", en: "Fixture source", es: "Fuente de eventos" }), value: diagnostics.fixtureSource || "live provider", tone: "info" },
        { label: tr({ fi: "Liigavalinta", en: "League selection", es: "Selección de ligas" }), value: diagnostics.leagueSelectionMode || "season-aware-default", tone: "warning" },
        { label: tr({ fi: "Kausitila", en: "Season mode", es: "Modo de temporada" }), value: diagnostics.defaultLeagueSeason || "–" },
        { label: tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" }), value: generatedAt, tone: "info" }
      ]} />

      {error && <div className="rounded-[1.25rem] border border-rose-400/30 bg-rose-400/10 p-5 text-rose-200">{error}</div>}

      {!error && !loading && diagnostics.total === 0 && <EmptyState title={tr({ fi: "Nykyisessä analyysi-ikkunassa ei ole kohteita", en: "There are no selections in the current analysis window", es: "No hay selecciones en la ventana actual" })} description={tr({ fi: "Tämä ei ole SKIP-päätös: live-palveluntarjoajalta ei löytynyt kelvollista lähiajan aineistoa.", en: "This is not a SKIP decision: the live provider returned no valid near-term data.", es: "Esto no es SKIP: el proveedor no devolvió datos próximos válidos." })} actionHref="/events" actionLabel={tr({ fi: "Tarkista otteluhakemisto", en: "Check event directory", es: "Revisar eventos" })} />}

      {!error && diagnostics.total > 0 && (
        <>
          <section className={`rounded-[1.5rem] border p-5 sm:p-6 ${healthClass(health.tone)}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{tr({ fi: "Päätösvirran tila", en: "Decision-flow health", es: "Estado del flujo" })}</div>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">{health.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 opacity-85">{health.description}</p>
              </div>
              <div className="shrink-0 rounded-2xl border border-current/20 px-5 py-3 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-65">PLAY rate</div>
                <div className="mt-1 text-3xl font-black">{percent(diagnostics.rates.PLAY)}</div>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader
              eyebrow={tr({ fi: "Datan laatu", en: "Data quality", es: "Calidad de datos" })}
              title={tr({ fi: "Mitä päätösmoottori näkee juuri nyt", en: "What the decision engine sees right now", es: "Lo que ve el motor ahora" })}
              description={tr({ fi: "Keskiarvot lasketaan vain nykyisen Top Picks -vastauksen varmennetuista valinnoista.", en: "Averages are calculated only from verified selections in the current Top Picks response.", es: "Los promedios usan solo selecciones verificadas actuales." })}
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label={tr({ fi: "Vedonvälittäjiä / kohde", en: "Bookmakers / selection", es: "Casas / selección" })} value={decimal(diagnostics.dataQuality.averageBookmakers, 1)} hint={tr({ fi: "PLAY-raja 4", en: "PLAY floor 4", es: "Mínimo PLAY 4" })} tone={Number(diagnostics.dataQuality.averageBookmakers || 0) >= 4 ? "green" : "yellow"} />
              <MetricTile label={tr({ fi: "Keskimääräinen dataluottamus", en: "Average data confidence", es: "Confianza media" })} value={percent(diagnostics.dataQuality.averageConfidence)} hint={tr({ fi: "PLAY-raja 55 %", en: "PLAY floor 55%", es: "Mínimo PLAY 55%" })} tone={Number(diagnostics.dataQuality.averageConfidence || 0) >= 0.55 ? "green" : "yellow"} />
              <MetricTile label={tr({ fi: "Keskimääräinen datan ikä", en: "Average data age", es: "Edad media" })} value={diagnostics.dataQuality.averageAgeHours === null ? "–" : `${decimal(diagnostics.dataQuality.averageAgeHours, 1)} h`} hint={tr({ fi: "Yli 12 h = stale", en: "Over 12h = stale", es: "Más de 12h = stale" })} tone={Number(diagnostics.dataQuality.averageAgeHours || 0) > 12 ? "red" : "blue"} />
              <MetricTile label={tr({ fi: "Vanhentuneen datan osuus", en: "Stale-data rate", es: "Tasa de datos obsoletos" })} value={percent(diagnostics.dataQuality.staleRate)} hint={`${diagnostics.freshness.stale}/${diagnostics.total}`} tone={diagnostics.freshness.stale > 0 ? "red" : "green"} />
            </div>
          </section>

          <section>
            <SectionHeader
              eyebrow={tr({ fi: "Porttien syyt", en: "Gate reasons", es: "Motivos de filtros" })}
              title={tr({ fi: "Miksi kohteet eivät ole PLAY", en: "Why selections are not PLAY", es: "Por qué las selecciones no son PLAY" })}
              description={tr({ fi: "Yhdellä kohteella voi olla useita puutteita, joten syiden summa voi ylittää kohteiden määrän.", en: "A selection can have multiple gaps, so reason counts may exceed the number of selections.", es: "Una selección puede tener varias brechas, por lo que los motivos pueden superar el total." })}
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {diagnostics.reasons.map((reason) => {
                const meta = reasonMeta(reason.code, tr);
                return (
                  <div key={reason.code} className="sc-surface rounded-[1.35rem] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-black tracking-[-0.025em] text-[var(--sc-text)]">{meta.title}</div>
                        <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">{meta.description}</p>
                      </div>
                      <MetricTile compact label={tr({ fi: "Kohteita", en: "Selections", es: "Selecciones" })} value={reason.count} tone={meta.tone} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">
                      {reason.decisions.SKIP > 0 && <span>SKIP {reason.decisions.SKIP}</span>}
                      {reason.decisions.CAUTION > 0 && <span>CAUTION {reason.decisions.CAUTION}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <SectionHeader
              eyebrow={tr({ fi: "Liigakattavuus", en: "League coverage", es: "Cobertura por liga" })}
              title={tr({ fi: "Missä data toimii ja missä se pysähtyy", en: "Where data works and where it stops", es: "Dónde funcionan los datos y dónde fallan" })}
              description={tr({ fi: "Tämä erottaa liigakohtaisen datavajeen koko mallin ongelmasta.", en: "This separates league-specific data gaps from a system-wide model problem.", es: "Esto separa problemas de liga de problemas generales." })}
            />
            <div className="overflow-x-auto rounded-[1.4rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--sc-border)] text-[10px] font-black uppercase tracking-[0.15em] text-[var(--sc-faint)]">
                  <tr><th className="px-4 py-3">{tr({ fi: "Liiga", en: "League", es: "Liga" })}</th><th className="px-4 py-3">PLAY</th><th className="px-4 py-3">CAUTION</th><th className="px-4 py-3">SKIP</th><th className="px-4 py-3">{tr({ fi: "Lähteitä", en: "Sources", es: "Fuentes" })}</th><th className="px-4 py-3">{tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" })}</th><th className="px-4 py-3">Stale</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--sc-border)] text-[var(--sc-text-secondary)]">
                  {diagnostics.leagues.map((league) => (
                    <tr key={league.league} className="hover:bg-[var(--sc-surface-hover)]">
                      <td className="px-4 py-4 font-black text-[var(--sc-text)]">{league.league}<div className="mt-0.5 text-xs font-normal text-[var(--sc-muted)]">{league.total} {tr({ fi: "valintaa", en: "selections", es: "selecciones" })}</div></td>
                      <td className="px-4 py-4 font-black text-emerald-300">{league.PLAY}</td>
                      <td className="px-4 py-4 font-black text-amber-300">{league.CAUTION}</td>
                      <td className="px-4 py-4 font-black text-rose-300">{league.SKIP}</td>
                      <td className="px-4 py-4">{decimal(league.averageBookmakers, 1)}</td>
                      <td className="px-4 py-4">{percent(league.averageConfidence)}</td>
                      <td className="px-4 py-4">{league.stale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <SectionHeader
              eyebrow={tr({ fi: "Raja-analyysi", en: "Threshold analysis", es: "Análisis de umbrales" })}
              title={tr({ fi: "Lähimpänä PLAY-päätöstä", en: "Closest to a PLAY decision", es: "Más cerca de PLAY" })}
              description={tr({ fi: "Lista sisältää vain käyttökelpoisen ja riittävän tuoreen datan CAUTION-kohteita. Se ei suosittele rajan ohittamista.", en: "The list contains only CAUTION selections with usable, sufficiently fresh data. It does not recommend bypassing the gate.", es: "La lista solo contiene CAUTION con datos utilizables y actuales. No recomienda saltar filtros." })}
            />
            {diagnostics.nearPlay.length === 0 ? <EmptyState title={tr({ fi: "Yksikään kohde ei ole turvallisesti lähellä PLAY-rajaa", en: "No selection is safely near the PLAY threshold", es: "Ninguna selección está cerca de PLAY de forma segura" })} description={tr({ fi: "Nykyiset puutteet ovat suurempia kuin pelkkä pieni edge- tai EV-ero.", en: "Current gaps are larger than a small edge or EV difference.", es: "Las brechas actuales son mayores que una pequeña diferencia de ventaja o EV." })} /> : <div className="grid gap-4 lg:grid-cols-2">{diagnostics.nearPlay.map((pick) => {
              const href = eventHref(pick);
              const edgeGap = Math.max(0, diagnostics.thresholds.minimumPlayEdge - Number(pick.edge || 0));
              const evGap = Math.max(0, diagnostics.thresholds.minimumPlayEv - Number(pick.ev || 0));
              return (
                <div key={pick.diagnosticId} className="sc-surface rounded-[1.5rem] p-5">
                  <div className="flex items-start justify-between gap-4"><MatchIdentity homeTeam={pick.homeTeam} awayTeam={pick.awayTeam} meta={pick.diagnosticLeague} compact /><DecisionBadge decision="CAUTION" /></div>
                  <div className="mt-4 text-lg font-black text-[var(--sc-text)]">{pick.selection || pick.label || "–"} <span className="text-[var(--sc-brand)]">@ {decimal(pick.odds)}</span></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><MetricTile compact label="Edge" value={percent(pick.edge)} tone="yellow" /><MetricTile compact label="EV" value={percent(pick.ev)} tone="yellow" /><MetricTile compact label={tr({ fi: "Edge-vaje", en: "Edge gap", es: "Brecha edge" })} value={percent(edgeGap)} /><MetricTile compact label={tr({ fi: "EV-vaje", en: "EV gap", es: "Brecha EV" })} value={percent(evGap)} /></div>
                  <div className="mt-4 flex flex-wrap gap-2">{pick.diagnosticReasonCodes.map((code) => <span key={code} className="rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 py-1.5 text-xs font-bold text-[var(--sc-muted)]">{reasonMeta(code, tr).title}</span>)}</div>
                  {href && <Link href={href} className="sc-button-secondary mt-5 inline-flex">{tr({ fi: "Avaa päätöslippu", en: "Open decision ticket", es: "Abrir decisión" })}</Link>}
                </div>
              );
            })}</div>}
          </section>

          <section>
            <SectionHeader
              eyebrow={tr({ fi: "Evidenssiturva", en: "Evidence safety", es: "Seguridad de evidencia" })}
              title={tr({ fi: "Markkina läpäisi PLAY-rajan, mutta turvaportti alensi päätöksen", en: "Market passed PLAY, but the safety gate downgraded it", es: "El mercado pasó PLAY, pero el filtro lo rebajó" })}
              description={tr({ fi: "Nämä kohteet osoittavat, että riippumaton evidenssi voi vain alentaa päätöstä eikä koskaan nostaa sitä PLAYksi.", en: "These selections show that independent evidence can only downgrade a decision and never upgrade it to PLAY.", es: "Estas selecciones muestran que la evidencia solo puede rebajar, nunca subir a PLAY." })}
            />
            {diagnostics.safetyDowngrades.length === 0 ? <EmptyState title={tr({ fi: "Nykyisessä otoksessa ei ole evidenssin alentamia PLAY-kandidaatteja", en: "No PLAY candidates were downgraded by evidence in this sample", es: "No hay candidatos PLAY rebajados por evidencia" })} description={tr({ fi: "Tämä on normaalia, jos yksikään markkinakohde ei ensin saavuttanut BET-rajaa.", en: "This is normal when no market selection first reached the BET threshold.", es: "Es normal si ninguna selección alcanzó primero el umbral BET." })} /> : <div className="space-y-3">{diagnostics.safetyDowngrades.map((pick) => {
              const href = eventHref(pick);
              return <div key={pick.diagnosticId} className="sc-surface flex flex-col gap-4 rounded-[1.35rem] p-5 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><DecisionBadge decision={pick.diagnosticDecision} /><span className="text-xs font-black uppercase tracking-[0.13em] text-[var(--sc-faint)]">BET → {pick.diagnosticDecision}</span></div><div className="mt-3 text-lg font-black text-[var(--sc-text)]">{pick.match || `${pick.homeTeam || ""} vs ${pick.awayTeam || ""}`}</div><div className="mt-1 text-sm text-[var(--sc-muted)]">{pick.selection || pick.label} @ {decimal(pick.odds)} · edge {percent(pick.edge)} · EV {percent(pick.ev)}</div></div>{href && <Link href={href} className="sc-button-secondary shrink-0">{tr({ fi: "Tarkista evidenssi", en: "Review evidence", es: "Revisar evidencia" })}</Link>}</div>;
            })}</div>}
          </section>

          <section>
            <SectionHeader
              eyebrow={tr({ fi: "Päätösloki", en: "Decision log", es: "Registro de decisiones" })}
              title={tr({ fi: "Tarkista jokainen nykyinen kohde", en: "Audit every current selection", es: "Audita cada selección actual" })}
              description={tr({ fi: "Suodata päätöksen tai liigan mukaan. Jokainen rivi käyttää samaa aineistoa kuin kohde- ja ottelunäkymät.", en: "Filter by decision or league. Every row uses the same data as Picks and Event Detail.", es: "Filtra por decisión o liga. Cada fila usa los mismos datos que las otras vistas." })}
              action={<div className="flex flex-col gap-2 sm:flex-row"><select value={decisionFilter} onChange={(event) => setDecisionFilter(event.target.value)} className="min-h-11 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 text-sm font-bold text-[var(--sc-text)]"><option value="ALL">{tr({ fi: "Kaikki päätökset", en: "All decisions", es: "Todas las decisiones" })}</option><option value="PLAY">PLAY</option><option value="CAUTION">CAUTION</option><option value="SKIP">SKIP</option></select><select value={leagueFilter} onChange={(event) => setLeagueFilter(event.target.value)} className="min-h-11 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 text-sm font-bold text-[var(--sc-text)]"><option value="ALL">{tr({ fi: "Kaikki liigat", en: "All leagues", es: "Todas las ligas" })}</option>{diagnostics.leagues.map((league) => <option key={league.league} value={league.league}>{league.league}</option>)}</select></div>}
            />
            <div className="space-y-3">
              {filteredPicks.map((pick) => {
                const href = eventHref(pick);
                return (
                  <div key={pick.diagnosticId} className="sc-surface rounded-[1.35rem] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><DecisionBadge decision={pick.diagnosticDecision} /><span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{pick.diagnosticLeague}</span></div><div className="mt-3 text-lg font-black text-[var(--sc-text)]">{pick.match || `${pick.homeTeam || ""} vs ${pick.awayTeam || ""}`}</div><div className="mt-1 text-sm text-[var(--sc-muted)]">{pick.selection || pick.label || "–"} @ {decimal(pick.odds)} · edge {percent(pick.edge)} · EV {percent(pick.ev)} · confidence {percent(pick.confidence)}</div></div>
                      <div className="flex flex-wrap gap-2 lg:max-w-[52%] lg:justify-end">{pick.diagnosticReasonCodes.length === 0 ? <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">{tr({ fi: "Kaikki PLAY-portit läpäisty", en: "All PLAY gates passed", es: "Todos los filtros PLAY superados" })}</span> : pick.diagnosticReasonCodes.map((code) => <span key={code} className="rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 py-1.5 text-xs font-bold text-[var(--sc-muted)]">{reasonMeta(code, tr).title}</span>)}</div>
                    </div>
                    {href && <div className="mt-4 border-t border-[var(--sc-border)] pt-4"><Link href={href} className="text-sm font-black text-[var(--sc-brand)] hover:underline">{tr({ fi: "Avaa täydellinen auditointi", en: "Open full audit", es: "Abrir auditoría completa" })} →</Link></div>}
                  </div>
                );
              })}
              {filteredPicks.length === 0 && <EmptyState title={tr({ fi: "Suodattimella ei löytynyt kohteita", en: "No selections matched the filters", es: "No hay selecciones con estos filtros" })} description={tr({ fi: "Vaihda päätös- tai liigasuodatinta.", en: "Change the decision or league filter.", es: "Cambia el filtro de decisión o liga." })} />}
            </div>
          </section>

          <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 text-sm leading-6 text-[var(--sc-muted)]">
            {tr({ fi: "Decision Diagnostics on kuvaileva auditointi. Se ei takaa tuloksia, muuta markkinatodennäköisyyttä, nosta kohteita PLAYksi tai aseta oikean rahan vetoja.", en: "Decision Diagnostics is a descriptive audit. It does not guarantee outcomes, change market probability, upgrade selections to PLAY or place real-money bets.", es: "Decision Diagnostics es una auditoría descriptiva. No garantiza resultados, cambia probabilidades, sube selecciones a PLAY ni realiza apuestas reales." })}
          </div>
        </>
      )}
    </div>
  );
}
