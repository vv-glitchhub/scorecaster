"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import {
  DecisionBadge,
  EmptyState,
  MatchIdentity,
  MetricTile,
  PageHero,
  SectionHeader,
  TrustBar
} from "../components/ProductUI";
import { formatPercent } from "../../lib/analysis-engine";
import { calculateTrackingStats } from "../../lib/tracking-engine";
import { getTrackedBets } from "../../lib/tracking-storage";

const FOCUS_KEY = "scorecaster_daily_brief_focus";
const SNAPSHOT_KEY = "scorecaster_daily_brief_snapshot";

function normalizedDecision(pick) {
  const raw = String(pick?.productDecision || pick?.decision || "CAUTION").toUpperCase();
  if (raw === "BET") return "PLAY";
  if (raw === "PASS") return "SKIP";
  if (raw === "WAIT") return "WATCH";
  return raw;
}

function rankPick(pick) {
  const decisionWeight = { PLAY: 4, WATCH: 3, CAUTION: 2, SKIP: 1 }[normalizedDecision(pick)] || 0;
  return (
    decisionWeight * 1000 +
    Number(pick?.edge || 0) * 100 +
    Number(pick?.ev || 0) * 50 +
    Number(pick?.confidence || 0) * 10
  );
}

function matchName(pick) {
  return pick?.match || `${pick?.homeTeam || "Home"} – ${pick?.awayTeam || "Away"}`;
}

