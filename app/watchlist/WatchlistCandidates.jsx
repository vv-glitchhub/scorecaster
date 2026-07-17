"use client";

import { useEffect, useMemo, useState } from "react";
import Panel from "../components/Panel";
import { useLanguage } from "../components/LanguageProvider";

function eventId(item = {}) {
  return String(item.eventId || item.gameId || item.id || "");
}
function keyFor(item = {}) {
  return `${eventId(item)}::${String(item.selection || item.label || "").toLowerCase()}`;
}
function percent(value) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)} %` : "–";
}

export default function WatchlistCandidates() {
  const { tr, locale } = useLanguage();
  const [picks, setPicks] = useState([]);
  const [watched, setWatched] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const [picksResponse, watchResponse] = await Promise.all([
        fetch("/api/top-picks", { cache: "no-store" }),
        fetch("/api/cloud/watchlist", { cache: "no-store" })
      ]);
      const picksPayload = await picksResponse.json();
      const watchPayload = await watchResponse.json();
      if (!watchResponse.ok) throw new Error(watchPayload?.error || "Watchlist unavailable");
      setPicks(picksResponse.ok && Array.isArray(picksPayload?.data) ? picksPayload.data.slice(0, 12) : []);
      setWatched(new Set((watchPayload.items || []).map((item) => `${item.event_id}::${String(item.selection || "").toLowerCase()}`)));
    } catch (error) {
      setPicks([]);
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
      setMessage(tr({ fi: "Kohde lisättiin varmennettuun seurantaan.", en: "Selection added to verified watchlist.", es: "Selección añadida a la lista verificada." }));
    } catch (error) {
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
    <Panel title={tr({ fi: "Lisää varmennettu kohde", en: "Add a verified selection", es: "Añadir selección verificada" })} subtitle={tr({ fi: "Palvelin tarkistaa live-API-kohteen uudelleen ennen tallennusta", en: "The server verifies the live-API selection again before saving", es: "El servidor vuelve a verificar la selección antes de guardarla" })}>
      {message && <div className="mb-4 rounded-xl border border-sky-400/20 bg-sky-400/10 p-3 text-sm text-sky-100">{message}</div>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((pick) => {
          const key = keyFor(pick);
          return <article key={key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-xs font-bold text-emerald-300">{date(pick.commenceTime)}</div><div className="mt-1 font-black">{pick.match || `${pick.homeTeam || ""} – ${pick.awayTeam || ""}`}</div><div className="mt-1 text-sm text-slate-300">{pick.selection} · {Number(pick.odds || 0).toFixed(2)}</div><div className="mt-2 text-xs text-slate-500">{pick.productDecision || pick.decision || "CAUTION"} · edge {percent(pick.edge)} · confidence {percent(pick.confidence)}</div><button onClick={() => void add(pick)} disabled={busy === key} className="mt-4 w-full rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-40">{busy === key ? tr({ fi: "Lisätään…", en: "Adding…", es: "Añadiendo…" }) : tr({ fi: "Lisää seurantaan", en: "Add to watchlist", es: "Añadir a la lista" })}</button></article>;
        })}
        {!loading && visible.length === 0 && <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">{tr({ fi: "Uusia lähiajan varmennettuja kohteita ei ole juuri nyt.", en: "No new verified near-term selections are available right now.", es: "No hay nuevas selecciones próximas verificadas ahora." })}</div>}
      </div>
    </Panel>
  );
}
