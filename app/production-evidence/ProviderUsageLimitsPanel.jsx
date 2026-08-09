const presentNumber = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const percent = (value) => presentNumber(value) ? `${(Number(value) * 100).toFixed(1)} %` : "—";

const USAGE_INTERVALS = ["per-second", "per-minute", "per-hour", "per-day", "per-month"];

function UsageTable({ usage, tr }) {
  const bindings = Array.isArray(usage?.bindingLimits) ? usage.bindingLimits : [];
  const intervals = USAGE_INTERVALS.map((interval) => ({
    interval,
    requestRatio: usage?.intervals?.[interval]?.maximumObservedRequestRatio,
    entityRatio: usage?.intervals?.[interval]?.maximumObservedEntityRatio
  })).filter((row) => presentNumber(row.requestRatio) || presentNumber(row.entityRatio));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-black text-[var(--sc-text)]">
          {tr({ fi: "Sitova limit", en: "Binding limit", es: "Límite vinculante" })}: {bindings.length ? bindings.join(" · ") : tr({ fi: "ei tunnistettu", en: "not identified", es: "no identificado" })}
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--sc-faint)]">
          {tr({ fi: "Usage-evidenssiä sisältäviä event-rivejä", en: "Event rows carrying usage evidence", es: "Filas de eventos con evidencia de uso" })}: {usage?.observationsCarryingUsage ?? 0}. {tr({ fi: "Toistuvat event-rivit eivät ole riippumattomia account-usage-sampleja.", en: "Repeated event rows are not independent account-usage samples.", es: "Las filas repetidas no son muestras independientes del uso de la cuenta." })}
        </p>
      </div>
      {intervals.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-[520px] w-full text-left text-xs">
            <thead className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--sc-muted)]">
              <tr><th className="py-2 pr-3">Interval</th><th className="py-2 pr-3">Request usage</th><th className="py-2">Entity usage</th></tr>
            </thead>
            <tbody>
              {intervals.map((row) => (
                <tr key={row.interval} className="border-t border-[var(--sc-border)]">
                  <td className="py-2 pr-3 font-black text-[var(--sc-text)]">{row.interval}</td>
                  <td className="py-2 pr-3">{percent(row.requestRatio)}</td>
                  <td className="py-2">{percent(row.entityRatio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-[var(--sc-faint)]">{tr({ fi: "Limitin käyttöasteita ei ole vielä tallentunut.", en: "No limit utilization ratios have been retained yet.", es: "Aún no hay ratios de utilización retenidos." })}</p>
      )}
    </div>
  );
}

export default function ProviderUsageLimitsPanel({ data, tr }) {
  const providers = Array.isArray(data?.providerReadiness?.secondaryPricingDiagnostics?.providers)
    ? data.providerReadiness.secondaryPricingDiagnostics.providers
    : [];
  const rows = providers
    .map((provider) => ({
      provider: provider?.provider || "unknown",
      usage: provider?.upstreamErrors?.usage || null
    }))
    .filter((row) => row.provider === "sportsgameodds" || row.usage?.observed);
  const observed = rows.filter((row) => row.usage?.observed);

  return (
    <section className="sc-surface rounded-3xl p-5 sm:p-6" aria-labelledby="provider-usage-limits-title">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-muted)]">SportsGameOdds usage evidence</p>
          <h2 id="provider-usage-limits-title" className="mt-2 text-2xl font-black tracking-[-0.035em]">
            {tr({ fi: "Mikä provider-limit sitoo?", en: "Which provider limit is binding?", es: "¿Qué límite del proveedor está vinculando?" })}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sc-text-secondary)]">
            {tr({
              fi: "429-tilanteessa Scorecaster säilyttää vain allowlistatut binding-labelit ja aggregoidut käyttöasteet. Tili-ID:t, sähköposti, API-avain ja providerin raw account -vastaus eivät kuulu tähän näkymään.",
              en: "After a 429, Scorecaster retains only allowlisted binding labels and aggregate utilization ratios. Account IDs, email, API keys and the provider raw account response are excluded.",
              es: "Tras un 429, Scorecaster conserva solo etiquetas permitidas y ratios agregados. IDs de cuenta, correo, claves API y la respuesta bruta quedan excluidos."
            })}
          </p>
        </div>
        <span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5 text-xs font-black text-[var(--sc-text-secondary)]">
          {observed.length ? tr({ fi: "usage-evidenssiä", en: "usage evidence present", es: "evidencia de uso" }) : tr({ fi: "ei vielä evidenssiä", en: "no evidence yet", es: "sin evidencia todavía" })}
        </span>
      </div>

      {!observed.length ? (
        <div className="mt-5 rounded-2xl border border-[var(--sc-border)] p-4 text-sm text-[var(--sc-muted)]">
          {tr({ fi: "Ei usage-evidenssiä vielä. Se ilmestyy vasta turvallisesti luokitellun SportsGameOdds 429 -havainnon jälkeen.", en: "No usage evidence yet. It appears only after a safely classified SportsGameOdds 429 observation.", es: "Aún no hay evidencia de uso. Solo aparece tras un 429 de SportsGameOdds clasificado de forma segura." })}
        </div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {observed.map((row) => (
            <article key={row.provider} className="sc-surface-soft rounded-2xl p-4">
              <h3 className="font-black text-[var(--sc-text)]">{row.provider}</h3>
              <div className="mt-3"><UsageTable usage={row.usage} tr={tr} /></div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
