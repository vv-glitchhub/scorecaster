"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { DecisionBadge, MetricTile, SectionHeader, TrustBar } from "../components/ProductUI";
import { formatPercent } from "../../lib/analysis-engine";

function timeLabel(value, locale) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "–" : date.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function MiniRecommendation({ item, tr }) {
  return <article className="rounded-[1.15rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">#{item.rank} · {item.league || ""}</div><div className="mt-1 truncate font-black text-[var(--sc-text)]">{item.match}</div><div className="mt-1 text-sm font-bold text-[var(--sc-text-secondary)]">{item.selection} {item.odds ? <span className="text-[var(--sc-brand)]">@ {Number(item.odds).toFixed(2)}</span> : null}</div></div><DecisionBadge decision={item.decision} /></div><div className="mt-3 grid grid-cols-3 gap-2"><MetricTile compact label="Edge" value={formatPercent(item.edge)} /><MetricTile compact label="EV" value={formatPercent(item.ev)} /><MetricTile compact label={tr({ fi: "Pisteet", en: "Score", es: "Puntos" })} value={`${Number(item.score || 0).toFixed(0)}`} /></div>{item.intelligenceV2?.nearPlay && <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-xs font-bold text-amber-200">Near PLAY · {item.intelligenceV2.nearPlayGate}</div>}</article>;
}

