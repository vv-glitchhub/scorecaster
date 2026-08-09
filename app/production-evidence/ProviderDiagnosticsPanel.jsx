const presentNumber = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const percent = (value) => presentNumber(value) ? `${(Number(value) * 100).toFixed(1)} %` : "—";
const decimal = (value, digits = 1) => presentNumber(value) ? Number(value).toFixed(digits) : "—";

const MODE_ORDER = [
  "live",
  "api_error",
  "fetch_error",
  "timeout",
  "no_match",
  "low_match_confidence",
  "unsupported_league",
  "not_configured",
  "not_verified",
  "unavailable",
  "other"
];

const UPSTREAM_LABELS = Object.freeze({
  bad_request: "400 bad request",
  unauthorized: "401 unauthorized",
  forbidden: "403 forbidden",
  not_found: "404 not found",
  rate_limited: "429 rate limited",
  provider_server_error: "5xx provider error",
  provider_unavailable: "503 unavailable",
  provider_timeout: "504 / timeout",
  network_error: "network error",
  invalid_response: "invalid response",
  unknown_http_error: "unknown HTTP error"
});

const MATCH_LABELS = Object.freeze({
  matched: "matched",
  no_candidates: "no candidates",
  team_similarity: "team similarity",
  time_window: "time window",
  confidence_threshold: "confidence threshold",
  unknown: "unknown"
});

function nonZeroEntries(value = {}, preferred = []) {
  const rows = Object.entries(value || {})
    .filter(([, count]) => presentNumber(count) && Number(count) > 0)
    .map(([key, count]) => [key, Number(count)]);
  const rank = new Map(preferred.map((key, index) => [key, index]));
  return rows.sort(([left], [right]) => {
    const leftRank = rank.has(left) ? rank.get(left) : preferred.length + 1;
    const rightRank = rank.has(right) ? rank.get(right) : preferred.length + 1;
    return leftRank - rightRank || left.localeCompare(right);
  });
}

function ChipList({ entries = [], labelFor = (value) => value, empty }) {
  if (!entries.length) return <span className="text-xs text-[var(--sc-faint)]">{empty}</span>;
  return (
    <ul className="flex flex-wrap gap-2" aria-label={empty}>
      {entries.map(([key, count]) => (
        <li key={key} className="rounded-full border border-[var(--sc-border)] bg-black/10 px-2.5 py-1 text-xs text-[var(--sc-text-secondary)]">
          <span className="font-black text-[var(--sc-text)]">{count}</span> {labelFor(key)}
        </li>
      ))}
    </ul>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="sc-surface-soft rounded-2xl p-4">
      <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-muted)]">{label}</dt>
      <dd className="mt-2 text-xl font-black tracking-[-0.03em] text-[var(--sc-text)]">{value}</dd>
      {detail ? <p className="mt-1 text-xs leading-5 text-[var(--sc-faint)]">{detail}</p> : null}
    </div>
  );
}

