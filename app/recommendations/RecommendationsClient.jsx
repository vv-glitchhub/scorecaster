"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import { DecisionBadge, EmptyState, MetricTile, PageHero, SectionHeader, TrustBar } from "../components/ProductUI";
import { formatPercent } from "../../lib/analysis-engine";

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

function reasonText(item, tr) {
  if (item.code === "positive-edge") return tr({ fi: `Nykyinen hinta antaa ${formatPercent(item.value)} edgeä no-vig-markkinakonsensukseen nähden.`, en: `The current price offers ${formatPercent(item.value)} edge versus the no-vig market consensus.`, es: `La cuota actual ofrece ${formatPercent(item.value)} de ventaja frente al consenso sin margen.` });
  if (item.code === "positive-ev") return tr({ fi: `Odotusarvo on ${formatPercent(item.value)} nykyisellä kertoimella.`, en: `Expected value is ${formatPercent(item.value)} at the current price.`, es: `El valor esperado es ${formatPercent(item.value)} con la cuota actual.` });
  if (item.code === "price-above-fair") return tr({ fi: `Tarjottu kerroin ${Number(item.odds).toFixed(2)} on fair-kertoimen ${Number(item.fairOdds).toFixed(2)} yläpuolella.`, en: `Offered odds ${Number(item.odds).toFixed(2)} are above fair odds ${Number(item.fairOdds).toFixed(2)}.`, es: `La cuota ofrecida ${Number(item.odds).toFixed(2)} supera la cuota justa ${Number(item.fairOdds).toFixed(2)}.` });
  if (item.code === "market-coverage") return tr({ fi: `Markkinakonsensus sisältää ${item.value} vedonvälittäjää.`, en: `The market consensus includes ${item.value} bookmakers.`, es: `El consenso de mercado incluye ${item.value} casas.` });
  if (item.code === "verified-evidence") return tr({ fi: "Riippumaton otteluevidenssi on varmennettu PLAY-porttia varten.", en: "Independent match evidence is verified for the PLAY gate.", es: "La evidencia independiente del partido está verificada para el filtro PLAY." });
  if (item.code === "fresh-data") return tr({ fi: "Kerroindata on tuoretta eikä stale-portti estä kohdetta.", en: "Odds data is fresh and the stale-data gate is not blocking the pick.", es: "Los datos de cuotas están actualizados y el filtro de datos obsoletos no bloquea la selección." });
  if (item.code === "confidence") return tr({ fi: `Datan luottamus on ${formatPercent(item.value)}.`, en: `Data confidence is ${formatPercent(item.value)}.`, es: `La confianza de los datos es ${formatPercent(item.value)}.` });
  return tr({ fi: "Kohde läpäisee yhden Scorecasterin positiivisista laatutekijöistä.", en: "The pick passes one of Scorecaster's positive quality factors.", es: "La selección supera uno de los factores positivos de calidad de Scorecaster." });
}

