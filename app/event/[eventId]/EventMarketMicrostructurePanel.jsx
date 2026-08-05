"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../components/LanguageProvider";

const decimal = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "–";
const pp = (value) => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? "+" : ""}${(Number(value) * 100).toFixed(1)} pp` : "–";

function Summary({ item, tr }) {
  return (
    <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div><div className="font-black text-[var(--sc-text)]">{item.selection}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{item.movement?.causeLabel}</div></div>
        <span className="rounded-full border border-[var(--sc-border)] px-3 py-1 text-xs font-black text-[var(--sc-text-secondary)]">{item.movement?.direction || "stable"}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Open</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">{decimal(item.opening?.averagePrice)}</div></div>
        <div><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Current</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">{decimal(item.current?.averagePrice)}</div></div>
        <div><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Δ p</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">{pp(item.movement?.probabilityChange)}</div></div>
      </div>
      <div className="mt-4 text-xs leading-5 text-[var(--sc-muted)]">{item.current?.providerCount || 0} eligible providers · {(item.movement?.staleProviders || []).length} stale · {(item.movement?.outlierProviders || []).length} outlier</div>
      {item.closing === null && <div className="mt-3 rounded-xl border border-[var(--sc-border)] px-3 py-2 text-xs text-[var(--sc-muted)]">{tr({ fi: "Closing line on lukittu ennen ottelun alkua.", en: "Closing line is locked before kickoff.", es: "El cierre está bloqueado antes del inicio." })}</div>}
    </div>
  );
}

export default function EventMarketMicrostructurePanel({ eventId }) {
  const { tr } = useLanguage();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const query = new URLSearchParams({ eventId, market: "h2h" });
        const response = await fetch(`/api/market-microstructure?${query}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Market evidence unavailable");
        if (active) { setPayload(data); setError(""); }
      } catch (loadError) {
        if (active) { setPayload(null); setError(loadError instanceof Error ? loadError.message : "Market evidence unavailable"); }
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [eventId]);

  const selections = useMemo(() => (payload?.selections || []).slice(0, 3), [payload]);

  return (
    <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Market Microstructure V2</div>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-[var(--sc-text)]">{tr({ fi: "Avaus, nykyhinta ja liikkeen laajuus", en: "Opening, current price and movement breadth", es: "Apertura, precio actual y amplitud" })}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sc-text-secondary)]">{tr({ fi: "Tarjoajakohtainen no-vig-auditointi erottaa aidosti samanaikaisen liikkeen vanhentuneesta tai yksittäisestä poikkeamasta. Liikkeen aiheuttajaa ei arvata.", en: "Provider-level no-vig evidence separates synchronized movement from stale or isolated feeds. The cause is not guessed.", es: "La evidencia separa movimientos sincronizados de datos obsoletos." })}</p>
        </div>
        <Link href={`/market-microstructure?eventId=${encodeURIComponent(eventId)}`} className="sc-button-secondary">{tr({ fi: "Avaa koko auditointi", en: "Open full audit", es: "Abrir auditoría" })}</Link>
      </div>

      {loading && <div className="mt-5 text-sm text-[var(--sc-muted)]">{tr({ fi: "Ladataan hintahistoriaa…", en: "Loading price history…", es: "Cargando historial…" })}</div>}
      {!loading && error && <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">{error}</div>}
      {!loading && !error && payload?.status === "missing" && <div className="mt-5 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Varmennettua tarjoajahistoriaa ei ole vielä. Puuttuvaa liike-evidenssiä ei korvata AI-arvauksella.", en: "Verified provider history is not available yet. Missing movement evidence is not replaced with an AI guess.", es: "Aún no hay historial verificado." })}</div>}
      {selections.length > 0 && <div className="mt-5 grid gap-3 lg:grid-cols-3">{selections.map((item) => <Summary key={item.selection} item={item} tr={tr} />)}</div>}

      <div className="mt-5 text-xs leading-5 text-[var(--sc-faint)]">sharpMoneyClaim=false · closingUsedByPrematchModel=false · source: {payload?.sourceAttribution || "The Odds API normalized prices"}</div>
    </section>
  );
}
