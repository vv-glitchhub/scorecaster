"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Panel from "../components/Panel";
import { useLanguage } from "../components/LanguageProvider";
import { buildIntelligenceSummary } from "../../lib/intelligence-summary-engine";
import { formatPercent } from "../../lib/analysis-engine";

function decisionTone(decision) {
  if (decision === "PLAY") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (decision === "SKIP") return "border-red-400/30 bg-red-400/10 text-red-300";
  return "border-amber-400/30 bg-amber-400/10 text-amber-300";
}

function readinessTone(level) {
  if (level === "verified") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (level === "partial") return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
  return "border-slate-400/20 bg-slate-400/10 text-slate-300";
}

function kickoffLabel(value, locale) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function Metric({ label, value, tone = "text-white" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`mt-2 text-3xl font-black ${tone}`}>{value}</div>
    </div>
  );
}

export default function IntelligencePage() {
  const { tr, locale } = useLanguage();
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);
  const [apiLevels, setApiLevels] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/top-picks", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Top Picks could not be loaded");
      setPicks(Array.isArray(data.data) ? data.data : []);
      setGeneratedAt(data.generatedAt || new Date().toISOString());
      setApiLevels(data.intelligenceLevels || null);
    } catch (loadError) {
      setPicks([]);
      setApiLevels(null);
      setError(loadError instanceof Error ? loadError.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => { void load(); }, [load]);

  const marketSummary = buildIntelligenceSummary(picks);
  const intelligenceSummary = useMemo(() => {
    const counts = { verified: 0, partial: 0, marketOnly: 0 };
    const conflicts = [];
    const missing = [];
    const evidence = [];

    for (const pick of picks) {
      const report = pick.sportsIntelligence;
      const level = report?.readiness?.level;
      if (level === "verified") counts.verified += 1;
      else if (level === "partial") counts.partial += 1;
      else counts.marketOnly += 1;

      for (const item of report?.conflicts || []) {
        conflicts.push({ match: pick.match, item });
      }
      for (const item of report?.readiness?.missing || []) {
        missing.push({ match: pick.match, item });
      }
      for (const injury of report?.injuries || []) {
        evidence.push({
          match: pick.match,
          type: "injury",
          text: `${injury.team}: ${injury.name} · ${injury.status}`
        });
      }
      for (const lineup of report?.lineups || []) {
        evidence.push({
          match: pick.match,
          type: "lineup",
          text: `${lineup.team}: ${lineup.startersConfirmed ? "starters confirmed" : "lineup checked"}`
        });
      }
      for (const news of report?.news || []) {
        evidence.push({
          match: pick.match,
          type: "news",
          text: `${news.source || "source"}: ${news.title}`
        });
      }
    }

    return {
      counts: apiLevels || counts,
      conflicts,
      missing,
      evidence
    };
  }, [picks, apiLevels]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-bold text-emerald-300">
              Agent V11 · Sports Intelligence V1
            </div>
            <h1 className="text-4xl font-black tracking-tight">{tr({ fi: "Evidenssin hallintapaneeli", en: "Evidence control center", es: "Centro de control de evidencia" })}</h1>
            <p className="mt-3 max-w-4xl text-slate-300">{tr({
              fi: "Markkinakonsensus tuottaa todennäköisyyden. Riippumaton uutis-, loukkaantumis- ja kokoonpanodata tarkistetaan erikseen, liitetään oikeaan joukkueeseen ja saa vain heikentää päätöstä — ei muuttaa todennäköisyyttä tai nostaa kohdetta PLAYksi.",
              en: "Market consensus produces the probability. Independent news, injury and lineup data is checked separately, attributed to the correct team and may only downgrade a decision — never change probability or upgrade a pick to PLAY.",
              es: "El consenso de mercado produce la probabilidad. Las noticias, lesiones y alineaciones independientes se verifican por separado, se atribuyen al equipo correcto y solo pueden rebajar una decisión, nunca cambiar la probabilidad ni elevar un pronóstico a PLAY."
            })}</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-black text-white transition hover:bg-white/[0.1] disabled:opacity-50"
          >
            {loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä evidenssi", en: "Refresh evidence", es: "Actualizar evidencia" })}
          </button>
        </div>
        <div className="mt-4 text-xs text-slate-500">
          {generatedAt
            ? `${tr({ fi: "Luotu", en: "Generated", es: "Generado" })} ${new Date(generatedAt).toLocaleString(locale)}`
            : tr({ fi: "Analyysiä ei ole vielä ladattu", en: "Analysis has not been loaded yet", es: "El análisis aún no se ha cargado" })}
          {" · "}{tr({ fi: "vain paperiseuranta · ei voittotakuuta", en: "paper tracking only · no result guarantee", es: "solo seguimiento simulado · sin garantía de resultado" })}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label={tr({ fi: "Kohteet", en: "Picks", es: "Pronósticos" })} value={marketSummary.totalPicks} tone="text-sky-300" />
        <Metric label={tr({ fi: "PLAY / CAUTION / SKIP", en: "PLAY / CAUTION / SKIP", es: "PLAY / CAUTION / SKIP" })} value={`${marketSummary.decisions.PLAY} / ${marketSummary.decisions.CAUTION} / ${marketSummary.decisions.SKIP}`} />
        <Metric label={tr({ fi: "Varmennettu", en: "Verified", es: "Verificada" })} value={intelligenceSummary.counts.verified || 0} tone="text-emerald-300" />
        <Metric label={tr({ fi: "Osittainen", en: "Partial", es: "Parcial" })} value={intelligenceSummary.counts.partial || 0} tone="text-yellow-300" />
        <Metric label={tr({ fi: "Vain markkina", en: "Market-only", es: "Solo mercado" })} value={intelligenceSummary.counts["market-only"] ?? intelligenceSummary.counts.marketOnly ?? 0} tone="text-slate-300" />
        <Metric label={tr({ fi: "Keskimääräinen edge", en: "Average edge", es: "Ventaja media" })} value={formatPercent(marketSummary.averageEdge)} tone="text-purple-300" />
      </section>

      <Panel title={tr({ fi: "Lähiajan analysoidut kohteet", en: "Analyzed near-term picks", es: "Pronósticos próximos analizados" })} subtitle={tr({ fi: "Markkinahinta ja riippumattoman evidenssin tila näkyvät erillään", en: "Market price and independent evidence are shown separately", es: "La cuota de mercado y la evidencia independiente se muestran por separado" })}>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {!loading && picks.length === 0 && (
            <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
              {tr({ fi: "Riittävän laadukkaita lähiajan kohteita ei löytynyt. SKIP on hyväksytty tulos.", en: "No sufficiently strong near-term picks were found. SKIP is a valid result.", es: "No se encontraron pronósticos próximos con calidad suficiente. SKIP es un resultado válido." })}
            </div>
          )}
          {picks.slice(0, 12).map((pick) => {
            const decision = pick.productDecision || "CAUTION";
            const report = pick.sportsIntelligence;
            const readiness = report?.readiness?.level || "market-only";
            return (
              <article key={`${pick.id}-${pick.selection}`} className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${decisionTone(decision)}`}>{decision}</span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${readinessTone(readiness)}`}>{readiness}</span>
                </div>
                <div className="mt-3 text-xs font-bold text-emerald-300">{kickoffLabel(pick.commenceTime, locale)}</div>
                <div className="mt-1 text-xs text-slate-500">{pick.leagueTitle || pick.league}</div>
                <h2 className="mt-2 text-lg font-black text-white">{pick.match}</h2>
                <div className="mt-1 font-bold text-emerald-300">{pick.selection} · {Number(pick.odds || 0).toFixed(2)}</div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-slate-500">{tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })}</div><div className="font-black text-white">{formatPercent(pick.consensusProbability || pick.modelProbability)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-slate-500">{tr({ fi: "Reilu kerroin", en: "Fair odds", es: "Cuota justa" })}</div><div className="font-black text-white">{pick.fairOdds ? Number(pick.fairOdds).toFixed(2) : "–"}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-slate-500">Edge / EV</div><div className="font-black text-white">{formatPercent(pick.edge)} / {formatPercent(pick.ev)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-slate-500">{tr({ fi: "Dataconfidence", en: "Data confidence", es: "Confianza de datos" })}</div><div className="font-black text-white">{formatPercent(pick.confidence)}</div></div>
                </div>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
                  <div>{report?.sourceCount || 0} {tr({ fi: "riippumatonta lähdenimeä", en: "independent source names", es: "fuentes independientes" })} · {tr({ fi: "valintaan suhteutettu vaikutus", en: "selection-relative impact", es: "impacto relativo a la selección" })} {formatPercent(pick.intelligenceRelativeImpact)}</div>
                  <div className="mt-1">{pick.evidenceGateReason || tr({ fi: "Todennäköisyyttä ei muutettu.", en: "Probability was not changed.", es: "La probabilidad no se modificó." })}</div>
                  {(report?.conflicts || []).slice(0, 2).map((item) => <div key={item} className="mt-1 text-red-300">⚠ {item}</div>)}
                </div>
              </article>
            );
          })}
        </div>
      </Panel>

      <section className="grid gap-6 lg:grid-cols-3">
        <Panel title={tr({ fi: "Varmennettu evidenssi", en: "Verified evidence", es: "Evidencia verificada" })} subtitle={tr({ fi: "Joukkueeseen liitetyt nykyiset havainnot", en: "Current observations attributed to a team", es: "Observaciones actuales atribuidas a un equipo" })}>
          <div className="space-y-3">
            {intelligenceSummary.evidence.length === 0 && <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">{tr({ fi: "Varmennettua riippumatonta evidenssiä ei ole vielä saatavilla.", en: "Verified independent evidence is not available yet.", es: "Aún no hay evidencia independiente verificada." })}</div>}
            {intelligenceSummary.evidence.slice(0, 24).map((item, index) => (
              <div key={`${item.match}-${item.type}-${index}`} className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm">
                <div className="font-bold text-emerald-300">{item.match}</div>
                <div className="mt-1 text-slate-300">{item.text}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={tr({ fi: "Ristiriidat", en: "Conflicts", es: "Conflictos" })} subtitle={tr({ fi: "PLAY estetään, kun lähteet ovat eri mieltä", en: "PLAY is blocked when sources disagree", es: "PLAY se bloquea cuando las fuentes discrepan" })}>
          <div className="space-y-3">
            {intelligenceSummary.conflicts.length === 0 && <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">{tr({ fi: "Ei tunnistettuja ajankohtaisia ristiriitoja.", en: "No current conflicts identified.", es: "No se detectaron conflictos actuales." })}</div>}
            {intelligenceSummary.conflicts.slice(0, 20).map((item, index) => (
              <div key={`${item.match}-${index}`} className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm">
                <div className="font-bold text-red-300">{item.match}</div>
                <div className="mt-1 text-slate-300">{item.item}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={tr({ fi: "Puuttuvat tarkistukset", en: "Missing checks", es: "Comprobaciones faltantes" })} subtitle={tr({ fi: "Miksi kohde ei ansaitse varmennettua tilaa", en: "Why a pick has not earned verified status", es: "Por qué un pronóstico no ha obtenido estado verificado" })}>
          <div className="space-y-3">
            {intelligenceSummary.missing.length === 0 && <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">{tr({ fi: "Ei tunnistettuja aineistopuutteita.", en: "No evidence gaps identified.", es: "No se detectaron carencias de evidencia." })}</div>}
            {intelligenceSummary.missing.slice(0, 24).map((item, index) => (
              <div key={`${item.match}-${item.item}-${index}`} className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-sm">
                <div className="font-bold text-yellow-300">{item.match}</div>
                <div className="mt-1 text-slate-300">{item.item}</div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