function ProviderCard({ provider, tr }) {
  const modes = nonZeroEntries(provider?.modeCounts, MODE_ORDER);
  const upstream = provider?.upstreamErrors || {};
  const upstreamCategories = nonZeroEntries(upstream.errorCategoryCounts);
  const statuses = nonZeroEntries(upstream.httpStatusCounts);
  const match = provider?.matchDiagnostics || {};
  const matchReasons = nonZeroEntries(match.rejectionReasonCounts);

  return (
    <article className="sc-surface-soft rounded-2xl p-4" aria-label={`${provider?.provider || "provider"} diagnostics`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-[var(--sc-text)]">{provider?.provider || "unknown"}</h3>
          <p className="mt-1 text-xs text-[var(--sc-faint)]">
            {provider?.liveObservations ?? 0}/{provider?.eligibleObservations ?? 0} {tr({ fi: "käytettävää pricing-havaintoa", en: "usable pricing observations", es: "observaciones de precio utilizables" })}
          </p>
        </div>
        <span className="rounded-full border border-[var(--sc-border)] px-2.5 py-1 text-xs font-black">{percent(provider?.usableRate)}</span>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">Modes</p>
          <ChipList entries={modes} empty={tr({ fi: "Ei mode-havaintoja", en: "No mode observations", es: "Sin observaciones de modo" })} />
        </div>
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">Upstream HTTP</p>
          <ChipList entries={upstreamCategories} labelFor={(key) => UPSTREAM_LABELS[key] || key} empty={tr({ fi: "Ei upstream-virheevidenssiä", en: "No upstream error evidence", es: "Sin evidencia de errores upstream" })} />
          {statuses.length ? <div className="mt-2"><ChipList entries={statuses} labelFor={(key) => `HTTP ${key}`} empty="" /></div> : null}
          {upstream.samples ? (
            <p className="mt-2 text-xs leading-5 text-[var(--sc-faint)]">
              {tr({ fi: "Yrityksiä keskimäärin", en: "Average attempts", es: "Intentos medios" })}: {decimal(upstream.averageAttempts, 2)} · {tr({ fi: "retryjä", en: "retries", es: "reintentos" })}: {upstream.retriedCount ?? 0}
              {presentNumber(upstream.averageRetryAfterSeconds) ? ` · Retry-After ${decimal(upstream.averageRetryAfterSeconds, 1)} s` : ""}
            </p>
          ) : null}
        </div>
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">Match gate</p>
          <ChipList entries={matchReasons} labelFor={(key) => MATCH_LABELS[key] || key} empty={tr({ fi: "Ei matching-evidenssiä vielä", en: "No matching evidence yet", es: "Sin evidencia de matching todavía" })} />
          {match.samples ? (
            <p className="mt-2 text-xs leading-5 text-[var(--sc-faint)]">
              {tr({ fi: "Paras confidence, ka.", en: "Best confidence, avg", es: "Mejor confianza, media" })}: {decimal(match.averageBestConfidence, 3)} · {tr({ fi: "minimi team similarity, ka.", en: "min team similarity, avg", es: "similitud mínima media" })}: {decimal(match.averageBestMinTeamSimilarity, 3)}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function ProviderDiagnosticsPanel({ data, tr }) {
  const readiness = data?.providerReadiness || {};
  const diagnostics = readiness?.secondaryPricingDiagnostics || null;
  const providers = Array.isArray(diagnostics?.providers) ? diagnostics.providers : [];
  const leagues = Array.isArray(diagnostics?.byLeague) ? diagnostics.byLeague : [];
  const hasEvidence = Boolean(diagnostics && (providers.length || leagues.length));

  return (
    <section className="sc-surface rounded-3xl p-5 sm:p-6" aria-labelledby="pricing-provider-diagnostics-title">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-muted)]">Pricing provider diagnosis</p>
          <h2 id="pricing-provider-diagnostics-title" className="mt-2 text-2xl font-black tracking-[-0.035em]">
            {tr({ fi: "Miksi toinen hintalähde puuttuu?", en: "Why is secondary pricing missing?", es: "¿Por qué falta el precio secundario?" })}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sc-text-secondary)]">
            {tr({
              fi: "Pricing-readiness käyttää vain odds-providerien evidenssiä. Weather-, injury-, lineup- ja news-lähteet pysyvät näkyvinä telemetriassa, mutta eivät yksin hard-disableta pricingiä.",
              en: "Pricing readiness uses odds-provider evidence only. Weather, injury, lineup and news sources stay visible as telemetry but cannot hard-disable pricing by themselves.",
              es: "La preparación de precios usa solo evidencia de proveedores de cuotas. Clima, lesiones, alineaciones y noticias siguen visibles como telemetría, pero no bloquean el precio por sí solos."
            })}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-400/25 bg-sky-400/10 px-4 py-3 text-xs leading-5 text-sky-100 lg:max-w-sm">
          <strong>Aggregate-only.</strong> {tr({
            fi: "Ei event-ID:itä, joukkueiden nimiä, raw provider -payloadia tai providerin error-bodya.",
            en: "No event IDs, team names, raw provider payloads or provider error bodies.",
            es: "Sin IDs de eventos, nombres de equipos, payloads brutos ni cuerpos de error del proveedor."
          })}
        </div>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Pricing availability" value={percent(readiness.averagePricingAvailability)} detail={`${readiness.pricingProviderCount ?? 0} pricing providers`} />
        <Metric label={tr({ fi: "Kaikki providerit", en: "All-provider availability", es: "Disponibilidad total" })} value={percent(readiness.averageAllProviderAvailability)} detail={`${readiness.optionalProviderCount ?? 0} optional providers`} />
        <Metric label={tr({ fi: "Ei-eligible odds-havainnot", en: "Non-eligible odds observations", es: "Observaciones de cuotas no elegibles" })} value={readiness.nonEligibleOddsObservationCount ?? data?.summary?.nonEligibleOddsObservations ?? 0} detail="unsupported / not configured" />
        <Metric label={tr({ fi: "Secondary eventit", en: "Secondary events", es: "Eventos secundarios" })} value={diagnostics?.eventCount ?? 0} detail={`${diagnostics?.oddsObservationCount ?? 0} latest odds observations`} />
      </dl>

      {!hasEvidence ? (
        <div className="mt-5 rounded-2xl border border-[var(--sc-border)] p-4 text-sm text-[var(--sc-muted)]">
          {tr({
            fi: "Uutta provider-diagnostiikkaa ei ole vielä tallentunut. Näkymä täyttyy seuraavien worker-havaintojen myötä.",
            en: "No new provider diagnostics have been retained yet. This panel will fill after fresh worker observations.",
            es: "Aún no hay nuevos diagnósticos retenidos. El panel se completará tras nuevas observaciones."
          })}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {providers.map((provider) => <ProviderCard key={provider.provider} provider={provider} tr={tr} />)}
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-[1040px] w-full text-left text-sm">
              <caption className="mb-3 text-left text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-muted)]">
                {tr({ fi: "Liigakohtainen secondary pricing", en: "Secondary pricing by league", es: "Precio secundario por liga" })}
              </caption>
              <thead className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">
                <tr><th className="p-3">Provider / league</th><th className="p-3">Live coverage</th><th className="p-3">Eligible</th><th className="p-3">Modes</th><th className="p-3">Upstream</th><th className="p-3">Match gate</th></tr>
              </thead>
              <tbody>
                {leagues.map((row, index) => {
                  const modes = nonZeroEntries(row?.modeCounts, MODE_ORDER);
                  const upstream = nonZeroEntries(row?.upstreamErrors?.errorCategoryCounts);
                  const matchReasons = nonZeroEntries(row?.matchDiagnostics?.rejectionReasonCounts);
                  return (
                    <tr key={`${row.provider}:${row.sport}:${row.league}:${index}`} className="border-t border-[var(--sc-border)] align-top">
                      <td className="p-3"><div className="font-black text-[var(--sc-text)]">{row.provider}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{row.league} · {row.sport}</div></td>
                      <td className="p-3 font-black">{percent(row.liveCoverageOfLeague)}<div className="mt-1 text-xs font-normal text-[var(--sc-faint)]">{row.liveObservations ?? 0}/{row.totalLeagueEvents ?? 0} events</div></td>
                      <td className="p-3">{row.liveObservations ?? 0}/{row.eligibleObservations ?? 0}<div className="mt-1 text-xs text-[var(--sc-faint)]">usable {percent(row.usableRate)}</div></td>
                      <td className="p-3"><ChipList entries={modes} empty="—" /></td>
                      <td className="p-3"><ChipList entries={upstream} labelFor={(key) => UPSTREAM_LABELS[key] || key} empty="—" /></td>
                      <td className="p-3"><ChipList entries={matchReasons} labelFor={(key) => MATCH_LABELS[key] || key} empty="—" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
