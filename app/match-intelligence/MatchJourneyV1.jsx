"use client";

import Link from "next/link";
import { DecisionBadge, MatchIdentity, MetricTile } from "../components/ProductUI";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(value) {
  const parsed = finite(value);
  return parsed === null ? "—" : `${(parsed * 100).toFixed(1)}%`;
}

function decimal(value) {
  const parsed = finite(value);
  return parsed === null ? "—" : parsed.toFixed(2);
}

function normalizedDecision(value) {
  const decision = String(value || "CAUTION").toUpperCase();
  if (decision === "BET") return "PLAY";
  if (decision === "PASS") return "SKIP";
  return ["PLAY", "CAUTION", "SKIP"].includes(decision) ? decision : "CAUTION";
}

function Step({ number, label, detail, state = "complete" }) {
  const tone = state === "locked"
    ? "border-[var(--sc-border)] bg-[var(--sc-surface)] text-[var(--sc-faint)]"
    : state === "warning"
      ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
      : "border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] text-[var(--sc-brand)]";
  return (
    <li className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
      <span className={`relative z-10 grid h-10 w-10 place-items-center rounded-full border text-sm font-black ${tone}`}>{number}</span>
      <div className="pt-1">
        <div className="font-black text-[var(--sc-text)]">{label}</div>
        <div className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">{detail}</div>
      </div>
    </li>
  );
}

