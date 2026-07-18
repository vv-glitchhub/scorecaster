"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const ITEMS = [
  ["in_app_enabled", { fi: "Sovelluksen inbox", en: "In-app inbox", es: "Buzón de la app" }],
  ["high_enabled", { fi: "Korkeat hälytykset", en: "High alerts", es: "Alertas altas" }],
  ["medium_enabled", { fi: "Keskitason hälytykset", en: "Medium alerts", es: "Alertas medias" }],
  ["info_enabled", { fi: "Info-hälytykset", en: "Info alerts", es: "Alertas informativas" }],
  ["kickoff_enabled", { fi: "Ottelun alku", en: "Kickoff", es: "Inicio" }],
  ["decision_enabled", { fi: "Päätösmuutos", en: "Decision change", es: "Cambio de decisión" }],
  ["price_enabled", { fi: "Hintamuutos", en: "Price change", es: "Cambio de cuota" }]
];

export default function NotificationSettings() {
  const { tr } = useLanguage();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const response = await fetch("/api/cloud/notifications", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Notification settings unavailable");
      setState(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Notification settings unavailable");
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggle(key) {
    if (!state?.available || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/cloud/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: !state.preferences[key] })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Preference update failed");
      setState(payload);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Preference update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">{tr({ fi: "Ilmoitusasetukset", en: "Notification settings", es: "Configuración de notificaciones" })}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{tr({ fi: "Asetukset suodattavat Alert Inboxiin tallennettavat aktiiviset ehdot. Push-laitteen lupa ja token voidaan rekisteröidä vain native-sovelluksessa.", en: "These settings filter active conditions stored in Alert Inbox. Push permission and token registration are available only in the native app.", es: "Estos ajustes filtran las condiciones activas del buzón. El permiso y token push solo se registran en la app nativa." })}</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}
      {state?.warning && <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-sm text-yellow-100">{state.warning}</div>}

      <div className="mt-5 flex flex-wrap gap-2">
        {ITEMS.map(([key, label]) => {
          const active = Boolean(state?.preferences?.[key]);
          return <button type="button" role="switch" aria-checked={active} disabled={busy || !state?.available} key={key} onClick={() => void toggle(key)} className={`rounded-full border px-4 py-2 text-sm font-black disabled:opacity-40 ${active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-slate-950 text-slate-400"}`}>{active ? "✓ " : ""}{tr(label)}</button>;
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label={tr({ fi: "Push käytössä", en: "Push enabled", es: "Push activo" })} value={state?.preferences?.push_enabled ? tr({ fi: "Kyllä", en: "Yes", es: "Sí" }) : tr({ fi: "Ei", en: "No", es: "No" })} />
        <Metric label={tr({ fi: "Rekisteröidyt laitteet", en: "Registered devices", es: "Dispositivos registrados" })} value={String(state?.devices?.length || 0)} />
        <Metric label={tr({ fi: "Taustalähetys", en: "Background delivery", es: "Envío en segundo plano" })} value={state?.deliveryActive ? tr({ fi: "Aktiivinen", en: "Active", es: "Activo" }) : tr({ fi: "Ei vielä", en: "Not yet", es: "Aún no" })} />
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-black text-white">{value}</div></div>;
}