function kickoffLabel(value, locale, fallback) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function BriefCard({ pick, locale, tr }) {
  const decision = normalizedDecision(pick);
  const reason = pick?.evidenceGateReason || pick?.decisionReason || tr({
    fi: "Markkinakonsensus ja turvaportit muodostivat tämän luokituksen.",
    en: "Market consensus and safety gates formed this classification.",
    es: "El consenso del mercado y los filtros de seguridad formaron esta clasificación."
  });

  return (
    <article className="sc-card-hover rounded-[1.5rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <MatchIdentity
          homeTeam={pick?.homeTeam}
          awayTeam={pick?.awayTeam}
          meta={`${pick?.leagueTitle || pick?.league || tr({ fi: "Urheilu", en: "Sport", es: "Deporte" })} · ${kickoffLabel(
            pick?.commenceTime,
            locale,
            tr({ fi: "Alkamisaika puuttuu", en: "Kickoff unavailable", es: "Hora no disponible" })
          )}`}
        />
        <DecisionBadge decision={decision} />
      </div>

      <div className="mt-4 text-base font-black text-[var(--sc-text)]">
        {pick?.selection || pick?.label || tr({ fi: "Valinta puuttuu", en: "Selection unavailable", es: "Selección no disponible" })}
        {Number(pick?.odds || 0) > 0 && <span className="ml-2 text-[var(--sc-brand)]">@ {Number(pick.odds).toFixed(2)}</span>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile compact label="Edge" value={formatPercent(pick?.edge)} tone={Number(pick?.edge || 0) > 0 ? "green" : "default"} />
        <MetricTile compact label="EV" value={formatPercent(pick?.ev)} tone={Number(pick?.ev || 0) > 0 ? "green" : "default"} />
        <MetricTile compact label={tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" })} value={formatPercent(pick?.confidence)} />
        <MetricTile compact label={tr({ fi: "Lähteet", en: "Sources", es: "Fuentes" })} value={String(pick?.bookmakerCount || 0)} />
      </div>

      <p className="mt-4 border-t border-[var(--sc-border)] pt-4 text-sm leading-6 text-[var(--sc-muted)]">{reason}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/agent" className="sc-button-secondary">{tr({ fi: "Avaa auditointi", en: "Open audit", es: "Abrir auditoría" })}</Link>
        <Link href="/tracking" className="sc-button-ghost">{tr({ fi: "Paperiseuranta", en: "Paper tracking", es: "Seguimiento simulado" })}</Link>
      </div>
    </article>
  );
}

export default function DailyBriefClient() {
  const { tr, locale } = useLanguage();
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("loading");
  const [generatedAt, setGeneratedAt] = useState(null);
  const [trackingStats, setTrackingStats] = useState(() => calculateTrackingStats([]));
  const [focus, setFocus] = useState("balanced");
  const [copyState, setCopyState] = useState("idle");
  const [snapshotSavedAt, setSnapshotSavedAt] = useState(null);

  useEffect(() => {
    try {
      const storedFocus = localStorage.getItem(FOCUS_KEY);
      if (["selective", "balanced", "observe"].includes(storedFocus)) setFocus(storedFocus);

      const storedSnapshot = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "null");
      if (storedSnapshot?.savedAt) setSnapshotSavedAt(storedSnapshot.savedAt);
    } catch {
      setSnapshotSavedAt(null);
    }

    setTrackingStats(calculateTrackingStats(getTrackedBets()));

    async function load() {
      try {
        const response = await fetch("/api/top-picks?view=summary", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Daily Brief unavailable");
        setPicks(Array.isArray(data?.featured) ? data.featured : []);
        setSource(data?.fixtureSource || data?.source || "live-odds-provider-only");
        setGeneratedAt(data?.generatedAt || new Date().toISOString());
      } catch {
        setPicks([]);
        setSource(tr({ fi: "ei saatavilla", en: "unavailable", es: "no disponible" }));
        setGeneratedAt(null);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [tr]);

  const buckets = useMemo(() => {
    const sorted = [...picks].sort((a, b) => rankPick(b) - rankPick(a));
    return {
      play: sorted.filter((pick) => normalizedDecision(pick) === "PLAY"),
      watch: sorted.filter((pick) => ["WATCH", "CAUTION"].includes(normalizedDecision(pick))),
      skip: sorted.filter((pick) => normalizedDecision(pick) === "SKIP")
    };
  }, [picks]);

  const displayedPlay = focus === "observe" ? [] : buckets.play.slice(0, focus === "selective" ? 1 : 3);
  const displayedWatch = buckets.watch.slice(0, focus === "observe" ? 5 : 3);
  const displayedSkip = buckets.skip.slice(0, 3);

  const updated = generatedAt
    ? new Date(generatedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : tr({ fi: "ei saatavilla", en: "unavailable", es: "no disponible" });

  const portfolioTone = Number(trackingStats?.roi || 0) > 0
    ? "green"
    : Number(trackingStats?.roi || 0) < 0
      ? "red"
      : "default";

  const plan = useMemo(() => {
    if (focus === "observe") {
      return tr({
        fi: "Tänään vain seurataan markkinaa. Uusia paperikohteita ei lisätä ennen kuin evidenssi vahvistuu.",
        en: "Observe the market only today. Add no new paper picks until evidence improves.",
        es: "Hoy solo se observa el mercado. No se añaden nuevas selecciones simuladas hasta que mejore la evidencia."
      });
    }
    if (focus === "selective") {
      return tr({
        fi: "Valitse korkeintaan yksi PLAY-kohde. Tarkista hinta, evidenssi ja päällekkäinen riski ennen tallennusta.",
        en: "Choose at most one PLAY. Verify price, evidence and overlapping risk before saving it.",
        es: "Elige como máximo un PLAY. Verifica cuota, evidencia y riesgo solapado antes de guardarlo."
      });
    }
    return tr({
      fi: "Käsittele PLAY-kohteet yksi kerrallaan, pidä WATCH seurannassa ja hyväksy SKIP normaaliksi päätökseksi.",
      en: "Review PLAY picks one at a time, keep WATCH items under observation and accept SKIP as a normal decision.",
      es: "Revisa los PLAY uno por uno, mantén WATCH en observación y acepta SKIP como una decisión normal."
    });
  }, [focus, tr]);

  const briefText = useMemo(() => {
    const lines = [
      "Scorecaster Daily Brief",
      `${tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" })}: ${updated}`,
      `${tr({ fi: "Tila", en: "Mode", es: "Modo" })}: ${tr({ fi: "vain paperiseuranta", en: "paper only", es: "solo simulación" })}`,
      `${tr({ fi: "PLAY", en: "PLAY", es: "PLAY" })}: ${buckets.play.length}`,
      `${tr({ fi: "WATCH", en: "WATCH", es: "WATCH" })}: ${buckets.watch.length}`,
      `${tr({ fi: "SKIP", en: "SKIP", es: "SKIP" })}: ${buckets.skip.length}`,
      "",
      `${tr({ fi: "Päivän suunnitelma", en: "Daily plan", es: "Plan diario" })}: ${plan}`
    ];

    for (const pick of displayedPlay) {
      lines.push(`PLAY · ${matchName(pick)} · ${pick?.selection || pick?.label || "Selection"} @ ${Number(pick?.odds || 0).toFixed(2)} · Edge ${formatPercent(pick?.edge)}`);
    }
    for (const pick of displayedWatch) {
      lines.push(`WATCH · ${matchName(pick)} · ${pick?.selection || pick?.label || "Selection"}`);
    }
    return lines.join("\n");
  }, [buckets, displayedPlay, displayedWatch, plan, tr, updated]);

  function changeFocus(nextFocus) {
    setFocus(nextFocus);
    try {
      localStorage.setItem(FOCUS_KEY, nextFocus);
    } catch {
      // The brief remains usable when storage is unavailable.
    }
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(briefText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
    }
  }

  function saveSnapshot() {
    const savedAt = new Date().toISOString();
    const snapshot = {
      savedAt,
      generatedAt,
      focus,
      source,
      counts: {
        play: buckets.play.length,
        watch: buckets.watch.length,
        skip: buckets.skip.length
      },
      briefText
    };

    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
      setSnapshotSavedAt(savedAt);
    } catch {
      setSnapshotSavedAt(null);
    }
  }

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="Daily Brief V1"
        title={tr({
          fi: "Yksi näkymä päivän päätöksille, riskille ja paperisalkulle.",
          en: "One view for today’s decisions, risk and paper portfolio.",
          es: "Una vista para las decisiones, el riesgo y la cartera simulada de hoy."
        })}
        description={tr({
          fi: "Briefi järjestää vahvimmat PLAY-kohteet, seurattavat WATCH-havainnot ja perustellut SKIP-päätökset. Se ei lisää oikean rahan toimintaa eikä muuta mallin todennäköisyyksiä.",
          en: "The brief orders the strongest PLAY picks, WATCH observations and justified SKIP decisions. It adds no real-money action and does not alter model probabilities.",
          es: "El informe ordena los PLAY más sólidos, las observaciones WATCH y las decisiones SKIP justificadas. No añade acciones con dinero real ni altera probabilidades."
        })}
        actions={
          <>
            <button type="button" onClick={copyBrief} className="sc-button-primary">
              {copyState === "copied"
                ? tr({ fi: "Kopioitu", en: "Copied", es: "Copiado" })
                : copyState === "error"
                  ? tr({ fi: "Kopiointi epäonnistui", en: "Copy failed", es: "Error al copiar" })
                  : tr({ fi: "Kopioi päivän briefi", en: "Copy daily brief", es: "Copiar informe diario" })}
            </button>
            <button type="button" onClick={saveSnapshot} className="sc-button-secondary">
              {tr({ fi: "Tallenna tilannekuva", en: "Save snapshot", es: "Guardar instantánea" })}
            </button>
            <Link href="/betting" className="sc-button-ghost">{tr({ fi: "Avaa kaikki kohteet", en: "Open all picks", es: "Abrir todos" })}</Link>
          </>
        }
        aside={
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-faint)]">{tr({ fi: "Päivän fokus", en: "Daily focus", es: "Enfoque diario" })}</div>
            <div className="mt-3 grid gap-2">
              {[
                ["selective", tr({ fi: "Valikoiva · enintään 1 PLAY", en: "Selective · max 1 PLAY", es: "Selectivo · máx. 1 PLAY" })],
                ["balanced", tr({ fi: "Tasapainoinen · enintään 3 PLAY", en: "Balanced · max 3 PLAY", es: "Equilibrado · máx. 3 PLAY" })],
                ["observe", tr({ fi: "Seuranta · ei uusia PLAY-kohteita", en: "Observe · no new PLAY picks", es: "Observar · sin nuevos PLAY" })]
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeFocus(value)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm font-black transition ${focus === value ? "border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] text-[var(--sc-text)]" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-muted)] hover:text-[var(--sc-text)]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <TrustBar items={[
        { label: tr({ fi: "Lähde", en: "Source", es: "Fuente" }), value: source },
        { label: tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" }), value: updated, tone: "info" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: tr({ fi: "vain paperiseuranta", en: "paper only", es: "solo simulación" }), tone: "warning" },
        snapshotSavedAt ? { label: tr({ fi: "Tilannekuva", en: "Snapshot", es: "Instantánea" }), value: new Date(snapshotSavedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }), tone: "info" } : null
      ]} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="PLAY" value={loading ? "…" : String(buckets.play.length)} hint={tr({ fi: "Täydet portit läpäisseet", en: "Passed all gates", es: "Superaron todos los filtros" })} tone="green" />
        <MetricTile label="WATCH" value={loading ? "…" : String(buckets.watch.length)} hint={tr({ fi: "Seuraa hinnan tai evidenssin muutosta", en: "Watch price or evidence changes", es: "Vigila cambios de cuota o evidencia" })} tone="yellow" />
        <MetricTile label="SKIP" value={loading ? "…" : String(buckets.skip.length)} hint={tr({ fi: "Hyväksytty riskipäätös", en: "Accepted risk decision", es: "Decisión de riesgo aceptada" })} tone="red" />
        <MetricTile label={tr({ fi: "Paperi-ROI", en: "Paper ROI", es: "ROI simulado" })} value={formatPercent(trackingStats?.roi)} hint={`${trackingStats?.openBets || 0} ${tr({ fi: "avointa kohdetta", en: "open picks", es: "selecciones abiertas" })}`} tone={portfolioTone} />
      </section>

      <section className="rounded-[1.5rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-5 sm:p-6">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">{tr({ fi: "Päivän riskisuunnitelma", en: "Daily risk plan", es: "Plan de riesgo diario" })}</div>
        <p className="mt-3 max-w-4xl text-base font-bold leading-7 text-[var(--sc-text-secondary)]">{plan}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[var(--sc-muted)]">
          <span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5">{tr({ fi: "Ei oikean rahan vetoja", en: "No real-money bets", es: "Sin apuestas con dinero real" })}</span>
          <span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5">{tr({ fi: "Ei todennäköisyyksien yliratsastusta", en: "No probability overrides", es: "Sin sobrescribir probabilidades" })}</span>
          <span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5">{tr({ fi: "SKIP on sallittu", en: "SKIP is valid", es: "SKIP es válido" })}</span>
        </div>
      </section>

      <section>
        <SectionHeader
          eyebrow={tr({ fi: "Toimi ensin", en: "Act first", es: "Actúa primero" })}
          title={tr({ fi: "Päivän PLAY-lista", en: "Today’s PLAY list", es: "Lista PLAY de hoy" })}
          description={tr({
            fi: "Fokusasetus rajoittaa näkyvien PLAY-kohteiden määrää. Se ei muuta mallin tuloksia.",
            en: "The focus setting limits how many PLAY picks are shown. It does not change model results.",
            es: "El enfoque limita cuántos PLAY se muestran. No cambia los resultados del modelo."
          })}
          action={<Link href="/agent" className="sc-button-secondary">{tr({ fi: "Avaa AI-agentti", en: "Open AI Agent", es: "Abrir agente IA" })}</Link>}
        />
        {loading && <div className="rounded-[1.5rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-6 text-sm text-[var(--sc-muted)]">{tr({ fi: "Muodostetaan päivän briefiä…", en: "Building today’s brief…", es: "Creando el informe de hoy…" })}</div>}
        {!loading && displayedPlay.length === 0 && (
          <EmptyState
            title={focus === "observe"
              ? tr({ fi: "Seurantatila on päällä", en: "Observe mode is active", es: "El modo observación está activo" })
              : tr({ fi: "Ei PLAY-kohteita", en: "No PLAY picks", es: "No hay PLAY" })}
            description={focus === "observe"
              ? tr({ fi: "Briefi näyttää tänään vain WATCH-havainnot ja riskikontekstin.", en: "The brief shows WATCH observations and risk context only today.", es: "El informe muestra hoy solo observaciones WATCH y contexto de riesgo." })
              : tr({ fi: "Turvaportit eivät hyväksyneet yhtään kohdetta. Tämä on normaali ja arvokas tulos.", en: "No pick passed every safety gate. This is a normal and valuable result.", es: "Ninguna selección superó todos los filtros. Es un resultado normal y valioso." })}
            actionHref="/betting"
            actionLabel={tr({ fi: "Tarkista markkina", en: "Review market", es: "Revisar mercado" })}
          />
        )}
        <div className="grid gap-4 xl:grid-cols-2">
          {displayedPlay.map((pick, index) => <BriefCard key={`play-${pick?.id || matchName(pick)}-${index}`} pick={pick} locale={locale} tr={tr} />)}
        </div>
      </section>

      <section className="grid gap-7 xl:grid-cols-2">
        <div>
          <SectionHeader
            eyebrow="WATCH"
            title={tr({ fi: "Seuraa näitä muutoksia", en: "Watch these changes", es: "Vigila estos cambios" })}
            description={tr({ fi: "WATCH ei ole toimintakäsky. Kohde odottaa parempaa hintaa, lisäevidenssiä tai pienempää riskiä.", en: "WATCH is not an action command. The pick needs a better price, more evidence or less risk.", es: "WATCH no es una orden. La selección necesita mejor cuota, más evidencia o menos riesgo." })}
          />
          <div className="space-y-4">
            {displayedWatch.length === 0 && !loading && <EmptyState title={tr({ fi: "Ei WATCH-havaintoja", en: "No WATCH observations", es: "Sin observaciones WATCH" })} description={tr({ fi: "Tällä hetkellä ei ole erillistä seurattavaa muutosta.", en: "There is no separate change to monitor right now.", es: "No hay cambios específicos que vigilar ahora." })} />}
            {displayedWatch.map((pick, index) => <BriefCard key={`watch-${pick?.id || matchName(pick)}-${index}`} pick={pick} locale={locale} tr={tr} />)}
          </div>
        </div>

        <div>
          <SectionHeader
            eyebrow="SKIP"
            title={tr({ fi: "Mitä jätetään väliin", en: "What to leave alone", es: "Qué dejar pasar" })}
            description={tr({ fi: "SKIP-lista tekee riskin välttämisestä näkyvän päätöksen eikä tyhjää tilaa.", en: "The SKIP list makes risk avoidance an explicit decision instead of an empty state.", es: "La lista SKIP convierte evitar riesgo en una decisión explícita, no en un vacío." })}
          />
          <div className="space-y-4">
            {displayedSkip.length === 0 && !loading && <EmptyState title={tr({ fi: "Ei erillisiä SKIP-kohteita", en: "No separate SKIP picks", es: "No hay selecciones SKIP" })} description={tr({ fi: "Kaikki saatavilla olevat kohteet ovat PLAY- tai WATCH-luokassa.", en: "All available picks are currently PLAY or WATCH.", es: "Todas las selecciones disponibles están en PLAY o WATCH." })} />}
            {displayedSkip.map((pick, index) => <BriefCard key={`skip-${pick?.id || matchName(pick)}-${index}`} pick={pick} locale={locale} tr={tr} />)}
          </div>
        </div>
      </section>
    </div>
  );
}
