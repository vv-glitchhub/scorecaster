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

function formatReason(value) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[_\s]+/g, " ").trim();
  if (!normalized) return null;
  const readable = `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
  return /[.!?]$/.test(readable) ? readable : `${readable}.`;
}

function evidenceSummary(focus, tr) {
  if (!focus) return null;
  const reasons = Array.isArray(focus.decisionReasons) ? focus.decisionReasons.filter(Boolean) : [];
  const bookmakerCount = finite(focus.bookmakerCount);
  const confidence = finite(focus.confidence);
  const modelProbability = finite(focus.independentModelProbability);
  const marketProbability = finite(focus.marketProbability ?? focus.consensusProbability);

  const reason = reasons.map(formatReason).find(Boolean);
  if (reason) return reason;
  if (bookmakerCount !== null && bookmakerCount < 4) {
    return tr({ fi: `${bookmakerCount} vedonvälittäjän markkina — seuraa varauksella`, en: `Market from ${bookmakerCount} bookmakers — watch with caution`, es: `Mercado de ${bookmakerCount} operadores — seguir con cautela` });
  }
  if (modelProbability !== null && marketProbability !== null) {
    return tr({ fi: "Malli ja markkina on vertailtu", en: "Model and market probabilities have been compared", es: "Se compararon las probabilidades del modelo y del mercado" });
  }
  if (confidence !== null) {
    return tr({ fi: `Luottamus ${percent(confidence, 0)} — tarkista ottelun tiedot`, en: `${percent(confidence, 0)} confidence — check the match details`, es: `Confianza ${percent(confidence, 0)} — revisa los detalles del partido` });
  }
  return tr({ fi: "Perustiedot ovat rajalliset — tarkista ottelun analyysi", en: "Evidence is limited — check the match analysis", es: "La evidencia es limitada — revisa el análisis del partido" });
}

function formatUpdatedAt(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function freshnessLabel(value, tr) {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim().toLowerCase();
  const labels = {
    fresh: tr({ fi: "tuore", en: "fresh", es: "reciente" }),
    live: tr({ fi: "reaaliaikainen", en: "live", es: "en vivo" }),
    healthy: tr({ fi: "kunnossa", en: "healthy", es: "saludable" }),
    recent: tr({ fi: "äskettäinen", en: "recent", es: "reciente" }),
    aging: tr({ fi: "vanhenemassa", en: "aging", es: "envejeciendo" }),
    stale: tr({ fi: "vanhentunut", en: "stale", es: "desactualizado" }),
    outdated: tr({ fi: "vanhentunut", en: "outdated", es: "desactualizado" }),
    degraded: tr({ fi: "heikentynyt", en: "degraded", es: "degradado" }),
    unknown: tr({ fi: "tuntematon", en: "unknown", es: "desconocido" })
  };
  return labels[normalized] || value.trim();
}

function freshnessTone(value) {
  if (typeof value !== "string") return undefined;
  return /stale|outdated|degraded|unknown|vanhentunut|heikentynyt|tuntematon|desactualizado|desconocido|degradado/i.test(value)
    ? "warning"
    : undefined;
}

function evidenceMetadata(focus, feed, tr) {
  if (!focus) return [];
  const metadata = [];
  const bookmakerCount = finite(focus.bookmakerCount);
  const freshness = freshnessLabel(focus.freshnessLabel || focus.dataQuality?.freshness, tr);
  const updatedAt = formatUpdatedAt(focus.lastUpdate || feed?.upstreamGeneratedAt);
  const source = focus.fixtureSource || feed?.fixtureSource;

  if (bookmakerCount !== null) {
    metadata.push(tr({
      fi: `${bookmakerCount} vedonvälittäjää`,
      en: `${bookmakerCount} bookmakers`,
      es: `${bookmakerCount} operadores`
    }));
  }
  if (freshness) {
    metadata.push({ label: tr({
      fi: `Tuoreus: ${freshness}`,
      en: `Freshness: ${freshness}`,
      es: `Frescura: ${freshness}`
    }), tone: freshnessTone(focus.freshnessLabel || focus.dataQuality?.freshness) });
  }
  if (source) {
    metadata.push(tr({
      fi: `Lähde: ${source}`,
      en: `Source: ${source}`,
      es: `Fuente: ${source}`
    }));
  }
  if (updatedAt) {
    metadata.push(tr({
      fi: `Päivitetty ${updatedAt}`,
      en: `Updated ${updatedAt}`,
      es: `Actualizado ${updatedAt}`
    }));
  }
  if (feed?.partialUpstream === true) {
    metadata.push({
      label: tr({
        fi: "Osa markkinoista puuttuu",
        en: "Some markets are unavailable",
        es: "Faltan algunos mercados"
      }),
      tone: "warning"
    });
  }
  return metadata;
}

function evidenceAction(focus, feed, tr) {
  if (!focus) return null;
  const freshness = String(focus.freshnessLabel || focus.dataQuality?.freshness || "").toLowerCase();
  if (feed?.partialUpstream === true || /stale|outdated|degraded|unknown/.test(freshness)) {
    return tr({
      fi: "Tarkista otteluanalyysi ennen paperivalinnan kirjaamista — tietopohja voi olla vanhentunut tai osittainen.",
      en: "Check the match analysis before recording a paper pick — the data may be stale or partial.",
      es: "Revisa el análisis antes de registrar una selección simulada: los datos pueden estar desactualizados o incompletos."
    });
  }
  if (finite(focus.independentModelProbability) === null) {
    return tr({
      fi: "Seuraa kohdetta varauksella — riippumattoman mallin todennäköisyys puuttuu.",
      en: "Watch with caution — independent model probability is unavailable.",
      es: "Sigue con cautela: falta la probabilidad del modelo independiente."
    });
  }
  if (focus.decision === "CAUTION") {
    return tr({
      fi: "Tarkista puuttuva näyttö ennen paperivalinnan kirjaamista.",
      en: "Review the missing evidence before recording a paper pick.",
      es: "Revisa la evidencia faltante antes de registrar una selección simulada."
    });
  }
  if (focus.decision === "PLAY") {
    return tr({
      fi: "Nykyiset tarkistukset ovat läpäisty — lue otteluanalyysi ennen paperivalinnan kirjaamista.",
      en: "Current checks passed — review the match analysis before recording a paper pick.",
      es: "Las comprobaciones actuales se aprobaron: revisa el análisis antes de registrar una selección simulada."
    });
  }
  return tr({
    fi: "Tarkista otteluanalyysi ennen päätöstä.",
    en: "Review the match analysis before deciding.",
    es: "Revisa el análisis del partido antes de decidir."
  });
}

export default function DailyFocusV1() {
  const { tr } = useLanguage();
  const { data, loading, error } = useRemoteJson("/api/recommendations?limit=20", {
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
  const metadata = evidenceMetadata(focus, data, tr);
  const action = evidenceAction(focus, data, tr);

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
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{tr({ fi: "Analyysin kärki juuri nyt", en: "Top signal right now", es: "Señal destacada ahora" })}</div>
              <div className="mt-1 truncate text-lg font-black tracking-[-0.03em] text-white sm:text-xl">{focus.match || focus.selection || "–"}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span>{focus.selection || "–"}</span>
                <span>{tr({ fi: "kerroin", en: "odds", es: "cuota" })} <strong className="text-white">{odds(focus.odds)}</strong></span>
                <span>edge <strong className="text-emerald-300">{percent(edge)}</strong></span>
                <span>{tr({ fi: "malli", en: "model", es: "modelo" })} <strong className="text-sky-300">{percent(modelProbability, 0)}</strong></span>
                <span>{tr({ fi: "markkina", en: "market", es: "mercado" })} <strong className="text-slate-200">{percent(marketProbability, 0)}</strong></span>
              </div>
              <p className="mt-2 max-w-2xl text-[11px] leading-5 text-slate-300">
                <span className="font-black text-sky-200">{tr({ fi: "Miksi tämä näkyy: ", en: "Why this is here: ", es: "Por qué aparece: " })}</span>
                {evidenceSummary(focus, tr)}
              </p>
              {metadata.length ? (
                <div className="mt-2 flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500" aria-label={tr({ fi: "Todisteiden konteksti", en: "Evidence context", es: "Contexto de evidencia" })}>
                  <span className="font-black uppercase tracking-[0.12em] text-slate-400">{tr({ fi: "Tietopohja", en: "Data context", es: "Contexto de datos" })}</span>
                  {metadata.map((item, index) => (
                    <span key={`${item.label}-${index}`} className={item.tone === "warning" ? "text-amber-300" : undefined}>
                      {item.label}
                    </span>
                  ))}
                </div>
              ) : null}
              {action ? (
                <p className="mt-2 max-w-3xl rounded-lg border border-sky-400/15 bg-sky-400/[0.05] px-2.5 py-2 text-[10px] leading-4 text-sky-100" aria-label={tr({ fi: "Toimintaohje", en: "Decision guidance", es: "Guía para decidir" })}>
                  <span className="font-black uppercase tracking-[0.12em] text-sky-300">{tr({ fi: "Seuraava askel", en: "Next step", es: "Siguiente paso" })}: </span>{action}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3">
              <div className="text-sm font-black text-white">{tr({ fi: "Ei kelpuutettua fokusta juuri nyt", en: "No qualifying focus right now", es: "No hay un foco que cumpla ahora" })}</div>
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