export default function MatchJourneyV1({ detail, sport, tr, locale }) {
  const selections = Array.isArray(detail?.selections) ? detail.selections : [];
  const primary = selections.find((item) => item.selection === detail?.selectedSelection) || selections[0] || null;
  const alternatives = primary ? selections.filter((item) => item.id !== primary.id).slice(0, 3) : [];
  const intelligence = detail?.sportsIntelligence || {};
  const features = detail?.featureEngine || {};
  const ensemble = detail?.ensembleEngine || {};
  const verifiedCount = finite(intelligence.readiness?.verifiedCount);
  const totalChecks = finite(intelligence.readiness?.totalChecks);
  const eligibleCount = finite(features.counts?.eligible);
  const totalFeatures = finite(features.counts?.total);
  const evidenceMissing = intelligence.evidenceState === "missing" || features.evidenceState === "missing";
  const eventSport = detail?.sportKey || sport;
  const eventHref = primary
    ? `/event/${encodeURIComponent(detail.eventId)}?sport=${encodeURIComponent(eventSport)}&selection=${encodeURIComponent(primary.selection)}`
    : `/event/${encodeURIComponent(detail.eventId)}?sport=${encodeURIComponent(eventSport)}`;
  const decision = primary ? normalizedDecision(primary.decision) : null;
  const kickoff = detail?.commenceTime
    ? new Date(detail.commenceTime).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : tr({ fi: "alkamisaika puuttuu", en: "kickoff unavailable", es: "hora no disponible" });

  return (
    <section className="sc-surface relative overflow-hidden rounded-[2rem] p-5 sm:p-7" data-match-journey-v1="true">
      <div className="pointer-events-none absolute -left-20 top-16 h-64 w-64 rounded-full bg-[var(--sc-brand-soft)] blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Match Journey V1</div>
          <h2 className="mt-2 max-w-3xl text-2xl font-black tracking-[-0.04em] text-[var(--sc-text)] sm:text-3xl">
            {tr({ fi: "Tilanteesta varmennettuun päätökseen", en: "From match context to a verified decision", es: "Del contexto a una decisión verificada" })}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">
            {tr({
              fi: "Sama palvelimen analyysi kulkee neljän vaiheen läpi. Näkymä järjestää evidenssin, mutta ei muuta sen arvoja tai tuotepäätöstä.",
              en: "The same server analysis moves through four stages. This view organizes evidence without changing its values or product decision.",
              es: "El mismo análisis pasa por cuatro etapas. La vista organiza la evidencia sin cambiar valores ni la decisión."
            })}
          </p>
        </div>
        <Link href="/tracking" className="sc-button-secondary shrink-0" data-match-story-link="true">
          {tr({ fi: "Avaa Match Storyt", en: "Open Match Stories", es: "Abrir Match Stories" })}
        </Link>
      </div>

      <div className="relative mt-7 grid gap-6 xl:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.28fr)]">
        <div className="rounded-[1.5rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
          <MatchIdentity
            homeTeam={detail.homeTeam}
            awayTeam={detail.awayTeam}
            meta={`${kickoff} · ${detail.fixtureSource || "verified pipeline"}`}
          />
          <ol className="relative mt-6 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-px before:bg-[var(--sc-border)]">
            <Step
              number="1"
              label={tr({ fi: "Tilanne varmennetaan", en: "Verify the match context", es: "Verificar el contexto" })}
              detail={detail.fixtureVerifiedByProvider
                ? tr({ fi: "Tapahtuma on varmennettu providerilta.", en: "The fixture is verified by the provider.", es: "El evento está verificado por el proveedor." })
                : tr({ fi: "Provider-varmennus ei ole vahvistettu.", en: "Provider verification is not confirmed.", es: "La verificación del proveedor no está confirmada." })}
              state={detail.fixtureVerifiedByProvider ? "complete" : "warning"}
            />
            <Step
              number="2"
              label={tr({ fi: "Evidenssi kartoitetaan", en: "Map the evidence", es: "Mapear la evidencia" })}
              detail={evidenceMissing
                ? tr({ fi: "Osa evidenssipayloadista puuttuu; puuttuva pysyy puuttuvana.", en: "Part of the evidence payload is missing; missing stays missing.", es: "Falta parte de la evidencia; lo ausente sigue ausente." })
                : `${verifiedCount ?? "—"}/${totalChecks ?? "—"} ${tr({ fi: "tarkistusta", en: "checks", es: "comprobaciones" })} · ${eligibleCount ?? "—"}/${totalFeatures ?? "—"} features`}
              state={evidenceMissing ? "warning" : "complete"}
            />
            <Step
              number="3"
              label={tr({ fi: "Päätös lukitaan", en: "Lock the decision", es: "Fijar la decisión" })}
              detail={primary
                ? `${primary.selection} · ${decision} · ${tr({ fi: "palvelimen nykytila", en: "current server state", es: "estado actual del servidor" })}`
                : tr({ fi: "Julkaistavaa valintaa ei ole.", en: "No publishable selection is available.", es: "No hay selección publicable." })}
              state={primary ? "complete" : "warning"}
            />
            <Step
              number="4"
              label="Match Story"
              detail={tr({ fi: "Ratkaistu paperitulos + closing-hinta avaavat jälkiarvion.", en: "A settled paper result plus closing price unlocks the review.", es: "Resultado resuelto y cuota de cierre abren la revisión." })}
              state="locked"
            />
          </ol>
        </div>

        <div className="space-y-4" id="journey-decision">
          <article className="rounded-[1.65rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-5 sm:p-6" data-journey-primary-decision="true">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{tr({ fi: "Pääpäätös", en: "Primary decision", es: "Decisión principal" })}</div>
                <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[var(--sc-text)]">{primary?.selection || "—"}</h3>
                <div className="mt-1 text-sm font-bold text-[var(--sc-muted)]">{primary?.bookmaker || tr({ fi: "Varmennettu hintalähde puuttuu", en: "Verified price source unavailable", es: "Falta fuente de precio verificada" })}</div>
              </div>
              {decision ? <DecisionBadge decision={decision} /> : <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100">UNAVAILABLE</span>}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricTile compact label={tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })} value={decimal(primary?.odds)} tone="blue" />
              <MetricTile compact label="Edge" value={percent(primary?.edge)} tone={finite(primary?.edge) > 0 ? "green" : "default"} />
              <MetricTile compact label="EV" value={percent(primary?.ev)} tone={finite(primary?.ev) > 0 ? "green" : "default"} />
              <MetricTile compact label={tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" })} value={percent(primary?.confidence)} tone="purple" />
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--sc-text-secondary)]">
              {primary?.decisionReason || tr({ fi: "Palvelin ei julkaissut erillistä päätösperustelua.", en: "The server did not publish a separate decision reason.", es: "El servidor no publicó una razón separada." })}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href={eventHref} className="sc-button-primary">{primary ? tr({ fi: "Avaa päätöslippu", en: "Open decision ticket", es: "Abrir ticket de decisión" }) : tr({ fi: "Avaa event-audit", en: "Open event audit", es: "Abrir auditoría" })}</Link>
              {primary ? <Link href={`/decision-evidence?eventId=${encodeURIComponent(detail.eventId)}&sport=${encodeURIComponent(eventSport)}&selection=${encodeURIComponent(primary.selection)}`} className="sc-button-secondary">Decision Evidence</Link> : null}
            </div>
          </article>

          <section className="rounded-[1.5rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5" data-journey-alternatives="true">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--sc-faint)]">{tr({ fi: "Vaihtoehdot", en: "Alternatives", es: "Alternativas" })}</div>
                <h3 className="mt-1 font-black text-[var(--sc-text)]">{tr({ fi: "Sama evidenssi, muut valinnat", en: "Same evidence, other selections", es: "Misma evidencia, otras selecciones" })}</h3>
              </div>
              <span className="text-xs text-[var(--sc-muted)]">{alternatives.length}</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {alternatives.map((item) => (
                <Link
                  key={item.id}
                  href={`/event/${encodeURIComponent(detail.eventId)}?sport=${encodeURIComponent(eventSport)}&selection=${encodeURIComponent(item.selection)}`}
                  className="rounded-[1.15rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 transition hover:border-[var(--sc-border-strong)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="font-black text-[var(--sc-text)]">{item.selection}</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">{decimal(item.odds)}</div></div>
                    <DecisionBadge decision={normalizedDecision(item.decision)} />
                  </div>
                  <div className="mt-3 text-xs text-[var(--sc-muted)]">Edge {percent(item.edge)} · EV {percent(item.ev)}</div>
                </Link>
              ))}
              {alternatives.length === 0 ? <div className="sm:col-span-2 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Muita julkaistavia valintoja ei ole.", en: "No other publishable selections are available.", es: "No hay otras selecciones publicables." })}</div> : null}
            </div>
          </section>
        </div>
      </div>

      <div className="relative mt-6 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100" data-match-journey-boundary="true">
        {tr({
          fi: "Match Journey on read-only-esityskerros. Se ei keksi puuttuvaa dataa, järjestä palvelimen valintoja uudelleen, muuta todennäköisyyksiä tai aseta oikean rahan vetoa.",
          en: "Match Journey is a read-only presentation layer. It does not invent missing data, reorder server selections, change probabilities or place a real-money bet.",
          es: "Match Journey es una capa de solo lectura. No inventa datos, reordena selecciones, cambia probabilidades ni apuesta dinero real."
        })}
      </div>
    </section>
  );
}