function warningText(item, tr) {
  if (item.code === "evidence-not-verified") return tr({ fi: `Riippumaton evidenssi ei ole vielä verified-tilassa (${item.value}).`, en: `Independent evidence is not verified yet (${item.value}).`, es: `La evidencia independiente todavía no está verificada (${item.value}).` });
  if (item.code === "evidence-conflict") return tr({ fi: `Evidenssissä on ${item.value} ratkaisematonta ristiriitaa.`, en: `There are ${item.value} unresolved evidence conflicts.`, es: `Hay ${item.value} conflictos de evidencia sin resolver.` });
  if (item.code === "thin-market") return tr({ fi: `Markkinakattavuus on ohut: vain ${item.value} vedonvälittäjää.`, en: `Market coverage is thin: only ${item.value} bookmakers.`, es: `La cobertura de mercado es limitada: solo ${item.value} casas.` });
  if (item.code === "low-confidence") return tr({ fi: `Datan luottamus on vain ${formatPercent(item.value)}.`, en: `Data confidence is only ${formatPercent(item.value)}.`, es: `La confianza de los datos es solo ${formatPercent(item.value)}.` });
  if (item.code === "stale-data") return tr({ fi: "Kerroindata on liian vanhaa PLAY-päätökselle.", en: "Odds data is too old for a PLAY decision.", es: "Los datos de cuotas son demasiado antiguos para una decisión PLAY." });
  if (item.code === "thin-edge") return tr({ fi: `Edge ${formatPercent(item.value)} jää PLAY-rajan alle.`, en: `Edge ${formatPercent(item.value)} is below the PLAY threshold.`, es: `La ventaja ${formatPercent(item.value)} está por debajo del umbral PLAY.` });
  if (item.code === "thin-ev") return tr({ fi: `EV ${formatPercent(item.value)} jää PLAY-rajan alle.`, en: `EV ${formatPercent(item.value)} is below the PLAY threshold.`, es: `El EV ${formatPercent(item.value)} está por debajo del umbral PLAY.` });
  if (item.code === "skip-gate") return String(item.value || "SKIP gate");
  return tr({ fi: "Kohteessa on tekijä, joka heikentää suositusta.", en: "A factor is weakening the recommendation.", es: "Un factor está debilitando la recomendación." });
}

function strengthText(value, tr) {
  if (value === "strong") return tr({ fi: "Vahva PLAY", en: "Strong PLAY", es: "PLAY fuerte" });
  if (value === "playable") return tr({ fi: "Pelattava", en: "Playable", es: "Jugable" });
  if (value === "watch-closely") return tr({ fi: "Seuraa tarkasti", en: "Watch closely", es: "Vigilar de cerca" });
  if (value === "watch") return tr({ fi: "Seurattava", en: "Watch", es: "Vigilar" });
  return "SKIP";
}

