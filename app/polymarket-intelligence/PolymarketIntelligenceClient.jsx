"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

function percent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)}%` : "–";
}

function money(value, locale) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "–";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(number);
}

function dateTime(value, locale) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function confidenceTone(value) {
  if (Number(value) >= 0.85) return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (Number(value) >= 0.7) return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
  return "border-slate-400/20 bg-slate-400/10 text-slate-300";
}

export default function PolymarketIntelligenceClient() {
  const { tr, locale } = useLanguage();
  const [form, setForm] = useState({ home: "", away: "", sport: "", league: "", commenceTime: "" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const copy = useMemo(() => ({
    title: tr({ fi: "Polymarket Intelligence", en: "Polymarket Intelligence", es: "Inteligencia de Polymarket" }),
    subtitle: tr({
      fi: "Julkinen markkinadata lisäriskisignaalina — ei lompakkoa, kaupankäyntiä tai tulosten ratkaisemista.",
      en: "Public market data as a secondary risk signal — no wallet, trading or result settlement.",
      es: "Datos públicos de mercado como señal secundaria de riesgo, sin cartera, operaciones ni liquidación de resultados."
    }),
    home: tr({ fi: "Kotijoukkue", en: "Home team", es: "Equipo local" }),
    away: tr({ fi: "Vierasjoukkue", en: "Away team", es: "Equipo visitante" }),
    sport: tr({ fi: "Laji tai sport-avain", en: "Sport or sport key", es: "Deporte o clave" }),
    league: tr({ fi: "Liiga", en: "League", es: "Liga" }),
    kickoff: tr({ fi: "Ottelun alkuaika", en: "Kickoff time", es: "Hora de inicio" }),
    search: tr({ fi: "Hae Polymarket-data", en: "Load Polymarket data", es: "Cargar datos de Polymarket" }),
    searching: tr({ fi: "Haetaan…", en: "Loading…", es: "Cargando…" }),
    noMatch: tr({
      fi: "Täsmällistä aktiivista Polymarket-markkinaa ei löytynyt. Tämä on normaali ja turvallinen tulos.",
      en: "No exact active Polymarket market was found. This is a normal and safe outcome.",
      es: "No se encontró un mercado activo exacto de Polymarket. Es un resultado normal y seguro."
    })
  }), [tr]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const params = new URLSearchParams({
        home: form.home.trim(),
        away: form.away.trim()
      });
      if (form.sport.trim()) params.set("sport", form.sport.trim());
      if (form.league.trim()) params.set("league", form.league.trim());
      if (form.commenceTime) params.set("commenceTime", new Date(form.commenceTime).toISOString());

      const response = await fetch(`/api/cloud/polymarket-intelligence?${params.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Polymarket data could not be loaded");
      setResult(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.noMatch);
    } finally {
      setLoading(false);
    }
  }

  const markets = Array.isArray(result?.data) ? result.data : [];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-sm font-black text-purple-300">
          Polymarket Intelligence V1
        </div>
        <h1 className="mt-3 text-4xl font-black tracking-tight">{copy.title}</h1>
        <p className="mt-3 max-w-4xl text-slate-300">{copy.subtitle}</p>
        <div className="mt-4 grid gap-2 text-sm text-slate-400 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">✓ {tr({ fi: "Julkinen Gamma API", en: "Public Gamma API", es: "API Gamma pública" })}</div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">✓ {tr({ fi: "Vain päätöksen heikennys", en: "Downgrade only", es: "Solo rebaja decisiones" })}</div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">✕ {tr({ fi: "Ei lompakkoa tai kauppoja", en: "No wallet or orders", es: "Sin cartera ni órdenes" })}</div>
        </div>
      </section>

      <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2 text-sm font-bold text-slate-300">
            <span>{copy.home}</span>
            <input required value={form.home} onChange={(event) => update("home", event.target.value)} maxLength={120} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-purple-400/50" placeholder="Boston Celtics" />
          </label>
          <label className="space-y-2 text-sm font-bold text-slate-300">
            <span>{copy.away}</span>
            <input required value={form.away} onChange={(event) => update("away", event.target.value)} maxLength={120} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-purple-400/50" placeholder="New York Knicks" />
          </label>
          <label className="space-y-2 text-sm font-bold text-slate-300">
            <span>{copy.sport}</span>
            <input value={form.sport} onChange={(event) => update("sport", event.target.value)} maxLength={120} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-purple-400/50" placeholder="basketball_nba" />
          </label>
          <label className="space-y-2 text-sm font-bold text-slate-300">
            <span>{copy.league}</span>
            <input value={form.league} onChange={(event) => update("league", event.target.value)} maxLength={120} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-purple-400/50" placeholder="NBA" />
          </label>
          <label className="space-y-2 text-sm font-bold text-slate-300">
            <span>{copy.kickoff}</span>
            <input type="datetime-local" value={form.commenceTime} onChange={(event) => update("commenceTime", event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-purple-400/50" />
          </label>
        </div>
        <button disabled={loading} className="mt-5 rounded-xl bg-purple-400 px-5 py-3 font-black text-slate-950 transition hover:bg-purple-300 disabled:opacity-50">
          {loading ? copy.searching : copy.search}
        </button>
      </form>

      {error && <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</div>}

      {result && (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-sm text-slate-400">{tr({ fi: "Tila", en: "Mode", es: "Modo" })}</div><div className="mt-2 text-xl font-black text-white">{result.mode}</div></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-sm text-slate-400">{tr({ fi: "Täsmätyt markkinat", en: "Matched markets", es: "Mercados coincidentes" })}</div><div className="mt-2 text-xl font-black text-white">{result.count || 0}</div></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-sm text-slate-400">{tr({ fi: "Kaupankäynti", en: "Trading", es: "Operaciones" })}</div><div className="mt-2 text-xl font-black text-emerald-300">{tr({ fi: "Pois käytöstä", en: "Disabled", es: "Desactivadas" })}</div></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-sm text-slate-400">{tr({ fi: "Tulosten lähde", en: "Result source", es: "Fuente de resultados" })}</div><div className="mt-2 text-xl font-black text-amber-300">{tr({ fi: "Ei", en: "No", es: "No" })}</div></div>
          </div>

          {markets.length === 0 ? (
            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5 text-yellow-100">{copy.noMatch}</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {markets.map((market) => (
                <article key={`${market.id}-${market.slug}`} className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-purple-300">{market.marketType || market.mapping}</div>
                      <h2 className="mt-2 text-xl font-black text-white">{market.title}</h2>
                      {market.eventTitle && <div className="mt-1 text-sm text-slate-400">{market.eventTitle}</div>}
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${confidenceTone(market.matchConfidence)}`}>
                      {tr({ fi: "Täsmäys", en: "Match", es: "Coincidencia" })} {percent(market.matchConfidence)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-500">{result.match?.homeTeam}</div><div className="mt-1 text-2xl font-black text-emerald-300">{percent(market.homeProbability)}</div></div>
                    <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-500">{result.match?.awayTeam}</div><div className="mt-1 text-2xl font-black text-sky-300">{percent(market.awayProbability)}</div></div>
                    <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-500">{tr({ fi: "Likviditeetti", en: "Liquidity", es: "Liquidez" })}</div><div className="mt-1 font-black text-white">{money(market.liquidity, locale)}</div></div>
                    <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-500">{tr({ fi: "Volyymi", en: "Volume", es: "Volumen" })}</div><div className="mt-1 font-black text-white">{money(market.volume, locale)}</div></div>
                  </div>

                  <div className="mt-4 space-y-1 text-xs text-slate-400">
                    <div>{tr({ fi: "Alkuaika", en: "Start", es: "Inicio" })}: {dateTime(market.startTime, locale)}</div>
                    <div>{tr({ fi: "Aikaero Scorecasteriin", en: "Time difference to Scorecaster", es: "Diferencia horaria con Scorecaster" })}: {market.timeDifferenceHours ?? "–"} h</div>
                    <div>{tr({ fi: "Hintakartoitus", en: "Price mapping", es: "Mapeo de precios" })}: {market.mapping}</div>
                  </div>

                  {market.url && <a href={market.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl border border-purple-400/30 bg-purple-400/10 px-4 py-2 text-sm font-black text-purple-200 hover:bg-purple-400/20">{tr({ fi: "Avaa markkina", en: "Open market", es: "Abrir mercado" })} ↗</a>}
                </article>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
            {tr({
              fi: "Polymarketin hinnat voivat perustua eri sääntöihin, sisältää viivettä tai puuttua kokonaan. Scorecaster ei käytä niitä ottelun virallisena tuloksena eikä muuta niiden perusteella laskettua markkinakonsensusta.",
              en: "Polymarket prices can use different rules, be delayed or be unavailable. Scorecaster never treats them as the official game result and does not replace its market consensus with them.",
              es: "Los precios de Polymarket pueden usar reglas distintas, retrasarse o no estar disponibles. Scorecaster nunca los trata como resultado oficial ni sustituye su consenso de mercado con ellos."
            })}
          </div>
        </section>
      )}
    </div>
  );
}
