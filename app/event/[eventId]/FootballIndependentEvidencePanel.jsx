"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../components/LanguageProvider";
import { MetricTile, SectionHeader, TrustBar } from "../../components/ProductUI";

function pct(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)} %` : "–";
}

function decimal(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(3) : "–";
}

function Gate({ label, passed, detail }) {
  return <div className={`rounded-xl border p-3 ${passed ? "border-emerald-400/25 bg-emerald-400/7" : "border-amber-400/25 bg-amber-400/7"}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-black text-[var(--sc-text)]">{label}</span><span className={`text-[10px] font-black uppercase ${passed ? "text-emerald-300" : "text-amber-300"}`}>{passed ? "PASS" : "BLOCKED"}</span></div>{detail ? <div className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">{detail}</div> : null}</div>;
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
        const response = await fetch(`/api/football-evidence?${params}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Football evidence unavailable");
        if (active) setPayload(data);
      } catch (nextError) {
        if (active) setError(nextError instanceof Error ? nextError.message : "Football evidence unavailable");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [eventId, selection, sport]);

  const evidence = payload?.evidence;
  const predictive = evidence?.families?.predictive;
  const availability = evidence?.families?.availability;
  const form = evidence?.families?.scheduleForm;
  const checks = evidence?.readiness?.checks || {};
  const missing = useMemo(() => Array.isArray(evidence?.readiness?.missing) ? evidence.readiness.missing : [], [evidence]);

  if (!String(sport || "").toLowerCase().includes("soccer")) return null;

  return <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6" data-football-independent-evidence-v1="true">
    <SectionHeader eyebrow="Football Independent Evidence V1" title={tr({ fi: "Riippumaton jalkapalloevidenssi", en: "Independent football evidence", es: "Evidencia independiente de fútbol" })} description={tr({ fi: "xG/shot-quality, loukkaantumiset, kokoonpanot sekä form/rest arvioidaan erillään markkinahinnasta. Tämä kerros ei muuta mallin todennäköisyyttä, edgeä tai EV:tä; se voi vain täyttää jo olemassa olevan evidence-portin.", en: "xG/shot quality, injuries, lineups and form/rest are audited independently from market price. This layer never changes model probability, edge or EV; it can only satisfy the existing evidence gate.", es: "xG/calidad de tiro, lesiones, alineaciones y forma/descanso se auditan aparte del mercado. Esta capa no cambia probabilidad, edge ni EV; solo puede satisfacer el filtro de evidencia existente." })} />

    {loading ? <div className="mt-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Tarkistetaan evidenssiä…", en: "Auditing evidence…", es: "Auditando evidencia…" })}</div> : null}
    {error ? <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/8 p-4 text-sm text-amber-200">{error}</div> : null}

    {evidence ? <>
      <TrustBar className="mt-4" items={[
        { label: tr({ fi: "Readiness", en: "Readiness", es: "Preparación" }), value: evidence.readiness?.level || "market-only", tone: evidence.readiness?.level === "verified" ? "good" : "warning" },
        { label: "Evidence score", value: `${Math.round(Number(evidence.readiness?.score || 0) * 100)}%`, tone: "info" },
        { label: tr({ fi: "Lähde", en: "Predictive source", es: "Fuente predictiva" }), value: predictive?.entitlement?.source || predictive?.providers?.[0] || "not configured", tone: predictive?.qualified ? "good" : "warning" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: "paper-only", tone: "warning" }
      ]} />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="xG model" value={predictive?.qualified ? "QUALIFIED" : String(predictive?.status || "unavailable").toUpperCase()} tone={predictive?.qualified ? "green" : "yellow"} />
        <MetricTile label={tr({ fi: "xG todennäköisyys", en: "xG probability", es: "Probabilidad xG" })} value={pct(predictive?.probability)} tone="blue" />
        <MetricTile label={tr({ fi: "Markkinakonsensus", en: "Market consensus", es: "Consenso mercado" })} value={pct(predictive?.marketConsensusProbability)} />
        <MetricTile label={tr({ fi: "Erotus", en: "Difference", es: "Diferencia" })} value={pct(predictive?.probabilityDelta)} tone={Number(predictive?.probabilityDelta) >= -0.02 ? "green" : "red"} />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">Predictive · xG / shot quality</div><div className="mt-3 space-y-2"><Gate label="Chronology safe" passed={checks.predictiveQualified === true || predictive?.chronologySafe === true} detail={predictive?.newestObservedAt ? `Newest ${predictive.newestObservedAt} · age ${decimal(predictive.ageHours)} h` : "No licensed stored pregame xG yet"} /><Gate label="Source rights + model use" passed={predictive?.entitlement?.commercialUseAllowed === true && predictive?.entitlement?.modelUseAllowed === true} detail={predictive?.entitlement?.configured ? "Entitlement flags confirmed" : "Fail-closed until provider token and rights flags are configured"} /><Gate label="Supports selected side" passed={predictive?.supportsSelection === true} detail={`xG vs market: ${pct(predictive?.probabilityDelta)} · strong conflict ${predictive?.strongConflict ? "yes" : "no"}`} /><Gate label="Shot-quality support" passed={predictive?.shotQuality?.available === true} detail={`${predictive?.shotQuality?.metricCount || 0}/${predictive?.shotQuality?.requestedMetricCount || 4} shot metrics stored`} /></div></div>
        <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-violet-300">Availability</div><div className="mt-3 space-y-2"><Gate label="Live injury / suspension status" passed={availability?.injuryStatusLive === true} /><Gate label="Evidence conflict-free" passed={availability?.conflictFree === true} /><Gate label="Starting lineups" passed={!availability?.lineupRequired || availability?.lineups?.bothConfirmed === true} detail={availability?.lineupRequired ? `Required inside final 6h · home ${availability?.lineups?.homeConfirmed ? "✓" : "–"} / away ${availability?.lineups?.awayConfirmed ? "✓" : "–"}` : "Not mandatory until the final 6-hour window"} /></div></div>
        <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">Form / rest</div><div className="mt-3 space-y-2"><Gate label="Chronology guard" passed={form?.chronologySafe === true} /><Gate label="Recent sample" passed={form?.enoughHistory === true} detail={`Home ${form?.homeSampleSize || 0} · Away ${form?.awaySampleSize || 0}`} /><Gate label="Rest known" passed={form?.restKnown === true} /><Gate label="Family verified" passed={form?.verified === true} /></div></div>
      </div>

      <div className={`mt-5 rounded-[1.25rem] border p-4 ${evidence.readiness?.allowsIndependentPlayEvidence ? "border-emerald-400/25 bg-emerald-400/8" : "border-amber-400/25 bg-amber-400/8"}`}>
        <div className="font-black text-[var(--sc-text)]">{evidence.readiness?.allowsIndependentPlayEvidence ? tr({ fi: "Verified evidence -portti voidaan täyttää", en: "Verified evidence gate can be satisfied", es: "El filtro de evidencia verificada puede cumplirse" }) : tr({ fi: "PLAY pysyy estettynä evidenssin osalta", en: "PLAY remains blocked by evidence", es: "PLAY sigue bloqueado por evidencia" })}</div>
        {missing.length ? <ul className="mt-2 space-y-1 text-sm text-[var(--sc-muted)]">{missing.map((item) => <li key={item}>• {item}</li>)}</ul> : <div className="mt-2 text-sm text-[var(--sc-muted)]">{tr({ fi: "Predictive + supporting family + conflict gate ovat läpi. Final safety check vaaditaan silti.", en: "Predictive + supporting family + conflict gate passed. The final safety check is still required.", es: "Predictivo + familia de apoyo + conflictos superados. Aún se requiere la comprobación final." })}</div>}
      </div>
    </> : null}
  </section>;
}
