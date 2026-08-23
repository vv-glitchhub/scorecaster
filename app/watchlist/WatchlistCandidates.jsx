"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import {
  DecisionBadge,
  EmptyState,
  MatchIdentity,
  MetricTile,
  SectionHeader
} from "../components/ProductUI";

function eventId(item = {}) {
  return String(item.eventId || item.gameId || item.id || "");
}

function keyFor(item = {}) {
  return `${eventId(item)}::${String(item.selection || item.label || "").toLowerCase()}`;
}

function percent(value) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)} %` : "–";
}

function normalizedDecision(pick = {}) {
  const value = String(pick.productDecision || pick.decision || "CAUTION").toUpperCase();
  if (value === "BET") return "PLAY";
  if (value === "PASS") return "SKIP";
  return ["PLAY", "SKIP"].includes(value) ? value : "CAUTION";
}

export default function WatchlistCandidates() {
  const { tr, locale } = useLanguage();
  const [picks, setPicks] = useState([]);
  const [watched, setWatched] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("info");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const [picksResponse, watchResponse] = await Promise.all([
        fetch("/api/top-picks?view=summary", { cache: "no-store" }),
        fetch("/api/cloud/watchlist", { cache: "no-store" })
      ]);
      const picksPayload = await picksResponse.json();
      const watchPayload = await watchResponse.json();
      if (!watchResponse.ok) throw new Error(watchPayload?.error || "Watchlist unavailable");
      setPicks(picksResponse.ok && Array.isArray(picksPayload?.data) ? picksPayload.data.slice(0, 12) : []);
      setWatched(new Set((watchPayload.items || []).map((item) => `${item.event_id}::${String(item.selection || "").toLowerCase()}`)));
    } catch (error) {
      setPicks([]);
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : tr({ fi: "Kohteita ei voitu ladata.", en: "Selections could not be loaded.", es: "No se pudieron cargar las selecciones." }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => picks.filter((pick) => !watched.has(keyFor(pick))), [picks, watched]);

  async function add(pick) {
    const key = keyFor(pick);
    setBusy(key);
    setMessage("");
    try {
      const response = await fetch("/api/cloud/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: eventId(pick),
          selection: pick.selection || pick.label,
          sport: pick.sportKey || pick.league
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Watchlist save failed");
      setWatched((current) => new Set([...current, key]));
      setMessageTone("success");
      setMessage(tr({ fi: "Kohde lisättiin varmennettuun seurantaan.", en: "Selection added to verified watchlist.", es: "Selección añadida a la lista verificada." }));
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : tr({ fi: "Lisääminen epäonnistui.", en: "Adding failed.", es: "No se pudo añadir." }));
    } finally {
      setBusy("");
    }
  }

  const date = (value) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
      <SectionHeader
        eyebrow={tr({ fi: "Vaihe 1", en: "Step 1", es: "Paso 1" })}
        title={tr({ fi: "Lisää varmennettu kohde seurantaan", en: "Add a verified selection to the watchlist", es: "Añade una selección verificada al seguimiento" })}
        description={tr({ fi: "Palvelin tarkistaa live-API-kohteen uudelleen ennen tallennusta. Vain nykyisessä analyysissä oleva kohde voidaan lisätä.", en: "The server verifies the live-API selection again before saving. Only a selection in the current analysis can be added.", es: "El servidor vuelve a verificar la selección antes de guardarla. Solo se puede añadir una selección del análisis actual." })}
        action={<button type="button" onClick={() => void load()} disabled={loading} className="sc-button-secondary disabled:opacity-50">{loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä ehdokkaat", en: "Refresh candidates", es: "Actualizar candidatos" })}</button>}
      />

      {message && <div className={`mb-5 rounded-[1.1rem] border p-4 text-sm ${messageTone === "error" ? "border-rose-400/25 bg-rose-400/10 text-rose-200" : messageTone === "success" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-sky-400/25 bg-sky-400/10 text-sky-200"}`}>{message}</div>}

      {!loading && visible.length === 0 ? (
        <EmptyState title={tr({ fi: "Uusia varmennettuja kohteita ei ole juuri nyt", en: "No new verified selections right now", es: "No hay nuevas selecciones verificadas ahora" })} description={tr({ fi: "Nykyiset lähiajan kohteet ovat jo seurannassa tai analyysi ei sisällä lisättäviä tapahtumia.", en: "Current near-term selections are already watched or the analysis has no additional events.", es: "Las selecciones próximas ya están seguidas o el análisis no contiene eventos adicionales." })} actionHref="/events" actionLabel={tr({ fi: "Avaa ottelut", en: "Open events", es: "Abrir eventos" })} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((pick) => {
            const key = keyFor(pick);
            return (
              <article key={key} className="rounded-[1.35rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <MatchIdentity homeTeam={pick.homeTeam} awayTeam={pick.awayTeam} meta={`${date(pick.commenceTime)} · ${pick.leagueTitle || pick.league || "Sport"}`} compact />
                  <DecisionBadge decision={normalizedDecision(pick)} />
                </div>
                <div className="mt-4 text-base font-black text-[var(--sc-text)]">{pick.selection} <span className="text-[var(--sc-brand)]">@ {Number(pick.odds || 0).toFixed(2)}</span></div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MetricTile compact label="Edge" value={percent(pick.edge)} tone={Number(pick.edge || 0) > 0 ? "green" : "default"} />
                  <MetricTile compact label={tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" })} value={percent(pick.confidence)} tone="blue" />
                </div>
                <button type="button" onClick={() => void add(pick)} disabled={busy === key} className="sc-button-primary mt-4 w-full disabled:opacity-40">
                  {busy === key ? tr({ fi: "Lisätään…", en: "Adding…", es: "Añadiendo…" }) : tr({ fi: "Lisää seurantaan", en: "Add to watchlist", es: "Añadir a la lista" })}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
