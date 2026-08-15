function shown(value) {
  return value !== null && value !== undefined && value !== "";
}

function number(value) {
  return shown(value) && Number.isFinite(Number(value)) ? Number(value) : null;
}

function stateLabel(state, tr) {
  const labels = {
    available: { fi: "Saatavilla", en: "Available", es: "Disponible" },
    "partially-available": { fi: "Osittain saatavilla", en: "Partially available", es: "Parcialmente disponible" },
    blocked: { fi: "Estynyt", en: "Blocked", es: "Bloqueado" },
    degraded: { fi: "Heikentynyt", en: "Degraded", es: "Degradado" },
    unsupported: { fi: "Ei tuettu", en: "Unsupported", es: "No compatible" },
    "not-applicable": { fi: "Ei sovellu", en: "Not applicable", es: "No aplicable" },
    unobserved: { fi: "Ei havaintoja", en: "No observations", es: "Sin observaciones" }
  };
  return tr(labels[state] || labels.unobserved);
}

function familyLabel(family, tr) {
  const labels = {
    injuries: { fi: "Loukkaantumiset", en: "Injuries", es: "Lesiones" },
    lineups: { fi: "Kokoonpanot", en: "Lineups", es: "Alineaciones" },
    context: { fi: "Ottelukonteksti", en: "Match context", es: "Contexto del partido" },
    news: { fi: "Uutiset", en: "News", es: "Noticias" },
    weather: { fi: "Sää", en: "Weather", es: "Clima" }
  };
  return tr(labels[family] || { fi: family, en: family, es: family });
}

function latestReason(item, tr) {
  const latest = item?.latest || {};
  if (latest.subscriptionUnavailable) return tr({ fi: "Provider-tilaus ei sisällä tätä dataa", en: "Provider subscription does not include this data", es: "La suscripción del proveedor no incluye estos datos" });
  if (latest.mode === "not_configured") return tr({ fi: "Provideria ei ole konfiguroitu", en: "Provider is not configured", es: "El proveedor no está configurado" });
  if (latest.mode === "not_confirmed") return tr({ fi: "Data ei ole vielä vahvistettu", en: "Data is not confirmed yet", es: "Los datos aún no están confirmados" });
  if (latest.mode === "unsupported_league") return tr({ fi: "Liigaa ei tueta tässä providerissa", en: "League is unsupported by this provider", es: "La liga no es compatible con este proveedor" });
  if (latest.mode === "budget_exhausted") return tr({ fi: "Providerin hankintabudjetti täynnä", en: "Provider acquisition budget exhausted", es: "Presupuesto de adquisición del proveedor agotado" });
  if (latest.mode === "timeout") return tr({ fi: "Provider aikakatkaistiin", en: "Provider timed out", es: "El proveedor agotó el tiempo" });
  if (latest.mode === "live") return tr({ fi: "Tuore provider-data käytettävissä", en: "Fresh provider data is available", es: "Hay datos recientes del proveedor" });
  return latest.mode || tr({ fi: "Ei varmennettua syytä", en: "No verified reason", es: "Sin motivo verificado" });
}

