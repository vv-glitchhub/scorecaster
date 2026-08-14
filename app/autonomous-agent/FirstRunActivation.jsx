"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

function settingsPayload(settings = {}) {
  return {
    enabled: true,
    sports: settings.sports || [],
    dailyPickLimit: Number(settings.daily_pick_limit ?? 3),
    minPriorityScore: Number(settings.min_priority_score ?? 0.62),
    minOdds: Number(settings.min_odds ?? 1.2),
    maxOdds: Number(settings.max_odds ?? 5),
    minDataCoverage: Number(settings.min_data_coverage ?? 0.6),
    minProviderCount: Number(settings.min_provider_count ?? 1),
    maxProviderDisagreement: Number(settings.max_provider_disagreement ?? 0.12),
    maxDrawdownPercent: Number(settings.max_drawdown_percent ?? 12),
    maxDailyLossPercent: Number(settings.max_daily_loss_percent ?? 4),
    pauseAfterLosses: Number(settings.pause_after_losses ?? 5),
    cooldownHours: Number(settings.cooldown_hours ?? 12),
    maxOpenPicks: Number(settings.max_open_picks ?? 12),
    minimumMinutesBeforeStart: Number(settings.minimum_minutes_before_start ?? 20),
    maximumHoursBeforeStart: Number(settings.maximum_hours_before_start ?? 72),
    autoPauseOnIncident: settings.auto_pause_on_incident !== false,
    requireUnifiedData: settings.require_unified_data !== false,
    adaptiveCadence: settings.adaptive_cadence !== false,
    shadowLearningEnabled: settings.shadow_learning_enabled !== false
  };
}

export default function FirstRunActivation() {
  const { tr } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function readStatus() {
    const response = await fetch("/api/cloud/autonomous-agent", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Autonomous Agent unavailable");
    return payload;
  }

  useEffect(() => {
    let active = true;
    readStatus()
      .then((payload) => { if (active) setData(payload); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function startPaperAutomation() {
    setStarting(true);
    setError("");
    try {
      const current = data || await readStatus();
      const saveResponse = await fetch("/api/cloud/autonomous-agent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsPayload(current.settings))
      });
      const saved = await saveResponse.json();
      if (!saveResponse.ok) throw new Error(saved?.error || "Paper automation could not be enabled");

      const refreshed = await readStatus();
      if (!refreshed?.readiness?.ready) {
        const blockers = Array.isArray(refreshed?.readiness?.blockers) ? refreshed.readiness.blockers.join(", ") : "safety_gate";
        throw new Error(tr({
          fi: `Paperiautomatiikka aktivoitiin, mutta ensimmäinen ajo odottaa turvaporttia: ${blockers}`,
          en: `Paper automation was enabled, but the first run is waiting on a safety gate: ${blockers}`,
          es: `La automatización simulada se activó, pero la primera ejecución espera una puerta de seguridad: ${blockers}`
        }));
      }

      const runResponse = await fetch("/api/cloud/autonomous-agent", { method: "POST" });
      const run = await runResponse.json();
      if (!runResponse.ok) throw new Error(run?.error || "First paper run could not be queued");
      window.location.reload();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : tr({
        fi: "Paperiautomatiikkaa ei voitu käynnistää.",
        en: "Paper automation could not be started.",
        es: "No se pudo iniciar la automatización simulada."
      }));
      try { setData(await readStatus()); } catch {}
    } finally {
      setStarting(false);
    }
  }

  if (loading || !data?.available || data?.settings?.enabled) return null;

  const productionReady = Boolean(data?.configuration?.enabledFlag && data?.configuration?.configured);

  return (
    <section className="rounded-[1.6rem] border border-emerald-300/30 bg-emerald-300/10 p-5 shadow-[0_18px_55px_rgba(16,185,129,0.08)] sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-3xl">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
            {tr({ fi: "Ensimmäinen tuotantoajo", en: "First production run", es: "Primera ejecución de producción" })}
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--sc-text)]">
            {tr({ fi: "Käynnistä Scorecaster pelaamaan paperirahalla", en: "Start Scorecaster with paper money", es: "Inicia Scorecaster con dinero simulado" })}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">
            {tr({
              fi: "Yksi painallus tekee käyttäjän nimenomaisen opt-inin, luo tarvittaessa 1 000 € virtuaalikassan ja jonottaa ensimmäisen suojatun paperiajon. Worker tarkistaa riskirajat, datan laadun ja markkinan ennen yhtäkään valintaa.",
              en: "One explicit action opts you in, creates a €1,000 virtual bankroll when needed, and queues the first protected paper run. The worker checks risk limits, data quality and the market before every selection.",
              es: "Una acción explícita activa tu participación, crea una banca virtual de 1.000 € cuando sea necesario y pone en cola la primera ejecución protegida. El worker verifica riesgos, datos y mercado antes de cada selección."
            })}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-100">1 000 € virtual</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-slate-300">max 3 picks/day</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-slate-300">paper-only</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-slate-300">settlement → agent</span>
          </div>
        </div>

        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-slate-400">{tr({ fi: "Tuotantoworker", en: "Production worker", es: "Worker de producción" })}</span>
            <span className={`text-sm font-black ${productionReady ? "text-emerald-200" : "text-amber-200"}`}>
              {productionReady ? "READY" : "BLOCKED"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void startPaperAutomation()}
            disabled={starting || !productionReady}
            className="sc-button-primary mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-40"
          >
            {starting
              ? tr({ fi: "Käynnistetään…", en: "Starting…", es: "Iniciando…" })
              : tr({ fi: "Käynnistä 1 000 € paperiautomatiikka", en: "Start €1,000 paper automation", es: "Iniciar automatización de 1.000 €" })}
          </button>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            {tr({
              fi: "Ei oikeita vetoja, talletuksia, maksuja tai vedonvälittäjäkirjautumisia. Hätäpysäytys säilyy aina käytettävissä.",
              en: "No real bets, deposits, payments or bookmaker logins. Emergency stop remains available at all times.",
              es: "Sin apuestas reales, depósitos, pagos ni accesos a casas. La parada de emergencia sigue disponible."
            })}
          </p>
          {!productionReady && (
            <Link href="/production-control-center" className="sc-button-ghost mt-3 w-full justify-center">
              {tr({ fi: "Avaa tuotantotarkistus", en: "Open production checks", es: "Abrir controles de producción" })}
            </Link>
          )}
          {error && <div className="mt-3 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-xs leading-5 text-rose-100">{error}</div>}
        </div>
      </div>
    </section>
  );
}
