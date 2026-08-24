"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import { PageHero } from "../components/ProductUI";

const pct = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)}%` : "–";
const num = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";

function statusRank(level) {
  if (level === "usable") return 3;
  if (level === "provisional") return 2;
  return 1;
}

export default function BookmakerIntelligenceClient() {
  const { tr } = useLanguage();
  const [days, setDays] = useState("365");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/calibration?days=${encodeURIComponent(days)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Bookmaker evidence unavailable");
      setData(payload);
    } catch (nextError) {
      setData(null);
      setError(nextError instanceof Error ? nextError.message : "Bookmaker evidence unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [days]);

  const rows = useMemo(() => [...(data?.slices?.bookmaker || [])].sort((a, b) => {
    const status = statusRank(b.sampleStatus?.level) - statusRank(a.sampleStatus?.level);
    if (status) return status;
    const clvA = Number.isFinite(Number(a.averagePriceClv)) ? Number(a.averagePriceClv) : -999;
    const clvB = Number.isFinite(Number(b.averagePriceClv)) ? Number(b.averagePriceClv) : -999;
    return clvB - clvA || Number(b.count || 0) - Number(a.count || 0);
  }), [data]);

  return (
    <div className="space-y-7">
      <PageHero
        tone="sky"
        eyebrow="Bookmaker Intelligence V1"
        title={tr({ fi: "Missä oma paperiprosessisi on saanut parhaan hinnan?", en: "Where has your paper process received the best price?", es: "¿Dónde ha recibido tu proceso paper el mejor precio?" })}
        description={tr({ fi: "Vertailu käyttää vain oman Scorecaster-paperihistoriasi closing-line-evidenssiä. Se ei väitä vedonvälittäjää yleisesti hyväksi tai huonoksi eikä muuta Recommendation Engine -päätöksiä.", en: "This comparison uses only closing-line evidence from your own Scorecaster paper history. It does not claim a bookmaker is globally good or bad and never changes Recommendation Engine decisions.", es: "La comparación usa solo evidencia de cierre de tu historial paper. No califica globalmente a una casa ni cambia decisiones." })}
        actions={<><select className="sc-input" value={days} onChange={(event) => setDays(event.target.value)}><option value="90">90d</option><option value="365">365d</option><option value="730">730d</option><option value="1825">5y</option></select><button className="sc-button-primary" onClick={() => void load()} disabled={loading}>{loading ? "…" : tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button><Link href="/calibration" className="sc-button-secondary">Calibration</Link></>}
        aside={<div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Bookmakers</div><div className="mt-2 text-4xl font-black text-[var(--sc-text)]">{rows.length}</div><div className="text-sm text-[var(--sc-muted)]">with paper evidence</div></div>}
      />

      {error && <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{error} {/auth|sign|session/i.test(error) && <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link>}</div>}

      {!error && rows.length === 0 && !loading && <div className="sc-surface rounded-2xl p-5 text-sm text-[var(--sc-muted)]">{tr({ fi: "Riittävää ratkaistua paperi-/closing-dataa ei vielä ole bookmaker-vertailuun.", en: "There is not yet enough settled paper/closing data for bookmaker comparison.", es: "Aún no hay suficientes datos paper/cierre para comparar casas." })}</div>}

      <section className="grid gap-4 xl:grid-cols-2">
        {rows.map((row) => {
          const usable = row.sampleStatus?.level === "usable";
          const provisional = row.sampleStatus?.level === "provisional";
          return (
            <article key={row.name} className="sc-surface rounded-[1.6rem] p-5">
              <div className="flex items-start justify-between gap-3">
                <div><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">{usable ? "USABLE SAMPLE" : provisional ? "PROVISIONAL" : "COLLECTING"}</div><h2 className="mt-1 text-xl font-black text-[var(--sc-text)]">{row.name}</h2></div>
                <div className="text-right text-xs text-[var(--sc-muted)]">n={row.count || 0}<br />received={row.received || 0}</div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Price CLV</div><div className="text-lg font-black text-[var(--sc-text)]">{pct(row.averagePriceClv)}</div></div>
                <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Positive CLV</div><div className="text-lg font-black text-[var(--sc-text)]">{pct(row.positivePriceClvRate)}</div></div>
                <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Brier</div><div className="text-lg font-black text-[var(--sc-text)]">{num(row.brierScore)}</div></div>
                <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Yield</div><div className="text-lg font-black text-[var(--sc-text)]">{pct(row.yield)}</div></div>
              </div>
              {!usable && <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Otos ei riitä vahvaan bookmaker-päätelmään. Järjestys on tutkimusnäkymä, ei tuotannon päätösportti.", en: "The sample is not sufficient for a strong bookmaker conclusion. Ordering is research-only, not a production decision gate.", es: "La muestra no permite una conclusión fuerte. El orden es solo investigación." })}</div>}
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-xs leading-5 text-[var(--sc-muted)]">personal paper history only · closing-line evidence · decisionUpgradeAllowed=false · realMoneyActionAvailable=false</section>
    </div>
  );
}
