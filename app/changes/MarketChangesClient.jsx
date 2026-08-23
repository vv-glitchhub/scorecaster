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
import {
  compareMarketSnapshots,
  createMarketSnapshot
} from "../../lib/market-change-engine";
import {
  clearMarketSnapshots,
  getLatestMarketSnapshot,
  getMarketSnapshots,
  saveMarketSnapshot
} from "../../lib/market-snapshot-storage";

const FILTERS = ["all", "decision", "price", "new", "removed"];

function signed(value, digits = 2) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : ""}${number.toFixed(digits)}`;
}

function changeTone(change) {
  if (change.severity === "critical") return "red";
  if (change.severity === "high") return "yellow";
  if (change.kind === "new") return "green";
  return "blue";
}

function changeTitle(change, tr) {
  if (change.kind === "new") return tr({ fi: "Uusi kohde syötteessä", en: "New pick in the feed", es: "Nueva selección en el feed" });
  if (change.kind === "removed") return tr({ fi: "Poistui nykyisestä syötteestä", en: "Left the current feed", es: "Salió del feed actual" });
  if (change.kind === "decision") return tr({ fi: "Päätösluokka muuttui", en: "Decision class changed", es: "Cambió la clase de decisión" });
  if (change.kind === "price") return tr({ fi: "Hinta tai kerroin muuttui", en: "Price or odds changed", es: "Cambió la cuota" });
  return tr({ fi: "Analyysimittarit muuttuivat", en: "Analysis metrics changed", es: "Cambiaron las métricas" });
}

function fieldLabel(field, tr) {
  const labels = {
    decision: tr({ fi: "Päätös", en: "Decision", es: "Decisión" }),
    odds: tr({ fi: "Kerroin", en: "Odds", es: "Cuota" }),
    edge: "Edge",
    ev: "EV",
    confidence: tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" }),
    bookmakerCount: tr({ fi: "Vedonvälittäjät", en: "Bookmakers", es: "Casas" })
  };
  return labels[field] || field;
}

function formatFieldValue(field, value) {
  if (value === null || value === undefined) return "–";
  if (["edge", "ev", "confidence"].includes(field)) return formatPercent(value);
  if (field === "odds") return Number(value).toFixed(2);
  return String(value);
}

function ChangeCard({ change, tr, locale }) {
  const pick = change.current || change.previous;
  const previousDecision = change.previous?.decision;
  const currentDecision = change.current?.decision;
  const priceChange = change.fields.find((field) => field.field === "odds");
  const edgeChange = change.fields.find((field) => field.field === "edge");
  const evChange = change.fields.find((field) => field.field === "ev");
  const confidenceChange = change.fields.find((field) => field.field === "confidence");

  return (
    <article className="sc-card-hover rounded-[1.5rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <MatchIdentity
          homeTeam={pick?.homeTeam}
          awayTeam={pick?.awayTeam}
          meta={`${pick?.league || tr({ fi: "Urheilu", en: "Sport", es: "Deporte" })}${pick?.commenceTime ? ` · ${new Date(pick.commenceTime).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}`}
        />
        <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${change.severity === "critical" ? "border-rose-400/35 bg-rose-400/10 text-rose-300" : change.severity === "high" ? "border-amber-400/35 bg-amber-400/10 text-amber-300" : "border-sky-400/30 bg-sky-400/10 text-sky-300"}`}>
          {change.severity}
        </span>
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-faint)]">{changeTitle(change, tr)}</div>
        <h3 className="mt-1.5 text-lg font-black tracking-[-0.025em] text-[var(--sc-text)]">{pick?.selection || tr({ fi: "Valinta", en: "Selection", es: "Selección" })}</h3>
      </div>

      {change.kind === "decision" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <DecisionBadge decision={previousDecision} />
          <span className="font-black text-[var(--sc-faint)]">→</span>
          <DecisionBadge decision={currentDecision} />
        </div>
      )}

      {change.kind === "new" && <div className="mt-4"><DecisionBadge decision={currentDecision} /></div>}
      {change.kind === "removed" && <div className="mt-4"><DecisionBadge decision={previousDecision} /></div>}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile
          compact
          label={tr({ fi: "Kerroin nyt", en: "Odds now", es: "Cuota actual" })}
          value={change.current?.odds ? Number(change.current.odds).toFixed(2) : "–"}
          hint={priceChange ? `${signed(priceChange.delta)} (${formatFieldValue("odds", priceChange.previous)} → ${formatFieldValue("odds", priceChange.current)})` : undefined}
          tone={priceChange ? changeTone(change) : "default"}
        />
        <MetricTile
          compact
          label="Edge"
          value={formatPercent(change.current?.edge)}
          hint={edgeChange ? signed(edgeChange.delta * 100, 1) + " %-yks." : undefined}
          tone={edgeChange ? changeTone(change) : "default"}
        />
        <MetricTile
          compact
          label="EV"
          value={formatPercent(change.current?.ev)}
          hint={evChange ? signed(evChange.delta * 100, 1) + " %-yks." : undefined}
          tone={evChange ? changeTone(change) : "default"}
        />
        <MetricTile
          compact
          label={tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" })}
          value={formatPercent(change.current?.confidence)}
          hint={confidenceChange ? signed(confidenceChange.delta * 100, 1) + " %-yks." : undefined}
          tone={confidenceChange ? changeTone(change) : "default"}
        />
      </div>

      {change.fields.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {change.fields.map((field) => (
            <span key={field.field} className="rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-strong)] px-3 py-1.5 text-xs font-bold text-[var(--sc-muted)]">
              {fieldLabel(field.field, tr)}: {formatFieldValue(field.field, field.previous)} → {formatFieldValue(field.field, field.current)}
            </span>
          ))}
        </div>
      )}

      <p className="mt-4 border-t border-[var(--sc-border)] pt-4 text-sm leading-6 text-[var(--sc-muted)]">
        {change.current?.reason || change.previous?.reason || tr({ fi: "Muutos havaittiin tallennettuun vertailutasoon nähden.", en: "The change was detected against the saved baseline.", es: "El cambio se detectó frente a la referencia guardada." })}
      </p>
    </article>
  );
}

export default function MarketChangesClient() {
  const { tr, locale } = useLanguage();
  const [picks, setPicks] = useState([]);
  const [source, setSource] = useState("loading");
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [baseline, setBaseline] = useState(null);
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState("all");
  const [copyState, setCopyState] = useState("idle");

  useEffect(() => {
    setBaseline(getLatestMarketSnapshot());
    setHistory(getMarketSnapshots());

    async function load() {
      try {
        const response = await fetch("/api/top-picks?view=summary", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Market Change Radar unavailable");
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

  const currentSnapshot = useMemo(() => createMarketSnapshot({
    picks,
    generatedAt,
    source,
    savedAt: generatedAt || new Date().toISOString()
  }), [picks, generatedAt, source]);

  const comparison = useMemo(
    () => compareMarketSnapshots(baseline, currentSnapshot),
    [baseline, currentSnapshot]
  );

  const filteredChanges = useMemo(() => {
    if (filter === "all") return comparison.changes;
    return comparison.changes.filter((change) => change.kind === filter);
  }, [comparison.changes, filter]);

  const currentUpdated = generatedAt
    ? new Date(generatedAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : tr({ fi: "ei saatavilla", en: "unavailable", es: "no disponible" });
  const baselineUpdated = baseline?.savedAt
    ? new Date(baseline.savedAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : tr({ fi: "ei tallennettu", en: "not saved", es: "no guardada" });

  function saveBaseline() {
    const snapshot = createMarketSnapshot({
      picks,
      generatedAt,
      source,
      savedAt: new Date().toISOString()
    });
    const nextHistory = saveMarketSnapshot(snapshot);
    setBaseline(snapshot);
    setHistory(nextHistory);
  }

  function clearBaseline() {
    const confirmed = window.confirm(tr({
      fi: "Poistetaanko kaikki paikalliset markkinatilannekuvat?",
      en: "Delete all local market snapshots?",
      es: "¿Eliminar todas las instantáneas locales del mercado?"
    }));
    if (!confirmed) return;
    clearMarketSnapshots();
    setBaseline(null);
    setHistory([]);
  }

  const reportText = useMemo(() => {
    const lines = [
      "Scorecaster Market Change Radar",
      `${tr({ fi: "Nykyinen", en: "Current", es: "Actual" })}: ${currentUpdated}`,
      `${tr({ fi: "Vertailutaso", en: "Baseline", es: "Referencia" })}: ${baselineUpdated}`,
      `${tr({ fi: "Muutoksia", en: "Changes", es: "Cambios" })}: ${comparison.summary.total}`,
      `${tr({ fi: "Päätösmuutoksia", en: "Decision changes", es: "Cambios de decisión" })}: ${comparison.summary.decision}`,
      `${tr({ fi: "Hintamuutoksia", en: "Price changes", es: "Cambios de cuota" })}: ${comparison.summary.price}`,
      `${tr({ fi: "Uusia", en: "New", es: "Nuevas" })}: ${comparison.summary.new}`,
      `${tr({ fi: "Poistuneita", en: "Removed", es: "Eliminadas" })}: ${comparison.summary.removed}`,
      "",
      tr({ fi: "Vertailu on informatiivinen eikä muuta mallin päätöstä.", en: "The comparison is informational and does not alter the model decision.", es: "La comparación es informativa y no altera la decisión del modelo." })
    ];

    for (const change of comparison.changes.slice(0, 12)) {
      const pick = change.current || change.previous;
      const decision = change.current?.decision || change.previous?.decision || "–";
      lines.push(`${change.kind.toUpperCase()} · ${pick?.match || "Match"} · ${pick?.selection || "Selection"} · ${decision}`);
    }

    return lines.join("\n");
  }, [baselineUpdated, comparison, currentUpdated, tr]);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="Market Change Radar V1"
        title={tr({
          fi: "Näe, mikä muuttui edellisen tarkistuksen jälkeen.",
          en: "See what changed since your previous check.",
          es: "Mira qué cambió desde la revisión anterior."
        })}
        description={tr({
          fi: "Radar vertaa nykyistä hallittua Top Picks -syötettä paikallisesti tallennettuun vertailutasoon. Se näyttää päätös-, kerroin-, edge-, EV- ja luottamusmuutokset sekä uudet ja poistuneet kohteet.",
          en: "The radar compares the current governed Top Picks feed with a locally saved baseline. It shows decision, odds, edge, EV and confidence changes plus new and removed picks.",
          es: "El radar compara el feed gobernado actual con una referencia local. Muestra cambios de decisión, cuota, edge, EV y confianza, además de selecciones nuevas y eliminadas."
        })}
        actions={
          <>
            <button type="button" onClick={saveBaseline} className="sc-button-primary" disabled={loading}>
              {baseline
                ? tr({ fi: "Aseta nykyinen uudeksi vertailutasoksi", en: "Set current as new baseline", es: "Usar el estado actual como referencia" })
                : tr({ fi: "Tallenna ensimmäinen vertailutaso", en: "Save first baseline", es: "Guardar primera referencia" })}
            </button>
            <button type="button" onClick={copyReport} className="sc-button-secondary" disabled={comparison.baselineMissing}>
              {copyState === "copied"
                ? tr({ fi: "Raportti kopioitu", en: "Report copied", es: "Informe copiado" })
                : copyState === "error"
                  ? tr({ fi: "Kopiointi epäonnistui", en: "Copy failed", es: "Error al copiar" })
                  : tr({ fi: "Kopioi muutosraportti", en: "Copy change report", es: "Copiar informe de cambios" })}
            </button>
            {baseline && <button type="button" onClick={clearBaseline} className="sc-button-ghost">{tr({ fi: "Tyhjennä historia", en: "Clear history", es: "Borrar historial" })}</button>}
          </>
        }
        aside={
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-faint)]">{tr({ fi: "Vertailun tila", en: "Comparison status", es: "Estado de comparación" })}</div>
            <div className="mt-3 text-5xl font-black tracking-[-0.05em] text-[var(--sc-text)]">{loading ? "…" : comparison.summary.total}</div>
            <div className="mt-1 text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "merkityksellistä muutosta", en: "meaningful changes", es: "cambios relevantes" })}</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MetricTile compact label={tr({ fi: "Kriittiset", en: "Critical", es: "Críticos" })} value={comparison.summary.critical} tone="red" />
              <MetricTile compact label={tr({ fi: "Korkeat", en: "High", es: "Altos" })} value={comparison.summary.high} tone="yellow" />
            </div>
          </div>
        }
      />

      <TrustBar items={[
        { label: tr({ fi: "Nykyinen data", en: "Current data", es: "Datos actuales" }), value: currentUpdated, tone: "info" },
        { label: tr({ fi: "Vertailutaso", en: "Baseline", es: "Referencia" }), value: baselineUpdated, tone: baseline ? "good" : "warning" },
        { label: tr({ fi: "Lähde", en: "Source", es: "Fuente" }), value: source },
        { label: tr({ fi: "Historia", en: "History", es: "Historial" }), value: `${history.length}/10`, tone: "info" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: tr({ fi: "vain paperiseuranta", en: "paper only", es: "solo simulación" }), tone: "warning" }
      ]} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile label={tr({ fi: "Päätösmuutokset", en: "Decision changes", es: "Cambios de decisión" })} value={comparison.summary.decision} tone={comparison.summary.decision ? "red" : "default"} />
        <MetricTile label={tr({ fi: "Hintamuutokset", en: "Price changes", es: "Cambios de cuota" })} value={comparison.summary.price} tone={comparison.summary.price ? "yellow" : "default"} />
        <MetricTile label={tr({ fi: "Mittarimuutokset", en: "Metric changes", es: "Cambios de métricas" })} value={comparison.summary.metric} tone={comparison.summary.metric ? "blue" : "default"} />
        <MetricTile label={tr({ fi: "Uudet kohteet", en: "New picks", es: "Nuevas selecciones" })} value={comparison.summary.new} tone={comparison.summary.new ? "green" : "default"} />
        <MetricTile label={tr({ fi: "Poistuneet", en: "Removed", es: "Eliminadas" })} value={comparison.summary.removed} tone="default" />
      </section>

      <section className="rounded-[1.5rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-5 sm:p-6">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">{tr({ fi: "Turvallisuusraja", en: "Safety boundary", es: "Límite de seguridad" })}</div>
        <p className="mt-3 max-w-4xl text-base font-bold leading-7 text-[var(--sc-text-secondary)]">
          {tr({
            fi: "Muutosvertailu on vain auditointi- ja seurantakerros. Se ei muuta todennäköisyyttä, edgeä, EV:tä, PLAY/WATCH/SKIP-luokitusta tai paperipanosta.",
            en: "Change comparison is an audit and monitoring layer only. It cannot alter probability, edge, EV, PLAY/WATCH/SKIP classification or paper stake.",
            es: "La comparación es solo una capa de auditoría y seguimiento. No puede cambiar probabilidad, edge, EV, clasificación PLAY/WATCH/SKIP ni importe simulado."
          })}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[var(--sc-muted)]">
          <span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5">|Δ kerroin| ≥ 0.02</span>
          <span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5">|Δ edge| ≥ 0.5 %-yks.</span>
          <span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5">|Δ EV| ≥ 0.5 %-yks.</span>
          <span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5">|Δ luottamus| ≥ 3 %-yks.</span>
        </div>
      </section>

      <section>
        <SectionHeader
          eyebrow={tr({ fi: "Muutosvirta", en: "Change stream", es: "Flujo de cambios" })}
          title={tr({ fi: "Merkitykselliset muutokset", en: "Meaningful changes", es: "Cambios relevantes" })}
          description={tr({
            fi: "Poistunut kohde tarkoittaa vain, ettei se ole enää nykyisessä Top Picks -syötteessä. Se ei yksin todista ottelun peruuntumista tai markkinan sulkeutumista.",
            en: "A removed pick only means it is no longer in the current Top Picks feed. It does not by itself prove cancellation or market closure.",
            es: "Una selección eliminada solo significa que ya no está en el feed actual. No demuestra por sí sola cancelación o cierre del mercado."
          })}
          action={<Link href="/brief" className="sc-button-secondary">{tr({ fi: "Avaa päivän briefi", en: "Open Daily Brief", es: "Abrir informe diario" })}</Link>}
        />

        {!comparison.baselineMissing && (
          <div className="mb-5 flex flex-wrap gap-2">
            {FILTERS.map((value) => {
              const labels = {
                all: tr({ fi: "Kaikki", en: "All", es: "Todos" }),
                decision: tr({ fi: "Päätökset", en: "Decisions", es: "Decisiones" }),
                price: tr({ fi: "Hinnat", en: "Prices", es: "Cuotas" }),
                new: tr({ fi: "Uudet", en: "New", es: "Nuevas" }),
                removed: tr({ fi: "Poistuneet", en: "Removed", es: "Eliminadas" })
              };
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full border px-4 py-2 text-xs font-black transition ${filter === value ? "border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] text-[var(--sc-text)]" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-muted)] hover:text-[var(--sc-text)]"}`}
                >
                  {labels[value]}
                </button>
              );
            })}
          </div>
        )}

        {loading && <div className="rounded-[1.5rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-6 text-sm text-[var(--sc-muted)]">{tr({ fi: "Verrataan nykyistä markkinaa…", en: "Comparing the current market…", es: "Comparando el mercado actual…" })}</div>}

        {!loading && comparison.baselineMissing && (
          <EmptyState
            title={tr({ fi: "Vertailutaso puuttuu", en: "No baseline yet", es: "Aún no hay referencia" })}
            description={tr({ fi: "Tallenna nykyinen tilanne vertailutasoksi. Seuraavalla käynnillä radar näyttää, mikä muuttui.", en: "Save the current state as a baseline. On the next visit, the radar will show what changed.", es: "Guarda el estado actual como referencia. En la próxima visita, el radar mostrará qué cambió." })}
          />
        )}

        {!loading && !comparison.baselineMissing && filteredChanges.length === 0 && (
          <EmptyState
            title={filter === "all"
              ? tr({ fi: "Ei merkityksellisiä muutoksia", en: "No meaningful changes", es: "Sin cambios relevantes" })
              : tr({ fi: "Ei tämän tyypin muutoksia", en: "No changes of this type", es: "No hay cambios de este tipo" })}
            description={tr({ fi: "Nykyinen syöte on valituilla raja-arvoilla sama kuin tallennettu vertailutaso.", en: "At the selected thresholds, the current feed matches the saved baseline.", es: "Con los umbrales seleccionados, el feed actual coincide con la referencia guardada." })}
          />
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          {filteredChanges.map((change) => <ChangeCard key={`${change.kind}-${change.key}`} change={change} tr={tr} locale={locale} />)}
        </div>
      </section>
    </div>
  );
}