function RecommendationCard({ item, featured = false, locale, tr }) {
  const reasons = Array.isArray(item.reasons) ? item.reasons : [];
  const warnings = Array.isArray(item.warnings) ? item.warnings : [];
  return (
    <article className={`${featured ? "border-emerald-300/30 bg-emerald-300/[0.055]" : "border-white/10 bg-slate-950/52"} rounded-3xl border p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)] sm:p-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">#{item.rank} · {strengthText(item.strength, tr)}</div>
          <div className="mt-1 text-xs text-slate-500">{kickoffLabel(item.commenceTime, locale, tr({ fi: "Alkamisaika puuttuu", en: "Kickoff unavailable", es: "Hora no disponible" }))} · {item.league || ""}</div>
          <h3 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">{item.match}</h3>
          <div className="mt-2 text-base font-bold text-slate-300">{item.selection} {item.odds ? <span className="text-emerald-200">@ {Number(item.odds).toFixed(2)}</span> : null}</div>
        </div>
        <DecisionBadge decision={item.decision} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile compact label={tr({ fi: "Suosituspisteet", en: "Recommendation score", es: "Puntuación" })} value={`${Number(item.score || 0).toFixed(0)}/100`} tone={item.decision === "PLAY" ? "green" : item.decision === "SKIP" ? "red" : "yellow"} />
        <MetricTile compact label="Edge" value={formatPercent(item.edge)} tone={Number(item.edge || 0) > 0 ? "green" : "default"} />
        <MetricTile compact label="EV" value={formatPercent(item.ev)} tone={Number(item.ev || 0) > 0 ? "green" : "default"} />
        <MetricTile compact label={tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" })} value={formatPercent(item.confidence)} />
      </div>

      <TrustBar className="mt-4" items={[
        { label: tr({ fi: "Evidenssi", en: "Evidence", es: "Evidencia" }), value: item.readiness, tone: item.readiness === "verified" ? "good" : "warning" },
        { label: tr({ fi: "Vedonvälittäjät", en: "Bookmakers", es: "Casas" }), value: item.bookmakerCount || 0, tone: "info" },
        { label: tr({ fi: "Fair kerroin", en: "Fair odds", es: "Cuota justa" }), value: item.fairOdds ? Number(item.fairOdds).toFixed(2) : "–", tone: "info" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: tr({ fi: "paper-only", en: "paper-only", es: "paper-only" }), tone: "warning" }
      ]} />

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.035] p-4">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-emerald-200">{tr({ fi: "Miksi tämä?", en: "Why this pick?", es: "¿Por qué esta selección?" })}</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            {reasons.length ? reasons.map((reason, index) => <li key={`${reason.code}-${index}`}>• {reasonText(reason, tr)}</li>) : <li>• {tr({ fi: "Positiivisia laatutekijöitä ei ole riittävästi PLAY-suositukseen.", en: "There are not enough positive quality factors for a PLAY recommendation.", es: "No hay suficientes factores positivos para una recomendación PLAY." })}</li>}
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.03] p-4">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-amber-200">{tr({ fi: "Mikä voi estää tai muuttaa päätöksen?", en: "What could block or change it?", es: "¿Qué podría bloquearla o cambiarla?" })}</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            {warnings.length ? warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>• {warningText(warning, tr)}</li>) : <li>• {tr({ fi: "Nykyisessä auditoinnissa ei ole erillistä varoitusta, mutta tulosriski säilyy aina.", en: "No separate warning is present in the current audit, but outcome risk always remains.", es: "No hay una advertencia separada en la auditoría actual, pero el riesgo de resultado siempre permanece." })}</li>}
          </ul>
        </div>
      </div>

      {item.decisionReason ? <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-slate-400">{item.decisionReason}</p> : null}
    </article>
  );
}

export default function RecommendationsClient() {
  const { tr, locale } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/recommendations?limit=10", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || "Recommendations unavailable");
      setData(payload);
    } catch (nextError) {
      setData(null);
      setError(nextError instanceof Error ? nextError.message : "Recommendations unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const recommendations = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const top = data?.topRecommendation || null;
  const rest = useMemo(() => top ? recommendations.filter((item) => !(item.rank === top.rank && item.eventId === top.eventId && item.selection === top.selection)) : recommendations, [recommendations, top]);

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow={tr({ fi: "Recommendation Center V1", en: "Recommendation Center V1", es: "Centro de recomendaciones V1" })}
        title={tr({ fi: "Mitä kannattaa pelata juuri nyt — ja miksi?", en: "What is worth playing right now — and why?", es: "¿Qué merece la pena jugar ahora y por qué?" })}
        description={tr({
          fi: "Scorecaster järjestää live-kohteet päätösporttien, edgen, EV:n, datan luottamuksen, markkinakattavuuden ja riippumattoman evidenssin perusteella. PLAY syntyy vain, jos nykyinen tuotantologiikka sallii sen.",
          en: "Scorecaster ranks live picks using decision gates, edge, EV, data confidence, market coverage and independent evidence. PLAY appears only when the current production logic allows it.",
          es: "Scorecaster ordena las selecciones en vivo usando filtros de decisión, ventaja, EV, confianza de datos, cobertura de mercado y evidencia independiente. PLAY solo aparece cuando la lógica de producción actual lo permite."
        })}
        actions={<><button className="sc-button-primary" onClick={() => void load()} disabled={loading}>{loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä suositukset", en: "Refresh recommendations", es: "Actualizar recomendaciones" })}</button><Link href="/agent" className="sc-button-secondary">{tr({ fi: "Avaa täysi AI-auditointi", en: "Open full AI audit", es: "Abrir auditoría IA" })}</Link></>}
        aside={<div><div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{tr({ fi: "Nyt", en: "Now", es: "Ahora" })}</div><div className="mt-4 grid grid-cols-3 gap-2"><MetricTile compact label="PLAY" value={data?.counts?.PLAY ?? "…"} tone="green" /><MetricTile compact label="CAUTION" value={data?.counts?.CAUTION ?? "…"} tone="yellow" /><MetricTile compact label="SKIP" value={data?.counts?.SKIP ?? "…"} tone="red" /></div></div>}
      />

      <TrustBar items={[
        { label: tr({ fi: "Toimintatila", en: "Mode", es: "Modo" }), value: tr({ fi: "vain paperiseuranta", en: "paper only", es: "solo simulación" }), tone: "warning" },
        { label: tr({ fi: "Lähde", en: "Source", es: "Fuente" }), value: data?.source || "–", tone: "info" },
        { label: tr({ fi: "Ottelulähde", en: "Fixture source", es: "Fuente de partidos" }), value: data?.fixtureSource || "–", tone: "info" },
        { label: tr({ fi: "PLAY-portti", en: "PLAY gate", es: "Filtro PLAY" }), value: tr({ fi: "ei AI-ohituksia", en: "no AI overrides", es: "sin anulaciones IA" }), tone: "good" }
      ]} />

      {error ? <EmptyState title={tr({ fi: "Suosituksia ei voitu ladata", en: "Recommendations could not be loaded", es: "No se pudieron cargar las recomendaciones" })} description={error} actionHref="/betting" actionLabel={tr({ fi: "Takaisin kohteisiin", en: "Back to picks", es: "Volver a selecciones" })} /> : null}

      {!error && !loading && !top ? <EmptyState title={tr({ fi: "Ei analysoitavia live-kohteita juuri nyt", en: "No live picks to analyze right now", es: "No hay selecciones en vivo para analizar ahora" })} description={tr({ fi: "Päivitä myöhemmin. Scorecaster ei keksi kohteita, jos provider ei palauta käyttökelpoista dataa.", en: "Refresh later. Scorecaster does not invent picks when the provider has no usable data.", es: "Actualiza más tarde. Scorecaster no inventa selecciones cuando el proveedor no devuelve datos utilizables." })} actionHref="/betting" actionLabel={tr({ fi: "Avaa markkinat", en: "Open markets", es: "Abrir mercados" })} /> : null}

      {top ? <section className="space-y-4"><SectionHeader eyebrow={data?.hasPlayablePick ? "TOP PLAY" : "TOP WATCH"} title={data?.hasPlayablePick ? tr({ fi: "Paras pelattava juuri nyt", en: "Best playable pick right now", es: "Mejor selección jugable ahora" }) : tr({ fi: "Ei PLAY-kohdetta juuri nyt — tämä on paras seurattava", en: "No PLAY pick right now — this is the best one to watch", es: "No hay PLAY ahora — esta es la mejor para vigilar" })} description={data?.hasPlayablePick ? tr({ fi: "Tämä kohde on listan ykkönen nykyisillä hinnoilla ja nykyisellä evidenssillä.", en: "This pick ranks first at the current price and evidence state.", es: "Esta selección ocupa el primer lugar con la cuota y evidencia actuales." }) : tr({ fi: "Scorecaster näyttää mieluummin CAUTIONin kuin pakottaa vedon. PLAY voi ilmestyä vasta, kun rajat täyttyvät.", en: "Scorecaster prefers CAUTION over forcing a bet. PLAY can appear only after the gates are satisfied.", es: "Scorecaster prefiere CAUTION antes que forzar una apuesta. PLAY solo aparece cuando se cumplen los filtros." })} /><RecommendationCard item={top} featured locale={locale} tr={tr} /></section> : null}

      {rest.length ? <section className="space-y-4"><SectionHeader eyebrow={tr({ fi: "Ranking", en: "Ranking", es: "Clasificación" })} title={tr({ fi: "Muut seurattavat kohteet", en: "Other picks to watch", es: "Otras selecciones a vigilar" })} description={tr({ fi: "Järjestys ei ohita päätösportteja: PLAY tulee aina ennen CAUTIONia ja SKIPiä.", en: "Ranking never overrides the decision gates: PLAY always comes before CAUTION and SKIP.", es: "La clasificación nunca anula los filtros: PLAY siempre va antes de CAUTION y SKIP." })} />{rest.map((item) => <RecommendationCard key={`${item.eventId}-${item.selection}-${item.rank}`} item={item} locale={locale} tr={tr} />)}</section> : null}
    </div>
  );
}
