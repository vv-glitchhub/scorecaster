"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import ContextProviderDiagnosticsPanel from "./ContextProviderDiagnosticsPanel";
import ProviderDiagnosticsPanel from "./ProviderDiagnosticsPanel";
import ProviderUsageLimitsPanel from "./ProviderUsageLimitsPanel";

export default function ProviderDiagnosticsClient() {
  const { tr } = useLanguage();
  const [days, setDays] = useState("30");
  const [sportInput, setSportInput] = useState("");
  const [sport, setSport] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ days });
      if (sport) query.set("sport", sport);
      const response = await fetch(`/api/production-evidence?${query}`, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const body = await response.json();
      if (!response.ok || body?.ok === false) throw new Error(body?.error || "Provider diagnostics unavailable");
      setData(body);
    } catch (caught) {
      setError(caught?.message || "Provider diagnostics unavailable");
    } finally {
      setLoading(false);
    }
  }, [days, sport]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mt-6 space-y-3">
      <section className="sc-surface-soft rounded-2xl p-4" aria-label={tr({ fi: "Provider-diagnostiikan suodattimet", en: "Provider diagnosis filters", es: "Filtros de diagnóstico de proveedores" })}>
        <form className="grid gap-3 sm:grid-cols-[180px_1fr_auto]" onSubmit={(event) => { event.preventDefault(); setSport(sportInput.trim().toLowerCase()); }}>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">
            {tr({ fi: "Diagnostiikan aikaikkuna", en: "Diagnosis window", es: "Ventana de diagnóstico" })}
            <select value={days} onChange={(event) => setDays(event.target.value)} className="sc-input mt-2">
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">
            {tr({ fi: "Lajisuodatin", en: "Sport filter", es: "Filtro de deporte" })}
            <input value={sportInput} onChange={(event) => setSportInput(event.target.value)} className="sc-input mt-2" placeholder="soccer_epl" maxLength={80} />
          </label>
          <button type="submit" className="sc-button-secondary self-end">{tr({ fi: "Rajaa diagnostiikka", en: "Filter diagnosis", es: "Filtrar diagnóstico" })}</button>
        </form>
      </section>

      {loading ? <div className="sc-surface-soft rounded-2xl p-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Provider-diagnostiikka latautuu…", en: "Loading provider diagnosis…", es: "Cargando diagnóstico de proveedores…" })}</div> : null}
      {error ? <div role="alert" className="rounded-2xl border border-rose-400/35 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</div> : null}
      {!loading && !error ? (
        <>
          <ProviderDiagnosticsPanel data={data} tr={tr} />
          <ContextProviderDiagnosticsPanel data={data} tr={tr} />
          <ProviderUsageLimitsPanel data={data} tr={tr} />
        </>
      ) : null}
    </div>
  );
}
