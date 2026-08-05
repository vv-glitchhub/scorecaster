"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../components/LanguageProvider";

const pct = (value, digits = 1) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";
const signed = (value) => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? "+" : ""}${(Number(value) * 100).toFixed(1)} pp` : "–";

function probabilityRows(result) {
  return ["home", "draw", "away"].map((key) => ({
    key,
    before: result?.before?.probabilities?.[key],
    after: result?.after?.probabilities?.[key],
    delta: result?.probabilityDelta?.[key]
  }));
}

export default function EventContextPanel({ eventId, sport }) {
  const { tr } = useLanguage();
  const [state, setState] = useState({ loading: true, detail: null, result: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const detailQuery = new URLSearchParams({ eventId, sport });
        const detailResponse = await fetch(`/api/event-detail?${detailQuery}`, { cache: "no-store" });
        const detailPayload = await detailResponse.json();
        if (!detailResponse.ok || !detailPayload?.detail) throw new Error(detailPayload?.error || "Event detail unavailable");
        const detail = detailPayload.detail;
        const kickoff = detail.commenceTime || detail.kickoffAt;
        if (!detail.homeTeam || !detail.awayTeam || !kickoff) throw new Error("Event identity is incomplete");

        const contextQuery = new URLSearchParams({
          eventId: detail.eventId || eventId,
          home: detail.homeTeam,
          away: detail.awayTeam,
          kickoff
        });
        const contextResponse = await fetch(`/api/context?${contextQuery}`, { cache: "no-store" });
        const contextPayload = await contextResponse.json();
        if (!contextResponse.ok) throw new Error(contextPayload?.error || contextPayload?.reason || "Context unavailable");
        if (!cancelled) setState({ loading: false, detail, result: contextPayload, error: "" });
      } catch (error) {
        if (!cancelled) setState({ loading: false, detail: null, result: null, error: error instanceof Error ? error.message : "Context unavailable" });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [eventId, sport]);

  const rows = useMemo(() => probabilityRows(state.result), [state.result]);

  if (state.loading) {
    return <section className="sc-surface rounded-[1.65rem] p-5 text-sm text-[var(--sc-muted)]">{tr({ fi: "Ladataan ottelun kontekstia…", en: "Loading match context…", es: "Cargando el contexto…" })}</section>;
  }

  if (!state.result) {
    return (
      <section className="sc-surface rounded-[1.65rem] border border-amber-400/20 p-5">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Context Engine</div>
        <h2 className="mt-2 text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Kontekstiarvio ei ole vielä saatavilla", en: "Context preview is not available yet", es: "La vista de contexto aún no está disponible" })}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">{state.error}. {tr({ fi: "Scorecaster ei korvaa puuttuvaa kokoonpano- tai loukkaantumistietoa arvauksella.", en: "Scorecaster does not replace missing lineup or injury evidence with guesses.", es: "Scorecaster no sustituye datos ausentes por suposiciones." })}</p>
        <Link href="/context" className="mt-4 inline-flex font-black text-[var(--sc-brand)]">{tr({ fi: "Avaa Context Engine", en: "Open Context Engine", es: "Abrir Context Engine" })}</Link>
      </section>
    );
  }

  const result = state.result;
  const accepted = result.evidence?.accepted?.length || 0;
  const conflicts = result.evidence?.conflicts?.length || 0;
  const quality = result.evidence?.evidenceQuality;
  const query = new URLSearchParams({
    eventId: result.eventId,
    home: state.detail?.homeTeam || "",
    away: state.detail?.awayTeam || "",
    kickoff: result.kickoffAt || ""
  });

  return (
    <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Context Engine V1</div>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[var(--sc-text)]">{tr({ fi: "Todennäköisyys ennen ja jälkeen vahvistetun kontekstin", en: "Probability before and after verified context", es: "Probabilidad antes y después del contexto verificado" })}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Kokoonpanot, poissaolot, lepo, matkustus, sää ja toimitsijat vaikuttavat vain rajattuun herkkyysesikatseluun. Tämä osio ei voi yksin nostaa kohdetta PLAY-luokkaan.", en: "Lineups, absences, rest, travel, weather and officials affect only a bounded sensitivity preview. This section cannot promote PLAY by itself.", es: "Las alineaciones, bajas, descanso, viaje, clima y árbitros solo afectan una vista limitada." })}</p>
        </div>
        <div className={`rounded-full px-3 py-1.5 text-xs font-black uppercase ${result.contextStatus === "available" ? "bg-emerald-400/15 text-emerald-200" : result.contextStatus === "conflicted" ? "bg-rose-400/15 text-rose-200" : "bg-amber-400/15 text-amber-200"}`}>{result.contextStatus}</div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.key} className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{row.key}</div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div><div className="text-xs text-[var(--sc-faint)]">before</div><div className="text-xl font-black">{pct(row.before)}</div></div>
              <div className="text-right"><div className="text-xs text-[var(--sc-faint)]">after</div><div className="text-xl font-black">{pct(row.after)}</div></div>
            </div>
            <div className="mt-2 text-sm font-black text-[var(--sc-brand)]">{signed(row.delta)}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-[var(--sc-surface-soft)] p-3 text-sm"><span className="text-[var(--sc-faint)]">Evidence</span><div className="font-black">{accepted}</div></div>
        <div className="rounded-xl bg-[var(--sc-surface-soft)] p-3 text-sm"><span className="text-[var(--sc-faint)]">Conflicts</span><div className="font-black">{conflicts}</div></div>
        <div className="rounded-xl bg-[var(--sc-surface-soft)] p-3 text-sm"><span className="text-[var(--sc-faint)]">Quality</span><div className="font-black">{pct(quality)}</div></div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/context?${query}`} className="sc-button-secondary">{tr({ fi: "Avaa koko kontekstiauditointi", en: "Open full context audit", es: "Abrir auditoría completa" })}</Link>
        <Link href={`/xray?home=${encodeURIComponent(state.detail?.homeTeam || "")}&away=${encodeURIComponent(state.detail?.awayTeam || "")}`} className="sc-button-ghost">Match X-Ray</Link>
      </div>
    </section>
  );
}
