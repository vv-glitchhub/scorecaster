"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import ProfessionalPreferenceControls from "./ProfessionalPreferenceControls";
import ProfessionalSelectionCard from "./ProfessionalSelectionCard";
import { useProfessionalPreferences } from "./ProfessionalPreferencesProvider";

const SURFACE_TEXT = Object.freeze({
  today: {
    eyebrow: { fi: "Yhteinen päätöskortti", en: "Shared decision card", es: "Tarjeta de decisión compartida" },
    title: { fi: "Päivän luotetuin nykyinen kohde", en: "Today's strongest current selection", es: "La selección actual más sólida" },
    description: { fi: "Sama provider, hinta, todennäköisyys, EV, riski ja päätös näkyvät myös AI Feedissä ja Otteluissa.", en: "The same provider, price, probability, EV, risk and decision are used in AI Feed and Matches.", es: "El mismo proveedor, cuota, probabilidad, EV y riesgo se usan en todas las vistas." }
  },
  feed: {
    eyebrow: { fi: "AI Feed · päätösankkuri", en: "AI Feed · decision anchor", es: "AI Feed · ancla de decisión" },
    title: { fi: "Nykyinen kohde ennen evidenssipäivityksiä", en: "Current selection before evidence updates", es: "Selección actual antes de actualizaciones" },
    description: { fi: "Feed kertoo muutokset. Tämä yhteinen kortti näyttää nykyisen hinnan ja päätöksen ilman erillistä laskentaa.", en: "The feed explains changes. This shared card shows the current price and decision without a separate calculation.", es: "El feed explica cambios; esta tarjeta muestra la decisión actual." }
  },
  events: {
    eyebrow: { fi: "Ottelut · yhteinen vertailu", en: "Matches · shared comparison", es: "Partidos · comparación compartida" },
    title: { fi: "Provider-asetuksellasi arvioitu kohde", en: "Selection evaluated with your provider setting", es: "Selección evaluada con tu proveedor" },
    description: { fi: "Vedonvälittäjä vaihtaa vain tarjottua hintaa. Mallin arvio ja markkinan no-vig pysyvät erillään.", en: "The provider changes only the offered price. Model probability and no-vig market consensus stay separate.", es: "El proveedor solo cambia la cuota ofrecida." }
  }
});

export default function ProfessionalSurfaceRail({ surface = "today", compact = false, limit = 1 }) {
  const { tr } = useLanguage();
  const { bookmakerLabel, proMode } = useProfessionalPreferences();
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const copy = SURFACE_TEXT[surface] || SURFACE_TEXT.today;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/top-picks", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Current verified selections are unavailable");
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setPicks(rows.filter((row) => String(row.productDecision || row.decision || "").toUpperCase() !== "SKIP").slice(0, Math.max(1, Math.min(3, limit))));
    } catch (reason) {
      setPicks([]);
      setError(reason instanceof Error ? reason.message : "Current verified selections are unavailable");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { void load(); }, [load]);

  const providerNote = useMemo(() => `${bookmakerLabel} · ${proMode ? "Pro Mode" : tr({ fi: "selkeä tila", en: "simple mode", es: "modo simple" })}`, [bookmakerLabel, proMode, tr]);

  return (
    <section className={`rounded-[1.8rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] ${compact ? "p-4" : "p-5 sm:p-6"}`} data-professional-surface={surface}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">{tr(copy.eyebrow)}</div>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[var(--sc-text)] sm:text-3xl">{tr(copy.title)}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--sc-text-secondary)]">{tr(copy.description)}</p>
          <div className="mt-3 text-xs font-black text-[var(--sc-muted)]">{providerNote}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="sc-button-secondary disabled:opacity-40">{loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button>
          <Link href="/betting" className="sc-button-secondary">{tr({ fi: "Kaikki kohteet", en: "All selections", es: "Todas las selecciones" })}</Link>
        </div>
      </div>

      <ProfessionalPreferenceControls compact className="mt-5" />
      {error && <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">{error}</div>}
      {!loading && !error && picks.length === 0 && <div className="mt-4 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Nykyisestä varmennetusta datasta ei löytynyt PLAY- tai WATCH-kohdetta. Puuttuvaa kohdetta ei keksitä.", en: "No PLAY or WATCH selection is available from current verified data. Missing selections are not invented.", es: "No hay selección verificada disponible; no se inventan datos." })}</div>}
      {picks.length > 0 && <div className={`mt-5 grid gap-4 ${picks.length > 1 ? "xl:grid-cols-2" : ""}`}>{picks.map((pick, index) => <ProfessionalSelectionCard key={`${pick.gameId || pick.eventId || pick.id || "pick"}:${pick.selection || index}`} compact={compact} selection={pick} eventId={pick.gameId || pick.eventId || pick.id} match={pick.match} homeTeam={pick.homeTeam} awayTeam={pick.awayTeam} league={pick.leagueTitle || pick.league} commenceTime={pick.commenceTime || pick.commence_time} />)}</div>}
    </section>
  );
}

export function ProfessionalPortfolioRail() {
  const { tr } = useLanguage();
  return <section className="rounded-[1.8rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-5 sm:p-6" data-professional-surface="tracking"><div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">Paper Portfolio · professional process</div><h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[var(--sc-text)]">{tr({ fi: "Sama hintalähde koko päätös- ja jälkiarvioinnissa", en: "One provider preference across decision and review", es: "Un proveedor en decisión y evaluación" })}</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--sc-text-secondary)]">{tr({ fi: "Paperisalkku arvioi lopputuloksen lisäksi CLV:n, kalibraation, korrelaation ja drawdownin. Pro Mode avaa samojen laskelmien auditoinnin.", en: "The paper portfolio reviews CLV, calibration, correlation and drawdown alongside outcomes. Pro Mode reveals the audit of the same calculations.", es: "La cartera revisa CLV, calibración, correlación y drawdown." })}</p><ProfessionalPreferenceControls compact className="mt-5" /><div className="mt-5 flex flex-wrap gap-3"><Link href="/calibration" className="sc-button-secondary">CLV & Calibration</Link><Link href="/risk-lab" className="sc-button-secondary">Risk Lab</Link><Link href="/coach" className="sc-button-secondary">AI Coach</Link></div></section>;
}

export function ProfessionalProfileRail() {
  const { tr } = useLanguage();
  return <section className="rounded-[1.8rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-5 sm:p-6" data-professional-surface="profile"><div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">Profile · professional preferences</div><h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[var(--sc-text)]">{tr({ fi: "Yksi provider- ja näyttöasetus kaikille pinnoille", en: "One provider and display setting for every surface", es: "Un proveedor y nivel de detalle en todas las vistas" })}</h2><ProfessionalPreferenceControls className="mt-5" /></section>;
}
