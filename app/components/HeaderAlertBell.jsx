"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "./LanguageProvider";

const REFRESH_MS = 120_000;

function severityRank(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

function severityTone(severity) {
  if (severity === "high") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (severity === "medium") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-sky-400/30 bg-sky-400/10 text-sky-100";
}

export default function HeaderAlertBell() {
  const { tr } = useLanguage();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [summary, setSummary] = useState({ unread: 0, active: 0 });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const response = await fetch("/api/cloud/alerts?status=all&limit=5", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        setSignedOut(true);
        setSummary({ unread: 0, active: 0 });
        setItems([]);
        return;
      }
      const payload = await response.json();
      if (!response.ok || payload?.ok !== true) return;
      setSignedOut(false);
      setSummary({
        unread: Number(payload.summary?.unread || 0),
        active: Number(payload.summary?.active || 0)
      });
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch {
      // Header alerts are non-blocking. Keep the last known state if the request fails.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const topAlert = useMemo(() => {
    return [...items]
      .filter((item) => item && !item.dismissed_at)
      .sort((a, b) => {
        const activeDiff = Number(Boolean(b.active)) - Number(Boolean(a.active));
        if (activeDiff) return activeDiff;
        const severityDiff = severityRank(b.severity) - severityRank(a.severity);
        if (severityDiff) return severityDiff;
        return Date.parse(b.last_seen_at || 0) - Date.parse(a.last_seen_at || 0);
      })[0] || null;
  }, [items]);

  const unread = Math.max(0, Number(summary.unread || 0));
  const badge = unread > 99 ? "99+" : String(unread);
  const label = signedOut
    ? tr({ fi: "Kirjaudu nähdäksesi hälytykset", en: "Sign in to view alerts", es: "Inicia sesión para ver alertas" })
    : unread > 0
      ? tr({ fi: `${badge} lukematonta hälytystä`, en: `${badge} unread alerts`, es: `${badge} alertas no leídas` })
      : tr({ fi: "Ei lukemattomia hälytyksiä", en: "No unread alerts", es: "No hay alertas sin leer" });

  if (signedOut && !loading) {
    return (
      <Link href="/login" className="sc-icon-button relative" aria-label={label} title={label}>
        <BellIcon />
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="sc-icon-button relative"
        aria-expanded={open}
        aria-controls="scorecaster-alert-popover"
        aria-label={label}
        title={label}
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full border-2 border-[var(--sc-bg)] bg-rose-500 px-1 text-center text-[9px] font-black leading-4 text-white shadow-lg" aria-hidden="true">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div id="scorecaster-alert-popover" className="sc-menu-surface absolute right-0 top-14 z-[60] w-[min(92vw,390px)] rounded-[1.35rem] p-4 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Alert Bell V1</div>
              <div className="mt-1 text-base font-black text-[var(--sc-text)]">
                {unread > 0
                  ? tr({ fi: `${badge} lukematonta`, en: `${badge} unread`, es: `${badge} sin leer` })
                  : tr({ fi: "Ei uusia hälytyksiä", en: "No new alerts", es: "Sin alertas nuevas" })}
              </div>
              <div className="mt-1 text-xs text-[var(--sc-muted)]">
                {tr({ fi: `${summary.active || 0} aktiivista palvelinhälytystä`, en: `${summary.active || 0} active server alerts`, es: `${summary.active || 0} alertas activas del servidor` })}
              </div>
            </div>
            <button type="button" onClick={() => void load()} className="rounded-lg px-2 py-1 text-xs font-black text-[var(--sc-brand)] hover:bg-[var(--sc-brand-soft)]">
              {tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}
            </button>
          </div>

          {topAlert ? (
            <div className={`mt-4 rounded-[1.1rem] border p-4 ${severityTone(topAlert.severity)}`}>
              <div className="text-[9px] font-black uppercase tracking-[0.16em] opacity-75">
                {topAlert.alert_type || "alert"} · {topAlert.severity || "info"}
              </div>
              <div className="mt-2 font-black leading-5">{topAlert.title || tr({ fi: "Scorecaster-hälytys", en: "Scorecaster alert", es: "Alerta de Scorecaster" })}</div>
              <p className="mt-2 line-clamp-3 text-xs leading-5 opacity-90">{topAlert.message || ""}</p>
              {(topAlert.match || topAlert.selection) && (
                <div className="mt-3 text-xs font-bold opacity-80">{[topAlert.match, topAlert.selection].filter(Boolean).join(" · ")}</div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-[1.1rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-muted)]">
              {tr({ fi: "Scorecaster ei nosta ilmoitusta ilman palvelimen todentamaa muutosta.", en: "Scorecaster does not raise an alert without a server-verified change.", es: "Scorecaster no genera una alerta sin un cambio verificado por el servidor." })}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/alerts" onClick={() => setOpen(false)} className="sc-button-primary text-center">
              {tr({ fi: "Avaa Alert Inbox", en: "Open Alert Inbox", es: "Abrir Alert Inbox" })}
            </Link>
            <Link href="/watchlist" onClick={() => setOpen(false)} className="sc-button-secondary text-center">
              {tr({ fi: "Seurantalista", en: "Watchlist", es: "Seguimiento" })}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