export default function ContextProviderDiagnosticsPanel({ data, tr }) {
  const diagnostics = data?.providerReadiness?.contextProviderDiagnostics;
  const families = Array.isArray(diagnostics?.families) ? diagnostics.families : [];
  const summary = diagnostics?.summary || {};

  if (!diagnostics) return null;

  return (
    <section className="sc-surface rounded-3xl p-5 sm:p-6" aria-label={tr({ fi: "Dataproviderien blockerit", en: "Data provider blockers", es: "Bloqueos de proveedores de datos" })}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="sc-kicker">{tr({ fi: "Release-diagnostiikka", en: "Release diagnostics", es: "Diagnóstico de lanzamiento" })}</p>
          <h2 className="mt-2 text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Data blockers", en: "Data blockers", es: "Bloqueos de datos" })}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">
            {tr({
              fi: "Näyttää miksi loukkaantumis-, kokoonpano-, konteksti-, uutis- tai säädata ei ole varmennettavissa. Tämä on telemetryä: blocker ei nosta todennäköisyyttä, coveragea tai panosta.",
              en: "Shows why injury, lineup, context, news or weather data cannot be verified. This is telemetry: a blocker never upgrades probability, coverage or stake.",
              es: "Muestra por qué no se pueden verificar lesiones, alineaciones, contexto, noticias o clima. Es telemetría: un bloqueo nunca aumenta probabilidad, cobertura o apuesta."
            })}
          </p>
        </div>
        <div className="sc-pill">{tr({ fi: "Paper-only", en: "Paper-only", es: "Solo papel" })}</div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sc-surface-soft rounded-2xl p-4">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">{tr({ fi: "Havaittuja perheitä", en: "Families observed", es: "Familias observadas" })}</div>
          <div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{number(summary.familiesObserved) ?? "—"}</div>
        </div>
        <div className="sc-surface-soft rounded-2xl p-4">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">{tr({ fi: "Estyneitä perheitä", en: "Blocked families", es: "Familias bloqueadas" })}</div>
          <div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{Array.isArray(summary.blockedFamilies) ? summary.blockedFamilies.length : "—"}</div>
        </div>
        <div className="sc-surface-soft rounded-2xl p-4">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">{tr({ fi: "Tilausblokkeja", en: "Subscription blockers", es: "Bloqueos de suscripción" })}</div>
          <div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{Array.isArray(summary.subscriptionBlockedFamilies) ? summary.subscriptionBlockedFamilies.length : "—"}</div>
        </div>
        <div className="sc-surface-soft rounded-2xl p-4">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">{tr({ fi: "Havaintoja", en: "Observations", es: "Observaciones" })}</div>
          <div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{number(summary.observations) ?? "—"}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {families.map((item) => {
          const latest = item?.latest || {};
          const starters = latest.starterCounts;
          return (
            <article key={item.family} className="sc-surface-soft rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black text-[var(--sc-text)]">{familyLabel(item.family, tr)}</h3>
                <span className="sc-pill">{stateLabel(item.state, tr)}</span>
              </div>
              <p className="mt-2 text-sm font-bold text-[var(--sc-text)]">{latestReason(item, tr)}</p>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div><dt className="text-[var(--sc-muted)]">Provider</dt><dd className="mt-1 font-bold text-[var(--sc-text)]">{latest.provider || "—"}</dd></div>
                <div><dt className="text-[var(--sc-muted)]">Mode</dt><dd className="mt-1 font-bold text-[var(--sc-text)]">{latest.mode || "—"}</dd></div>
                <div><dt className="text-[var(--sc-muted)]">HTTP</dt><dd className="mt-1 font-bold text-[var(--sc-text)]">{number(latest.status) ?? "—"}</dd></div>
                <div><dt className="text-[var(--sc-muted)]">{tr({ fi: "Saatavuus", en: "Availability", es: "Disponibilidad" })}</dt><dd className="mt-1 font-bold text-[var(--sc-text)]">{number(item.availabilityRate) === null ? "—" : `${Math.round(number(item.availabilityRate) * 100)}%`}</dd></div>
                <div><dt className="text-[var(--sc-muted)]">{tr({ fi: "Tapahtumia", en: "Events", es: "Eventos" })}</dt><dd className="mt-1 font-bold text-[var(--sc-text)]">{number(item.uniqueEvents) ?? "—"}</dd></div>
                <div><dt className="text-[var(--sc-muted)]">{tr({ fi: "Coverage tarkistettu", en: "Coverage checked", es: "Cobertura verificada" })}</dt><dd className="mt-1 font-bold text-[var(--sc-text)]">{latest.coverageChecked ? "yes" : "no"}</dd></div>
              </dl>

              {latest.path ? <p className="mt-3 break-all rounded-xl border border-[var(--sc-line)] px-3 py-2 font-mono text-[11px] text-[var(--sc-muted)]">{latest.path}</p> : null}
              {starters ? <p className="mt-3 text-xs text-[var(--sc-muted)]">{tr({ fi: "Starterit", en: "Starters", es: "Titulares" })}: {starters.home ?? "—"} + {starters.away ?? "—"}</p> : null}
              {number(latest.injuryCandidateCount) !== null ? <p className="mt-2 text-xs text-[var(--sc-muted)]">{tr({ fi: "Loukkaantumiskandidaatteja", en: "Injury candidates", es: "Candidatos de lesión" })}: {number(latest.injuryCandidateCount)}</p> : null}
              {latest.fallbackAttempted ? <p className="mt-2 text-xs text-[var(--sc-muted)]">Fallback: {latest.fallbackUsed ? "used" : "attempted"}{latest.fallbackMode ? ` · ${latest.fallbackMode}` : ""}</p> : null}
            </article>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-5 text-[var(--sc-muted)]">
        {tr({
          fi: "Näkymä ei sisällä event-ID:itä, joukkueiden nimiä, providerien raakavastauksia eikä credentialeja.",
          en: "This view contains no event IDs, team names, raw provider payloads or credentials.",
          es: "Esta vista no contiene IDs de eventos, nombres de equipos, respuestas sin procesar ni credenciales."
        })}
      </p>
    </section>
  );
}
