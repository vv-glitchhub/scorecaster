"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLanguage } from "./LanguageProvider";
import useRemoteJson from "./useRemoteJson";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(value, digits = 1) {
  const parsed = finite(value);
  return parsed === null ? "–" : `${(parsed * 100).toFixed(digits)}%`;
}

function odds(value) {
  const parsed = finite(value);
  return parsed === null ? "–" : parsed.toFixed(2);
}

function eventHref(item) {
  if (!item?.eventId && !item?.id) return "/events";
  const query = new URLSearchParams();
  if (item?.sportKey) query.set("sport", item.sportKey);
  if (item?.selection) query.set("selection", item.selection);
  const suffix = query.toString();
  return `/event/${encodeURIComponent(item.eventId || item.id)}${suffix ? `?${suffix}` : ""}`;
}

function decisionTone(decision) {
  if (decision === "PLAY") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (decision === "CAUTION") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-white/10 bg-white/[0.04] text-slate-300";
}

export default function DailyFocusV1() {
  const { tr } = useLanguage();
  const { data, loading, error } = useRemoteJson("/api/recommendations?limit=6", {
    refreshMs: 300000,
    timeoutMs: 60000
  });

  const recommendations = useMemo(
    () => (Array.isArray(data?.recommendations) ? data.recommendations : []),
    [data]
  );
  const focus = useMemo(
    () => recommendations.find((item) => item?.decision === "PLAY")
      || recommendations.find((item) => item?.decision === "CAUTION")
      || recommendations[0]
      || null,
    [recommendations]
  );

  const modelProbability = finite(focus?.independentModelProbability);
  const marketProbability = finite(focus?.marketProbability ?? focus?.consensusProbability);
  const edge = finite(focus?.edge);

  return (
    <section
      data-casterdev-visible-change="daily-focus-v1"
      aria-label={tr({ fi: "Päivän fokus", en: "Daily focus", es: "Foco del día" })}
      className="relative overflow-hidden rounded-[1.35rem] border border-sky-400/20 bg-[linear-gradient(120deg,rgba(14,165,233,.11),rgba(8,15,26,.98)_44%,rgba(16,185,129,.07))] p-3.5 shadow-[0_18px_55px_rgba(0,0,0,.22)] sm:p-4"
    >
      <div className="pointer-events-none absolute -right-10 -top-16 h-36 w-36 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-sky-300">CASTERDEV · DAILY FOCUS</span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[8px] font-black text-slate-400">PAPER ONLY</span>
            {focus ? (
              <span className={`rounded-full border px-2 py-1 text-[8px] font-black ${decisionTone(focus.decision)}`}>
                {focus.decision || "WATCH"}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-3 space-y-2">
              <div className="h-5 w-56 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-3 w-80 max-w-full animate-pulse rounded bg-white/[0.04]" />
            </div>
          ) : error ? (
            <div className="mt-3">
              <div className="text-sm font-black text-white">{tr({ fi: "Live-fokus ei latautunut", en: "Live focus is temporarily unavailable", es: "El foco en vivo no está disponible" })}</div>
              <p className="mt-1 text-[11px] text-slate-500">{tr({ fi: "Muu Scorecaster toimii edelleen. Avaa ottelut tai AI Feed jatkaaksesi analyysiä.", en: "The rest of Scorecaster remains available. Open Matches or AI Feed to continue analysis.", es: "El resto de Scorecaster sigue disponible. Abre Partidos o AI Feed para continuar." })}</p>
            </div>
          ) : focus ? (
            <div className="mt-3 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{tr({ fi: "Analyysin kärki juuri nyt", en: "Top verified analysis right now", es: "Análisis verificado destacado" })}</div>
              <div className="mt-1 truncate text-lg font-black tracking-[-0.03em] text-white sm:text-xl">{focus.match || focus.selection || "–"}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span>{focus.selection || "–"}</span>
                <span>{tr({ fi: "kerroin", en: "odds", es: "cuota" })} <strong className="text-white">{odds(focus.odds)}</strong></span>
                <span>edge <strong className="text-emerald-300">{percent(edge)}</strong></span>
                <span>{tr({ fi: "malli", en: "model", es: "modelo" })} <strong className="text-sky-300">{percent(modelProbability, 0)}</strong></span>
                <span>{tr({ fi: "markkina", en: "market", es: "mercado" })} <strong className="text-slate-200">{percent(marketProbability, 0)}</strong></span>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <div className="text-sm font-black text-white">{tr({ fi: "Ei varmennettua fokusta juuri nyt", en: "No verified focus right now", es: "No hay foco verificado ahora" })}</div>
              <p className="mt-1 text-[11px] text-slate-500">{tr({ fi: "Scorecaster ei täytä näkymää tekaistuilla nostoilla.", en: "Scorecaster does not fabricate a pick to fill the surface.", es: "Scorecaster no inventa una selección para llenar la vista." })}</p>
            </div>
          )}
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2 lg:min-w-[390px]">
          <Link href={focus ? eventHref(focus) : "/events"} className="flex min-h-11 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-400/[0.09] px-3 text-center text-[11px] font-black text-sky-100 transition hover:bg-sky-400/[0.14]">
            {tr({ fi: "Avaa analyysi", en: "Open analysis", es: "Abrir análisis" })}
          </Link>
          <Link href="/feed" className="flex min-h-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-center text-[11px] font-black text-slate-200 transition hover:bg-white/[0.06]">
            AI Feed
          </Link>
          <Link href="/tracking" className="flex min-h-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-center text-[11px] font-black text-slate-200 transition hover:bg-white/[0.06]">
            {tr({ fi: "Oma seuranta", en: "My tracking", es: "Mi seguimiento" })}
          </Link>
        </div>
      </div>
    </section>
  );
}
