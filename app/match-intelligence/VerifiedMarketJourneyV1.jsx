"use client";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function decimal(value) {
  const parsed = finite(value);
  return parsed === null ? "—" : parsed.toFixed(2);
}

function signedPercentPoints(value) {
  const parsed = finite(value);
  if (parsed === null) return "—";
  return `${parsed > 0 ? "+" : ""}${parsed.toFixed(1)}%`;
}

function time(value, locale) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "—";
  return parsed.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function VerifiedMarketJourneyV1({ history = {}, tr, locale }) {
  const ready = history?.status === "ready"
    && history?.chronologySafe === true
    && history?.sameEventSelection === true;
  const snapshotCount = finite(history?.snapshotCount);
  const spanMinutes = finite(history?.spanMinutes);

  return (
    <section
      className="mt-5 rounded-[1.35rem] border border-sky-300/20 bg-sky-300/10 p-4 sm:p-5"
      data-verified-market-history-v1="true"
      data-market-history-status={ready ? "ready" : "unavailable"}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-sky-200">
            {tr({ fi: "Varmennettu markkinapolku", en: "Verified market path", es: "Ruta de mercado verificada" })}
          </div>
          <h4 className="mt-1 font-black text-[var(--sc-text)]">
            {tr({ fi: "Opening → nykyinen hinta", en: "Opening → current price", es: "Apertura → precio actual" })}
          </h4>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${ready ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>
          {ready
            ? tr({ fi: "varmennettu", en: "verified", es: "verificado" })
            : tr({ fi: "ei riittävää historiaa", en: "insufficient history", es: "historial insuficiente" })}
        </span>
      </div>

      {ready ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">Opening</div>
              <div className="mt-1 text-xl font-black text-[var(--sc-text)]">{decimal(history.openingOdds)}</div>
            </div>
            <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{tr({ fi: "Nykyinen", en: "Current", es: "Actual" })}</div>
              <div className="mt-1 text-xl font-black text-[var(--sc-text)]">{decimal(history.currentOdds)}</div>
            </div>
            <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{tr({ fi: "Liike", en: "Move", es: "Movimiento" })}</div>
              <div className="mt-1 text-xl font-black text-[var(--sc-text)]">{signedPercentPoints(history.movementPct)}</div>
            </div>
            <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">Snapshots</div>
              <div className="mt-1 text-xl font-black text-[var(--sc-text)]">{snapshotCount ?? "—"}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-[var(--sc-muted)]">
            <span>{time(history.openingCapturedAt, locale)} → {time(history.latestHistoricalCapturedAt, locale)}</span>
            <span>{spanMinutes === null ? "—" : `${Math.round(spanMinutes)} min`}</span>
            <span>{tr({ fi: "sama event + valinta", en: "same event + selection", es: "mismo evento + selección" })}</span>
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs leading-5 text-[var(--sc-muted)]">
          {tr({
            fi: "Markkinapolku julkaistaan vasta, kun samalle eventille ja valinnalle on vähintään 3 pregame-snapshotia vähintään 30 minuutin ajalta. Ohutta, kickoffin jälkeistä tai muuten epävarmaa historiaa ei näytetä varmennettuna.",
            en: "The market path is published only after the same event and selection have at least 3 pregame snapshots spanning at least 30 minutes. Thin, post-kickoff or otherwise uncertain history is never shown as verified.",
            es: "La ruta se publica solo con al menos 3 snapshots previos al inicio del mismo evento y selección durante 30 minutos o más. El historial insuficiente o posterior al inicio nunca se muestra como verificado."
          })}
          {snapshotCount !== null ? ` ${tr({ fi: "Nykyinen otos", en: "Current sample", es: "Muestra actual" })}: ${snapshotCount}.` : ""}
        </p>
      )}

      <div className="mt-3 border-t border-sky-300/15 pt-3 text-[11px] leading-5 text-[var(--sc-muted)]">
        {tr({
          fi: "Tämä on first-party havaintodata. Se ei muuta todennäköisyyttä, edgeä, EV:tä, tuotepäätöstä tai panosta.",
          en: "This is first-party observational data. It does not change probability, edge, EV, product decision or stake.",
          es: "Son datos observacionales propios. No cambian probabilidad, ventaja, EV, decisión ni importe."
        })}
      </div>
    </section>
  );
}
