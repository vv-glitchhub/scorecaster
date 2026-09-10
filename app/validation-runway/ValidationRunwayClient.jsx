"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { MetricTile, PageHero, SectionHeader } from "../components/ProductUI";

function formatNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed).toLocaleString("fi-FI") : "–";
}

export default function ValidationRunwayClient() {
  const { tr, locale } = useLanguage();
  const [state, setState] = useState({ loading: true, error: "", data: null });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch("/api/validation-runway", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Validation runway unavailable");
      setState({ loading: false, error: "", data: payload });
    } catch (error) {
      setState({ loading: false, data: null, error: error instanceof Error ? error.message : "Validation runway unavailable" });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const data = state.data;
  const checking = state.loading && !data;
  const completeIdentity = Number(data?.upcomingEvents) > 0 && Number(data?.unmappedEvents) === 0;
  const kickoff = data?.earliestUpcomingKickoff ? new Date(data.earliestUpcomingKickoff) : null;
  const kickoffText = kickoff && !Number.isNaN(kickoff.getTime())
    ? kickoff.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
    : "–";

  return (
    <div className="space-y-7" data-validation-runway-v1="true">
      <PageHero
        eyebrow={`Validation Runway V1 · ${checking ? "CHECKING" : completeIdentity ? "IDENTITY READY" : "EVIDENCE PREP"}`}
        tone={completeIdentity ? "emerald" : "sky"}
        title={tr({
          fi: "Valmistellaan seuraava oikea mallinäyttö ennen kickoffia",
          en: "Prepare the next real model evidence before kickoff",
          es: "Preparar la próxima evidencia real antes del inicio"
        })}
        description={tr({
          fi: "Tämä näkymä ei luo historiallista dataa jälkikäteen. Se mittaa vain aidosti ennen ottelua tallennetut owned-football eventit, canonical-ID-kattavuuden ja hetken, jolloin ensimmäinen uusi settlement voi muuttua chronology-safe learning-aineistoksi.",
          en: "This view never manufactures historical data after the fact. It only measures genuinely pregame owned-football events, canonical identity coverage and when the next settlement can become chronology-safe learning evidence.",
          es: "Esta vista no fabrica datos históricos. Solo mide eventos guardados antes del partido, cobertura de identidad canónica y cuándo un resultado puede convertirse en evidencia cronológica."
        })}
        actions={<>
          <button type="button" onClick={() => void load()} disabled={state.loading} className="sc-button-primary disabled:opacity-50">
            {state.loading ? tr({ fi: "Tarkistetaan…", en: "Checking…", es: "Comprobando…" }) : tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}
          </button>
          <Link href="/acceptance-validation" className="sc-button-secondary">Acceptance & Validation</Link>
          <Link href="/model-lab#validation-lab" className="sc-button-ghost">Validation Lab</Link>
        </>}
        aside={<div className="grid grid-cols-2 gap-2">
          <MetricTile compact label={tr({ fi: "ID-kattavuus", en: "ID coverage", es: "Cobertura ID" })} value={checking ? "…" : completeIdentity ? "READY" : "CHECK"} tone={completeIdentity ? "green" : "yellow"} />
          <MetricTile compact label={tr({ fi: "Synteettinen backfill", en: "Synthetic backfill", es: "Backfill sintético" })} value="OFF" tone="green" />
        </div>}
      />

      {state.error && <div role="status" className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{state.error}</div>}

      <section>
        <SectionHeader
          eyebrow={tr({ fi: "Seuraava validointi-ikkuna", en: "Next validation window", es: "Próxima ventana de validación" })}
          title={tr({ fi: "Onko seuraava pregame-otos valmis settlementiin?", en: "Is the next pregame sample ready for settlement?", es: "¿Está lista la próxima muestra prepartido?" })}
          description={tr({
            fi: "Canonical mapping pitää provider-eventin ja myöhemmän vahvistetun lopputuloksen samana tapahtumana. Tämä on edellytys sille, että learning-esimerkki voidaan rakentaa ilman tulosvuotoa.",
            en: "Canonical mapping keeps the provider event and later verified result attached to the same event. That is required before a learning example can be built without outcome leakage.",
            es: "El mapeo canónico mantiene unido el evento del proveedor con el resultado verificado posterior y evita fuga de resultados."
          })}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricTile label={tr({ fi: "Tulevat owned-eventit", en: "Upcoming owned events", es: "Eventos próximos" })} value={checking ? "–" : formatNumber(data?.upcomingEvents)} tone="blue" />
          <MetricTile label={tr({ fi: "Verified canonical-ID", en: "Verified canonical IDs", es: "ID canónicos verificados" })} value={checking ? "–" : formatNumber(data?.verifiedIdentityMappings)} tone={completeIdentity ? "green" : "yellow"} />
          <MetricTile label={tr({ fi: "Unmapped", en: "Unmapped", es: "Sin mapear" })} value={checking ? "–" : formatNumber(data?.unmappedEvents)} tone={Number(data?.unmappedEvents) === 0 ? "green" : "yellow"} />
          <MetricTile label={tr({ fi: "Aloitetut chronology-safe", en: "Started chronology-safe", es: "Iniciados chronology-safe" })} value={checking ? "–" : formatNumber(data?.chronologySafeStartedEvents)} tone="blue" />
          <MetricTile label={tr({ fi: "Aikaisin kickoff", en: "Earliest kickoff", es: "Inicio más próximo" })} value={checking ? "–" : kickoffText} tone="purple" />
        </div>
      </section>

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <SectionHeader
          eyebrow={tr({ fi: "Evidence contract", en: "Evidence contract", es: "Contrato de evidencia" })}
          title={tr({ fi: "Mitä Scorecaster ei saa oikaista", en: "What Scorecaster is not allowed to shortcut", es: "Lo que Scorecaster no puede eludir" })}
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm leading-6 text-[var(--sc-text-secondary)]">
          <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><strong className="text-[var(--sc-text)]">Pregame only.</strong> {tr({ fi: "Snapshotin pitää olla tallennettu ennen kickoffia.", en: "The snapshot must exist before kickoff.", es: "La captura debe existir antes del inicio." })}</div>
          <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><strong className="text-[var(--sc-text)]">Verified outcome.</strong> {tr({ fi: "Learning syntyy vasta vahvistetusta lopputuloksesta.", en: "Learning appears only after a verified final result.", es: "Learning aparece solo tras un resultado final verificado." })}</div>
          <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><strong className="text-[var(--sc-text)]">No synthetic backfill.</strong> {tr({ fi: "Puuttuvaa pregame-dataa ei luoda jälkikäteen.", en: "Missing pregame data is never recreated after the fact.", es: "Los datos prepartido faltantes nunca se recrean después." })}</div>
          <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><strong className="text-[var(--sc-text)]">Manual promotion.</strong> {tr({ fi: "Mallia ei ylennetä automaattisesti tuotantoon.", en: "A model is never promoted automatically to production.", es: "Un modelo nunca se promociona automáticamente a producción." })}</div>
        </div>
      </section>

      <div className="text-xs text-[var(--sc-faint)]">
        {data?.asOf ? `${tr({ fi: "Runway tarkistettu", en: "Runway checked", es: "Runway comprobado" })}: ${new Date(data.asOf).toLocaleString(locale)}` : ""}
      </div>
    </div>
  );
}