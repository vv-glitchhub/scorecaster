"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import Panel from "../components/Panel";
import {
  FOOTBALL_MARKET_TAXONOMY_VERSION,
  getFootballMarketReferenceTargets
} from "../../lib/football-market-taxonomy-v2.mjs";
import { acquisitionForTarget, buildProviderAcquisitionPlan } from "../../lib/provider-acquisition-v1.mjs";

const GROUP_ORDER = ["featured", "goals", "result", "periods", "corners_cards", "players", "combinations", "timing"];
const GROUP_LABELS = {
  featured: { fi: "Perusmarkkinat", en: "Core markets", es: "Mercados principales" },
  goals: { fi: "Maalit", en: "Goals", es: "Goles" },
  result: { fi: "Tulos", en: "Result", es: "Resultado" },
  periods: { fi: "Puoliajat", en: "Halves", es: "Mitades" },
  corners_cards: { fi: "Kulmat ja kortit", en: "Corners & cards", es: "Córners y tarjetas" },
  players: { fi: "Pelaajat", en: "Players", es: "Jugadores" },
  combinations: { fi: "Yhdistelmät", en: "Combinations", es: "Combinaciones" },
  timing: { fi: "Maalin ajoitus", en: "Goal timing", es: "Tiempo del gol" }
};

function staticStatus(target) {
  if (!target.providerKeys.length) return "provider-gap";
  if (target.coverage === "partial") return "partial";
  return "provider-capable";
}

function statusText(status, tr) {
  if (status === "provider-gap") return tr({ fi: "Provider puuttuu", en: "Provider gap", es: "Falta proveedor" });
  if (status === "partial") return tr({ fi: "Osittainen vastaavuus", en: "Partial mapping", es: "Cobertura parcial" });
  return tr({ fi: "Provider-valmis", en: "Provider capable", es: "Proveedor compatible" });
}

function statusClass(status) {
  if (status === "provider-gap") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  if (status === "partial") return "border-sky-400/25 bg-sky-400/10 text-sky-100";
  return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
}

export default function FootballMarketReferencePanel() {
  const { tr } = useLanguage();
  const [openGroups, setOpenGroups] = useState(() => new Set(["featured", "goals", "combinations"]));
  const targets = useMemo(() => getFootballMarketReferenceTargets(), []);
  const providerCapable = targets.filter((target) => target.providerKeys.length > 0).length;
  const providerGaps = targets.length - providerCapable;
  const acquisition = useMemo(() => buildProviderAcquisitionPlan(targets), [targets]);

  function toggle(group) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  return (
    <Panel
      title={tr({ fi: "Jalkapallon koko markkinakartta", en: "Complete football market map", es: "Mapa completo de mercados de fútbol" })}
      subtitle={tr({
        fi: "Rakennettu antamiesi Veikkaus-näkymien markkinarakenteen pohjalta. Tämä on tuotetaksonomia, ei Veikkauksen datasyöte: Scorecaster käyttää kertoimia vain lähteistä, joihin käyttöoikeus on varmistettu.",
        en: "Built from the market structure in your Veikkaus reference screens. This is a product taxonomy, not a Veikkaus data feed: Scorecaster only uses odds from sources with verified rights.",
        es: "Taxonomía basada en las pantallas de referencia. No es un feed de Veikkaus; Scorecaster usa cuotas solo de fuentes autorizadas."
      })}
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">{tr({ fi: "Tavoitemarkkinat", en: "Target markets", es: "Mercados objetivo" })}</div>
          <div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{targets.length}</div>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/8 p-4">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-emerald-200">{tr({ fi: "Provider-valmiit", en: "Provider capable", es: "Con proveedor" })}</div>
          <div className="mt-2 text-2xl font-black text-emerald-100">{providerCapable}</div>
        </div>
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/8 p-4">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-amber-200">{tr({ fi: "Provider-gap", en: "Provider gaps", es: "Faltan proveedores" })}</div>
          <div className="mt-2 text-2xl font-black text-amber-100">{providerGaps}</div>
        </div>
      </div>

      <div className="space-y-3" data-football-market-taxonomy={FOOTBALL_MARKET_TAXONOMY_VERSION}>
        {GROUP_ORDER.map((group) => {
          const rows = targets.filter((target) => target.group === group);
          if (!rows.length) return null;
          const open = openGroups.has(group);
          return (
            <div key={group} className="overflow-hidden rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]">
              <button type="button" onClick={() => toggle(group)} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left">
                <div>
                  <div className="font-black text-[var(--sc-text)]">{tr(GROUP_LABELS[group])}</div>
                  <div className="mt-1 text-xs text-[var(--sc-muted)]">{rows.length} {tr({ fi: "markkinaa", en: "markets", es: "mercados" })}</div>
                </div>
                <span className="text-lg font-black text-[var(--sc-text-secondary)]">{open ? "−" : "+"}</span>
              </button>
              {open && <div className="grid gap-2 border-t border-[var(--sc-border)] p-3 md:grid-cols-2">
                {rows.map((target) => {
                  const status = staticStatus(target);
                  const procurement = acquisitionForTarget(target.key);
                  return (
                    <div key={target.key} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-[var(--sc-text)]">{tr({ fi: target.fi, en: target.en, es: target.en })}</div>
                          {target.providerKeys.length > 0 && <div className="mt-1 break-words text-[11px] text-[var(--sc-muted)]">{target.providerKeys.join(" · ")}</div>}
                          {!target.providerKeys.length && procurement ? <div className="mt-1 text-[11px] text-amber-200">P{procurement.priority} · {procurement.label}</div> : null}
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${statusClass(status)}`}>{statusText(status, tr)}</span>
                      </div>
                      {target.note && <div className="mt-2 text-xs leading-5 text-[var(--sc-muted)]">{target.note}</div>}
                    </div>
                  );
                })}
              </div>}
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4" data-provider-acquisition-plan={acquisition.version}>
        <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">Provider acquisition plan</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">{acquisition.bundles.map((bundle) => <div key={bundle.key} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-[var(--sc-text)]">{bundle.label}</strong><span className="text-xs font-black text-amber-200">P{bundle.priority}</span></div><div className="mt-1 text-xs text-[var(--sc-muted)]">{bundle.targets.length} markets · written rights required</div></div>)}</div>
      </div>

      <div className="mt-5 rounded-xl border border-sky-400/20 bg-sky-400/8 p-4 text-xs leading-6 text-sky-100">
        {tr({
          fi: "Provider-valmis ei tarkoita, että kerroin olisi juuri nyt tarjolla valitulle ottelulle. Ottelukohtainen Market Universe erottaa tämän vielä erikseen: available / not-offered. Provider-gap tarkoittaa, että tarvitsemme uuden lisensoidun lähteen ennen kuin Scorecaster saa näyttää oikeita hintoja.",
          en: "Provider capable does not mean the price is currently offered for a selected event. Event-level Market Universe distinguishes available from not-offered. Provider gap means a new licensed source is required before Scorecaster may show real prices.",
          es: "La compatibilidad del proveedor no garantiza que el mercado esté disponible en un partido concreto."
        })}
      </div>
    </Panel>
  );
}
