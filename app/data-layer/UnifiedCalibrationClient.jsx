"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { MetricTile, SectionHeader } from "../components/ProductUI";

function percent(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)}%` : "–";
}

export default function UnifiedCalibrationClient() {
  const { tr } = useLanguage();
  const [state, setState] = useState({ loading: true, available: false, error: "", summary: null, rows: [] });

  useEffect(() => {
    let active = true;
    fetch("/api/data-layer/calibration?days=180&limit=500", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Calibration unavailable");
        if (active) setState({ loading: false, available: payload.available === true, error: payload.reason || "", summary: payload.summary || null, rows: payload.rows || [] });
      })
      .catch((error) => { if (active) setState({ loading: false, available: false, error: error instanceof Error ? error.message : "Calibration unavailable", summary: null, rows: [] }); });
    return () => { active = false; };
  }, []);

  return (
    <section className="sc-surface rounded-[1.6rem] p-5 sm:p-6">
      <SectionHeader
        eyebrow="Chronology-safe calibration"
        title={tr({ fi: "Mitä historiadataa AI-labrat saavat käyttää", en: "What historical data AI labs may use", es: "Qué historial pueden usar los laboratorios IA" })}
        description={tr({ fi: "Datasetti käyttää vain viimeistä ennen aloitusta tallennettua snapshotia ja vasta aloituksen jälkeen lukittua closing-linjaa. Lopputulosta tai tulevaa hintaa ei vuoda ennakkoon.", en: "The dataset uses only the final pre-start snapshot and a closing line locked after start. No outcome or future price leaks into pregame analysis.", es: "El conjunto usa solo la última captura previa y el cierre fijado después del inicio." })}
      />
      {state.loading && <div className="mt-4 h-24 animate-pulse rounded-xl bg-[var(--sc-surface-soft)]" />}
      {!state.loading && !state.available && <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">{state.error || tr({ fi: "Kalibrointidata syntyy migraation, capture-workerin ja ensimmäisten alkaneiden otteluiden jälkeen.", en: "Calibration data appears after migration, capture and the first tracked event starts.", es: "Los datos aparecen después de la migración y los primeros eventos." })}</div>}
      {state.available && <>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label={tr({ fi: "Otos", en: "Sample", es: "Muestra" })} value={state.summary?.sampleSize || 0} />
          <MetricTile label="CLV sample" value={state.summary?.clvSampleSize || 0} />
          <MetricTile label={tr({ fi: "Keskimääräinen CLV", en: "Average CLV", es: "CLV medio" })} value={percent(state.summary?.averagePriceClv)} tone={Number(state.summary?.averagePriceClv || 0) >= 0 ? "green" : "red"} />
          <MetricTile label={tr({ fi: "Positiivinen CLV", en: "Positive CLV", es: "CLV positivo" })} value={percent(state.summary?.positiveClvRate, 0)} tone="blue" />
        </div>
        <div className="mt-5 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm leading-6 text-[var(--sc-muted)]">
          {tr({ fi: "Sallitut käyttötavat: provider-laadun kalibrointi, CLV-kalibrointi ja varjomallitutkimus. Kielletty: ennakkotodennäköisyys, edge, EV, automaattinen PLAY-korotus ja oikean rahan toiminta.", en: "Allowed: provider-quality calibration, CLV calibration and shadow-model research. Forbidden: pregame probability, edge, EV, automatic PLAY upgrades and real-money action.", es: "Permitido: calibración y modelos sombra. Prohibido: probabilidad previa, edge, EV y acciones con dinero real." })}
        </div>
        {state.rows.length > 0 && <div className="mt-4 text-xs text-[var(--sc-faint)]">{state.rows.length} chronology-verified rows available through the calibration API.</div>}
      </>}
    </section>
  );
}