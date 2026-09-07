"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../components/LanguageProvider";
import { MetricTile, SectionHeader, TrustBar } from "../../components/ProductUI";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pct(value) {
  const number = finite(value);
  return number === null ? "–" : `${(number * 100).toFixed(1)} %`;
}

function decimal(value) {
  const number = finite(value);
  return number === null ? "–" : number.toFixed(3);
}

function Gate({ label, status = "blocked", detail, tr }) {
  const meta = {
    pass: { cls: "border-emerald-400/25 bg-emerald-400/7", tone: "text-emerald-300", text: "PASS" },
    blocked: { cls: "border-amber-400/25 bg-amber-400/7", tone: "text-amber-300", text: "BLOCKED" },
    neutral: { cls: "border-sky-400/20 bg-sky-400/5", tone: "text-sky-300", text: tr({ fi: "INFO", en: "INFO", es: "INFO" }) },
    "not-required": { cls: "border-[var(--sc-border)] bg-[var(--sc-surface)]", tone: "text-[var(--sc-muted)]", text: tr({ fi: "EI VIELÄ VAADITA", en: "NOT REQUIRED YET", es: "AÚN NO REQUERIDO" }) }
  }[status] || null;
  return <div className={`rounded-xl border p-3 ${meta.cls}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-black text-[var(--sc-text)]">{label}</span><span className={`text-[10px] font-black uppercase ${meta.tone}`}>{meta.text}</span></div>{detail ? <div className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">{detail}</div> : null}</div>;
}

export default function FootballIndependentEvidencePanel({ eventId, sport, selection }) {
  const { tr } = useLanguage();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventId || !String(sport || "").toLowerCase().includes("soccer")) {
      setLoading(false);
      return;
    }
    let active = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const params = new URLSearchParams({ eventId, sport });
        if (selection) params.set("selection", selection);
        const response = await fetch(`/api/football-evidence?${params}`, { cache: "no-store", signal: AbortSignal.timeout(45_000) });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Football evidence unavailable");
        if (active) setPayload(data);
      } catch (nextError) {
        if (active) setError(nextError?.name === "TimeoutError" ? tr({ fi: "Evidenssin tarkistus ei valmistunut ajoissa. Yritä uudelleen.", en: "The evidence audit timed out. Please try again.", es: "La auditoría tardó demasiado. Inténtalo de nuevo." }) : nextError instanceof Error ? nextError.message : "Football evidence unavailable");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [eventId, selection, sport, tr]);

  const evidence = payload?.evidence;
  const predictive = evidence?.families?.predictive;
  const availability = evidence?.families?.availability;
  const form = evidence?.families?.scheduleForm;
  const checks = evidence?.readiness?.checks || {};
  const missing = useMemo(() => Array.isArray(evidence?.readiness?.missing) ? evidence.readiness.missing : [], [evidence]);

  if (!String(sport || "").toLowerCase().includes("soccer")) return null;

  const ownModel = predictive?.sourceType === "owned-model";
  const predictiveName = ownModel
    ? tr({ fi: "Scorecasterin oma malli", en: "Scorecaster own model", es: "Modelo propio de Scorecaster" })
    : tr({ fi: "Riippumaton xG-malli", en: "Independent xG model", es: "Modelo xG independiente" });
  const injuryStatus = availability?.injuryRequired !== true
    ? "not-required"
    : availability?.injuryStatusLive === true ? "pass" : "blocked";
  const lineupStatus = availability?.lineupRequired !== true
    ? "not-required"
    : availability?.lineups?.bothConfirmed === true ? "pass" : "blocked";
  const conflictStatus = Array.isArray(evidence?.criticalConflicts) && evidence.criticalConflicts.length ? "blocked" : "neutral";

  return <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6" data-football-independent-evidence-v1="true">
    <SectionHeader eyebrow="Football Independent Evidence V1" title={tr({ fi: "Riippumaton jalkapalloevidenssi", en: "Independent football evidence", es: "Evidencia independiente de fútbol" })} description={tr({ fi: "Scorecaster tarkistaa oman tai muun riippumattoman mallin, loukkaantumiset, kokoonpanot ja form/rest-datan erillään markkinahinnasta. Puuttuva tieto näkyy puuttuvana, ei nollana.", en: "Scorecaster audits its own or another independent model, injuries, lineups and form/rest separately from market price. Missing data remains missing, never zero.", es: "Scorecaster audita su modelo u otro modelo independiente, lesiones, alineaciones y forma/descanso por separado del mercado. Los datos ausentes no se convierten en cero." })} />

    {loading ? <div className="mt-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Tarkistetaan evidenssiä…", en: "Auditing evidence…", es: "Auditando evidencia…" })}</div> : null}
    {error ? <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/8 p-4 text-sm text-amber-200">{error}</div> : null}

    {evidence ? <>
      <TrustBar className="mt-4" items={[
        { label: tr({ fi: "Valmius", en: "Readiness", es: "Preparación" }), value: evidence.readiness?.level || "market-only", tone: evidence.readiness?.level === "verified" ? "good" : "warning" },
        { label: tr({ fi: "Evidenssipisteet", en: "Evidence score", es: "Puntuación" }), value: `${Math.round(Number(evidence.readiness?.score || 0) * 100)}%`, tone: "info" },
        { label: tr({ fi: "Ennustelähde", en: "Predictive source", es: "Fuente predictiva" }), value: ownModel ? tr({ fi: "Scorecaster oma malli", en: "Scorecaster own model", es: "Modelo propio" }) : predictive?.entitlement?.source || predictive?.providers?.[0] || tr({ fi: "ei saatavilla", en: "unavailable", es: "no disponible" }), tone: predictive?.qualified ? "good" : "warning" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: "paper-only", tone: "warning" }
      ]} />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label={predictiveName} value={predictive?.qualified ? tr({ fi: "KELPOINEN", en: "QUALIFIED", es: "APTO" }) : predictive?.status ? String(predictive.status).toUpperCase() : tr({ fi: "EI SAATAVILLA", en: "UNAVAILABLE", es: "NO DISPONIBLE" })} tone={predictive?.qualified ? "green" : "yellow"} />
        <MetricTile label={tr({ fi: "Mallin todennäköisyys", en: "Model probability", es: "Probabilidad del modelo" })} value={pct(predictive?.probability)} tone="blue" />
        <MetricTile label={tr({ fi: "Markkinakonsensus", en: "Market consensus", es: "Consenso mercado" })} value={pct(predictive?.marketConsensusProbability)} />
        <MetricTile label={tr({ fi: "Mallin ero markkinaan", en: "Model vs market", es: "Modelo vs mercado" })} value={pct(predictive?.probabilityDelta)} tone={finite(predictive?.probabilityDelta) === null ? undefined : Number(predictive.probabilityDelta) >= -0.02 ? "green" : "red"} />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">{tr({ fi: "Ennustava malli", en: "Predictive model", es: "Modelo predictivo" })}</div><div className="mt-3 space-y-2"><Gate tr={tr} label={tr({ fi: "Kronologia turvallinen", en: "Chronology safe", es: "Cronología segura" })} status={predictive?.chronologySafe === true ? "pass" : "blocked"} detail={predictive?.newestObservedAt ? `${tr({ fi: "Uusin havainto", en: "Newest", es: "Más reciente" })} ${predictive.newestObservedAt} · ${decimal(predictive.ageHours)} h` : tr({ fi: "Ei kelpoista ennen ottelua tallennettua ennustetta", en: "No eligible stored pre-match prediction", es: "No hay predicción prepartido apta" })} /><Gate tr={tr} label={tr({ fi: "Lähdeoikeudet ja mallikäyttö", en: "Source rights + model use", es: "Derechos y uso del modelo" })} status={predictive?.entitlement?.commercialUseAllowed === true && predictive?.entitlement?.modelUseAllowed === true ? "pass" : "blocked"} detail={predictive?.entitlement?.configured ? tr({ fi: "Käyttöoikeudet varmennettu", en: "Entitlements confirmed", es: "Derechos confirmados" }) : tr({ fi: "Oikeudet tai provider eivät ole varmennettu", en: "Provider or rights are not verified", es: "Proveedor o derechos no verificados" })} /><Gate tr={tr} label={tr({ fi: "Tukeeko valittua kohdetta", en: "Supports selected side", es: "Apoya la selección" })} status={predictive?.supportsSelection === true ? "pass" : "blocked"} detail={`${tr({ fi: "Malli vs markkina", en: "Model vs market", es: "Modelo vs mercado" })}: ${pct(predictive?.probabilityDelta)}${predictive?.strongConflict ? ` · ${tr({ fi: "vahva ristiriita", en: "strong conflict", es: "conflicto fuerte" })}` : ""}`} /><Gate tr={tr} label={tr({ fi: "Shot-quality-data", en: "Shot-quality support", es: "Datos de tiro" })} status={ownModel ? "not-required" : predictive?.shotQuality?.available === true ? "pass" : "blocked"} detail={ownModel ? tr({ fi: "Scorecasterin baseline ei tarvitse xG/shot-metriikoita tähän ennusteeseen.", en: "The Scorecaster baseline does not require xG/shot metrics for this prediction.", es: "El baseline de Scorecaster no requiere métricas xG/tiro para esta predicción." }) : `${predictive?.shotQuality?.metricCount || 0}/${predictive?.shotQuality?.requestedMetricCount || 4}`} /></div></div>
        <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-violet-300">{tr({ fi: "Saatavuus", en: "Availability", es: "Disponibilidad" })}</div><div className="mt-3 space-y-2"><Gate tr={tr} label={tr({ fi: "Live loukkaantumis-/pelikieltotila", en: "Live injury / suspension status", es: "Lesiones / sanciones en vivo" })} status={injuryStatus} detail={availability?.injuryRequired ? tr({ fi: "Vaaditaan viimeisen 24 tunnin aikana.", en: "Required inside the final 24-hour window.", es: "Requerido en las últimas 24 horas." }) : tr({ fi: "Tätä dataa ei vaadita vielä yli 24 h ennen ottelua.", en: "This data is not required more than 24h before kickoff.", es: "No se requiere a más de 24 h del inicio." })} /><Gate tr={tr} label={tr({ fi: "Ristiriitatarkistus", en: "Conflict check", es: "Comprobación de conflictos" })} status={conflictStatus} detail={conflictStatus === "neutral" ? tr({ fi: "Kriittistä ristiriitaa ei ole havaittu. Tämä ei yksin tarkoita varmennettua evidenssiä.", en: "No critical conflict is detected. This alone does not mean evidence is verified.", es: "No se detecta conflicto crítico; esto no verifica la evidencia por sí solo." }) : tr({ fi: "Kriittinen evidenssiristiriita on ratkaistava.", en: "A critical evidence conflict must be resolved.", es: "Debe resolverse un conflicto crítico." })} /><Gate tr={tr} label={tr({ fi: "Avauskokoonpanot", en: "Starting lineups", es: "Alineaciones" })} status={lineupStatus} detail={availability?.lineupRequired ? `${tr({ fi: "Vaaditaan viimeisen 6 h aikana", en: "Required inside final 6h", es: "Requerido en las últimas 6 h" })} · home ${availability?.lineups?.homeConfirmed ? "✓" : "–"} / away ${availability?.lineups?.awayConfirmed ? "✓" : "–"}` : tr({ fi: "Kokoonpanoja ei vaadita ennen viimeistä 6 tunnin ikkunaa.", en: "Lineups are not required until the final 6-hour window.", es: "No se requieren hasta las últimas 6 horas." })} /></div></div>
        <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">Form / rest</div><div className="mt-3 space-y-2"><Gate tr={tr} label={tr({ fi: "Kronologiasuoja", en: "Chronology guard", es: "Guardia cronológica" })} status={form?.chronologySafe === true ? "pass" : "blocked"} /><Gate tr={tr} label={tr({ fi: "Riittävä viime otteluiden otos", en: "Recent sample", es: "Muestra reciente" })} status={form?.enoughHistory === true ? "pass" : "blocked"} detail={`Home ${form?.homeSampleSize || 0} · Away ${form?.awaySampleSize || 0}`} /><Gate tr={tr} label={tr({ fi: "Lepo tunnetaan", en: "Rest known", es: "Descanso conocido" })} status={form?.restKnown === true ? "pass" : "blocked"} /><Gate tr={tr} label={tr({ fi: "Form/rest varmennettu", en: "Family verified", es: "Familia verificada" })} status={form?.verified === true ? "pass" : "blocked"} /></div></div>
      </div>

      <div className={`mt-5 rounded-[1.25rem] border p-4 ${evidence.readiness?.allowsIndependentPlayEvidence ? "border-emerald-400/25 bg-emerald-400/8" : "border-amber-400/25 bg-amber-400/8"}`}>
        <div className="font-black text-[var(--sc-text)]">{evidence.readiness?.allowsIndependentPlayEvidence ? tr({ fi: "Riippumaton evidence-portti täyttyy", en: "Independent evidence gate is satisfied", es: "Se cumple el filtro de evidencia" }) : tr({ fi: "PLAY ei vielä läpäise evidence-porttia", en: "PLAY does not yet pass the evidence gate", es: "PLAY aún no supera el filtro de evidencia" })}</div>
        {missing.length ? <ul className="mt-2 space-y-1 text-sm text-[var(--sc-muted)]">{missing.map((item) => <li key={item}>• {item}</li>)}</ul> : <div className="mt-2 text-sm text-[var(--sc-muted)]">{tr({ fi: "Ennustava malli, tukiperhe ja ristiriitatarkistus ovat läpi. Lopullinen turvallisuustarkistus vaaditaan silti.", en: "Predictive model, supporting family and conflict gate passed. The final safety check is still required.", es: "Modelo, familia de apoyo y conflictos superados. Aún se requiere la comprobación final." })}</div>}
      </div>
    </> : null}
  </section>;
}
