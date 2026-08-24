"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "./LanguageProvider";

export default function RecommendationAlertCTA() {
  const { tr } = useLanguage();
  const [top, setTop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/recommendations?limit=1", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || payload?.ok !== true) throw new Error("Recommendation unavailable");
        if (!cancelled) setTop(payload.topRecommendation || null);
      } catch {
        if (!cancelled) setMessage(tr({ fi: "Suosituksen palvelinvalvontaa ei voitu alustaa juuri nyt.", en: "Recommendation monitoring could not be initialized right now.", es: "No se pudo iniciar la supervisión de recomendaciones." }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [tr]);

  const canWatch = useMemo(() => Boolean(top?.eventId && top?.selection && top?.sportKey), [top]);

  async function enableAlerts() {
    if (!canWatch || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/cloud/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: top.eventId,
          selection: top.selection,
          sport: top.sportKey,
          alertMovePercent: 0.03,
          alertBeforeMinutes: 120
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setState("auth");
          setMessage(tr({ fi: "Kirjaudu sisään, jotta Scorecaster voi tallentaa tämän kohteen käyttäjäkohtaiseen valvontaan.", en: "Sign in so Scorecaster can save this selection to your private monitoring list.", es: "Inicia sesión para guardar esta selección en tu lista privada de seguimiento." }));
          return;
        }
        throw new Error(payload?.error || "Watchlist save failed");
      }
      setState("saved");
      setMessage(tr({ fi: "Palvelinvalvonta on käytössä. Alert Inbox nostaa muutoksen, jos päätös, hinta tai PLAY-portti muuttuu.", en: "Server monitoring is active. Alert Inbox will surface a change in decision, price or PLAY gate.", es: "La supervisión del servidor está activa. Alert Inbox mostrará cambios de decisión, cuota o filtro PLAY." }));
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Watchlist save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className="h-28 animate-pulse rounded-[1.6rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]" />;
  }

  if (!top) return null;

  return (
    <section className="rounded-[1.6rem] border border-purple-400/25 bg-purple-400/8 p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-4xl">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-300">Recommendation Alert Engine V2</div>
          <h2 className="mt-2 text-xl font-black text-[var(--sc-text)] sm:text-2xl">
            {tr({ fi: "Valvo #1-kohdetta palvelimella ja nosta oikea muutos inboxiin", en: "Monitor the #1 pick on the server and surface real changes in the inbox", es: "Supervisa la selección #1 en el servidor y muestra cambios reales en el buzón" })}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">
            {top.match} · {top.selection} @ {Number(top.odds || 0).toFixed(2)} · {top.decision}. {tr({
              fi: "Hälytys syntyy esimerkiksi CAUTION → PLAY -muutoksesta, PLAYn peruuntumisesta, olennaisesta kerroinliikkeestä tai siitä, että markkinaportit täyttyvät mutta varmennettu evidenssi puuttuu.",
              en: "Alerts can be raised for CAUTION → PLAY, revoked PLAY status, material price movement, or when market gates pass but verified evidence is still missing.",
              es: "Las alertas pueden aparecer por CAUTION → PLAY, pérdida de PLAY, movimientos relevantes de cuota o falta de evidencia verificada pese a superar los filtros de mercado."
            })}
          </p>
          {message && <div className={`mt-3 text-sm font-bold ${state === "error" ? "text-rose-300" : state === "saved" ? "text-emerald-300" : "text-amber-200"}`}>{message}</div>}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {state === "auth" ? (
            <Link href="/login" className="sc-button-primary">{tr({ fi: "Kirjaudu ja ota valvonta käyttöön", en: "Sign in and enable monitoring", es: "Iniciar sesión y activar" })}</Link>
          ) : (
            <button type="button" onClick={() => void enableAlerts()} disabled={!canWatch || saving || state === "saved"} className="sc-button-primary disabled:opacity-50">
              {state === "saved" ? tr({ fi: "Valvonta käytössä", en: "Monitoring active", es: "Supervisión activa" }) : saving ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Valvo tätä #1-kohdetta", en: "Monitor this #1 pick", es: "Supervisar selección #1" })}
            </button>
          )}
          <Link href="/alerts" className="sc-button-secondary">{tr({ fi: "Alert Inbox", en: "Alert Inbox", es: "Alert Inbox" })}</Link>
          <Link href="/watchlist" className="sc-button-secondary">{tr({ fi: "Seurantalista", en: "Watchlist", es: "Seguimiento" })}</Link>
        </div>
      </div>
      {!canWatch && <div className="mt-3 text-xs text-[var(--sc-muted)]">{tr({ fi: "Kohdetta ei voi vielä lisätä palvelinvalvontaan, koska live-providerin sportKey-varmennus puuttuu.", en: "This pick cannot yet be added to server monitoring because the live-provider sportKey verification is unavailable.", es: "Esta selección aún no puede añadirse porque falta la verificación sportKey del proveedor." })}</div>}
    </section>
  );
}
