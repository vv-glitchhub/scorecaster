"use client";

import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import { MetricTile, PageHero, SectionHeader } from "../components/ProductUI";

function formatNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed).toLocaleString("fi-FI") : "–";
}

export default function ValidationRunwayClient({ data }) {
  const { tr, locale } = useLanguage();
  const completeIdentity = Number(data?.upcomingEvents) > 0 && Number(data?.unmappedEvents) === 0;
  const kickoff = data?.earliestUpcomingKickoff ? new Date(data.earliestUpcomingKickoff) : null;
  const kickoffText = kickoff && !Number.isNaN(kickoff.getTime())
    ? kickoff.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
    : "–";

  return (
    <div className="space-y-7" data-validation-runway-v1="true">
      <PageHero
        eyebrow={`Validation Runway V1 · ${data?.ok ? completeIdentity ? "IDENTITY READY" : "EVIDENCE PREP" : "CHECK REQUIRED"}`}
        tone={completeIdentity ? "emerald" : "sky"}
        title={tr({
          fi: "Seuraava oikea mallinäyttö rakennetaan ennen kickoffia",
          en: "The next real model evidence is built before kickoff",
          es: "La próxima evidencia real se construye antes del inicio"
        })}
        description={tr({
          fi: "Näkymä mittaa vain aidosti ennen ottelua tallennetut owned-football eventit ja niiden canonical-ID-kattavuuden. Puuttuvaa historiaa ei täytetä jälkikäteen eikä mallia ylennetä automaattisesti.",
          en: "This view measures only genuinely pregame owned-football events and their canonical identity coverage. Missing history is never backfilled after the fact and no model is promoted automatically.",
          es: "Esta vista mide solo eventos guardados antes del partido y su cobertura de identidad canónica. No se rellena historial faltante ni se promocionan modelos automáticamente."
        })}
        actions={<>
          <Link href="/acceptance-validation" className="sc-button-secondary">Acceptance & Validation</Link>
          <Link href="/model-lab#validation-lab" className="sc-button-ghost">Validation Lab</Link>
        </>}
        aside={<div className="grid grid-cols-2 gap-2">
          <MetricTile compact label={tr({ fi: "ID-kattavuus", en: "ID coverage", es: "Cobertura ID" })} value={completeIdentity ? "READY" : "CHECK"} tone={completeIdentity ? "green" : "yellow"} />
          <MetricTile compact label={tr({ fi: "Synteettinen backfill", en: "Synthetic backfill", es: "Backfill sintético" })} value="OFF" tone="green" />
        </div>}
      />

      {!data?.ok && (
        <div role="status" className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          {tr({ fi: "Validointi-ikkunan aggregaattia ei saatu nyt varmennettua.", en: "The validation-window aggregate could not be verified right now.", es: "No se pudo verificar ahora el agregado de validación." })}
        </div>
      )}

      <section>
        <SectionHeader
          eyebrow={tr({ fi: "Seuraava validointi-ikkuna", en: "Next validation window", es: "Próxima ventana de validación" })}
          title={tr({ fi: "Onko seuraava pregame-otos valmis myöhempään settlementiin?", en: "Is the next pregame sample ready for later settlement?", es: "¿Está lista la próxima muestra prepartido para liquidación?" })}
          description={tr({
            fi: "Verified canonical mapping sitoo provider-eventin myöhempään vahvistettuun lopputulokseen. Se on edellytys chronology-safe learning-esimerkille ilman tulosvuotoa.",
            en: "Verified canonical mapping binds the provider event to the later verified result. It is required for a chronology-safe learning example without outcome leakage.",
            es: "El mapeo canónico verificado une el evento con el resultado posterior y permite aprendizaje sin fuga del resultado."
          })}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricTile label={tr({ fi: "Tulevat owned-eventit", en: "Upcoming owned events", es: "Eventos próximos" })} value={formatNumber(data?.upcomingEvents)} tone="blue" />
          <MetricTile label={tr({ fi: "Verified canonical-ID", en: "Verified canonical IDs", es: "ID canónicos verificados" })} value={formatNumber(data?.verifiedIdentityMappings)} tone={completeIdentity ? "green" : "yellow"} />
          <MetricTile label={tr({ fi: "Unmapped", en: "Unmapped", es: "Sin mapear" })} value={formatNumber(data?.unmappedEvents)} tone={Number(data?.unmappedEvents) === 0 ? "green" : "yellow"} />
          <MetricTile label={tr({ fi: "Aloitetut chronology-safe", en: "Started chronology-safe", es: "Iniciados chronology-safe" })} value={formatNumber(data?.chronologySafeStartedEvents)} tone="blue" />
          <MetricTile label={tr({ fi: "Aikaisin kickoff", en: "Earliest kickoff", es: "Inicio más próximo" })} value={kickoffText} tone="purple" />
        </div>
      </section>

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <SectionHeader
          eyebrow="Evidence contract"
          title={tr({ fi: "Mitä Scorecaster ei saa oikaista", en: "What Scorecaster is not allowed to shortcut", es: "Lo que Scorecaster no puede eludir" })}
        />
        <div className="grid gap-3 text-sm leading-6 text-[var(--sc-text-secondary)] md:grid-cols-2 xl:grid-cols-4">
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