export default function RecommendationDailyBriefV2() {
  const { tr, locale } = useLanguage();
  const [recommendations, setRecommendations] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [autoWatch, setAutoWatch] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [recommendationResult, alertResult, autoWatchResult] = await Promise.allSettled([
      fetch("/api/recommendations?limit=12", { cache: "no-store" }).then(async (response) => ({ response, payload: await response.json() })),
      fetch("/api/cloud/alerts?limit=5", { cache: "no-store" }).then(async (response) => ({ response, payload: await response.json() })),
      fetch("/api/cloud/auto-watch-recommendations", { cache: "no-store" }).then(async (response) => ({ response, payload: await response.json() }))
    ]);
    if (recommendationResult.status === "fulfilled" && recommendationResult.value.response.ok) setRecommendations(recommendationResult.value.payload);
    else setRecommendations(null);
    if (alertResult.status === "fulfilled" && alertResult.value.response.ok) setAlerts(alertResult.value.payload);
    else setAlerts(null);
    if (autoWatchResult.status === "fulfilled" && autoWatchResult.value.response.ok) setAutoWatch(autoWatchResult.value.payload);
    else setAutoWatch(null);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const top = useMemo(() => (recommendations?.recommendations || []).filter((item) => item.decision !== "SKIP").slice(0, 3), [recommendations]);
  const near = useMemo(() => (recommendations?.nearPlay || []).slice(0, 3), [recommendations]);
  const latestAlerts = useMemo(() => (alerts?.items || []).filter((item) => item.active !== false).slice(0, 4), [alerts]);
  const unread = alerts?.summary?.unread ?? 0;
  const generatedAt = recommendations?.generatedAt || null;

  return <section className="space-y-5" data-recommendation-daily-brief="v2">
    <div className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Daily Brief V2 · Recommendation Intelligence</div><h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Mitä kannattaa tarkistaa juuri nyt", en: "What deserves attention right now", es: "Qué merece atención ahora" })}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Top 3, Near PLAY, Auto-Watch ja uusimmat palvelinhälytykset samassa yhteenvedossa. Tämä kerros ei muuta Recommendation Enginen päätöksiä.", en: "Top 3, Near PLAY, Auto-Watch and the latest server alerts in one brief. This layer never changes Recommendation Engine decisions.", es: "Top 3, Near PLAY, Auto-Watch y alertas recientes en un resumen. Esta capa no cambia decisiones." })}</p></div><button type="button" disabled={loading} onClick={() => void load()} className="sc-button-secondary">{loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä brief", en: "Refresh brief", es: "Actualizar" })}</button></div>
      <TrustBar className="mt-4" items={[{ label: tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" }), value: timeLabel(generatedAt, locale), tone: "info" }, { label: "PLAY", value: recommendations?.counts?.PLAY ?? "–", tone: "good" }, { label: "Near PLAY", value: recommendations?.counts?.NEAR_PLAY ?? "–", tone: "warning" }, { label: tr({ fi: "Lukemattomat alertit", en: "Unread alerts", es: "Alertas no leídas" }), value: alerts ? unread : "sign-in", tone: alerts && unread > 0 ? "warning" : "info" }, { label: "Mode", value: "paper-only", tone: "warning" }]} />
    </div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="sc-surface rounded-[1.5rem] p-5"><SectionHeader title={tr({ fi: "Top 3 juuri nyt", en: "Top 3 right now", es: "Top 3 ahora" })} action={<Link href="/recommendations" className="sc-button-ghost">Recommendation Center</Link>} /><div className="mt-4 grid gap-3 lg:grid-cols-3">{top.length ? top.map((item) => <MiniRecommendation key={`${item.eventId}-${item.selection}`} item={item} tr={tr} />) : <div className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Ei riittävästi PLAY/CAUTION-kohteita nykyisessä live-ikkunassa.", en: "Not enough PLAY/CAUTION picks in the current live window.", es: "No hay suficientes PLAY/CAUTION en la ventana actual." })}</div>}</div></div>

      <div className="sc-surface rounded-[1.5rem] p-5"><SectionHeader title="Auto-Watch" action={<Link href="/auto-watch" className="sc-button-ghost">{tr({ fi: "Asetukset", en: "Settings", es: "Ajustes" })}</Link>} /><div className="mt-4 grid grid-cols-2 gap-2"><MetricTile compact label={tr({ fi: "Tila", en: "Status", es: "Estado" })} value={autoWatch ? (autoWatch.preferences?.enabled ? "ACTIVE" : "OFF") : "sign-in"} tone={autoWatch?.preferences?.enabled ? "green" : "default"} /><MetricTile compact label={tr({ fi: "Auto-managed", en: "Auto-managed", es: "Auto-managed" })} value={autoWatch ? String(autoWatch.autoManagedCount || 0) : "–"} /><MetricTile compact label="Top N" value={autoWatch ? String(autoWatch.preferences?.top_n || 3) : "–"} /><MetricTile compact label={tr({ fi: "Viimeisin ajo", en: "Last run", es: "Última ejecución" })} value={autoWatch ? timeLabel(autoWatch.preferences?.last_completed_at, locale) : "–"} /></div><p className="mt-3 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Kirjautuneena palvelin voi seurata rankingin Top 1–3:a ja syöttää päätös-/hintamuutokset Alert Inboxiin.", en: "When signed in, the server can monitor the ranked Top 1–3 and send decision/price changes to Alert Inbox.", es: "Con sesión iniciada, el servidor puede vigilar Top 1–3 y enviar cambios al buzón." })}</p></div>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <div className="sc-surface rounded-[1.5rem] p-5"><SectionHeader title={tr({ fi: "Near PLAY", en: "Near PLAY", es: "Near PLAY" })} description={tr({ fi: "Vain kohteet, joilta puuttuu yksi näkyvä PLAY-portti. Final safety check vaaditaan edelleen.", en: "Only picks missing one visible PLAY gate. Final safety is still required.", es: "Solo selecciones a un filtro visible; aún se requiere control final." })} action={<Link href="/near-play" className="sc-button-secondary">{tr({ fi: "Avaa kaikki", en: "Open all", es: "Abrir todo" })}</Link>} /><div className="mt-4 space-y-3">{near.length ? near.map((item) => <div key={`${item.eventId}-${item.selection}`} className="rounded-xl border border-amber-400/20 bg-amber-400/7 p-3"><div className="flex items-center justify-between gap-3"><div><div className="font-black text-[var(--sc-text)]">{item.match}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{item.selection} · {tr({ fi: "puuttuva portti", en: "missing gate", es: "filtro faltante" })}: <strong className="text-amber-200">{item.intelligenceV2?.nearPlayGate}</strong></div></div><DecisionBadge decision={item.decision} /></div></div>) : <div className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Ei Near PLAY -kohteita juuri nyt.", en: "No Near PLAY picks right now.", es: "No hay Near PLAY ahora." })}</div>}</div></div>

      <div className="sc-surface rounded-[1.5rem] p-5"><SectionHeader title={tr({ fi: "Uusimmat seurannan muutokset", en: "Latest monitored changes", es: "Cambios recientes" })} description={tr({ fi: "Näkyy vain kirjautuneelle käyttäjälle nykyisestä Alert Inboxista.", en: "Visible only to the signed-in user from the current Alert Inbox.", es: "Visible solo al usuario con sesión desde Alert Inbox." })} action={<Link href="/alerts" className="sc-button-secondary">Alert Inbox</Link>} /><div className="mt-4 space-y-3">{latestAlerts.length ? latestAlerts.map((item) => <article key={item.id || item.fingerprint} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="flex items-center justify-between gap-2"><div className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--sc-faint)]">{item.severity || "info"}</div><time className="text-[10px] text-[var(--sc-faint)]">{timeLabel(item.last_seen_at || item.updated_at, locale)}</time></div><div className="mt-1 font-black text-[var(--sc-text)]">{item.title}</div><div className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">{item.message}</div></article>) : <div className="text-sm text-[var(--sc-muted)]">{alerts ? tr({ fi: "Ei aktiivisia muutoksia juuri nyt.", en: "No active monitored changes right now.", es: "No hay cambios activos ahora." }) : tr({ fi: "Kirjaudu nähdäksesi henkilökohtaiset hälytykset.", en: "Sign in to see personal alerts.", es: "Inicia sesión para ver alertas personales." })}</div>}</div></div>
    </div>
  </section>;
}
