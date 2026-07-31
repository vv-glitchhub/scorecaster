"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { MetricTile, SectionHeader, TrustBar } from "../components/ProductUI";
import { getTrackedBets } from "../../lib/tracking-storage";
import { calculateTrackingStats } from "../../lib/tracking-engine";
import { getSettings, saveSettings } from "../../lib/settings-storage";

const percent = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)} %` : "–";

function buildCoach(stats, tr) {
  const messages = [];
  if (!stats.totalBets) {
    messages.push(tr({
      fi: "Aloita pienellä otoksella: lisää 3–5 paperikohdetta ja kirjaa jokainen lopputulos.",
      en: "Start with a small sample: add 3–5 paper picks and record every result.",
      es: "Empieza con una muestra pequeña: añade 3–5 pronósticos simulados y registra cada resultado."
    }));
    return messages;
  }
  if (stats.settledBets < 20) messages.push(tr({
    fi: `Otos on vielä pieni (${stats.settledBets}/20 ratkaistua). Älä tee vahvoja johtopäätöksiä ROI:sta vielä.`,
    en: `The sample is still small (${stats.settledBets}/20 settled). Do not draw strong ROI conclusions yet.`,
    es: `La muestra aún es pequeña (${stats.settledBets}/20 resueltos). No saques conclusiones fuertes del ROI todavía.`
  }));
  if (stats.averageCLV > 0) messages.push(tr({
    fi: "Keskimääräinen CLV on positiivinen. Prosessi löytää keskimäärin markkinan myöhempää päätöshintaa paremman hinnan.",
    en: "Average CLV is positive. The process is finding prices that are better than the later closing market on average.",
    es: "El CLV medio es positivo. El proceso encuentra cuotas mejores que el cierre del mercado en promedio."
  }));
  if (stats.averageOdds > 3) messages.push(tr({
    fi: "Keskimääräinen kerroin on korkea, joten tulosvaihtelu voi olla suurta. Tarkista, ettei salkku painotu liikaa epätodennäköisiin kohteisiin.",
    en: "Average odds are high, so variance can be large. Check that the portfolio is not overly concentrated in unlikely outcomes.",
    es: "La cuota media es alta, por lo que la varianza puede ser grande. Revisa que la cartera no se concentre demasiado en resultados improbables."
  }));
  if (stats.roi < 0 && stats.averageCLV <= 0 && stats.settledBets >= 10) messages.push(tr({
    fi: "Sekä ROI että CLV ovat heikot. Pienennä paperipanoksia ja seuraa vain kohteita, joiden data- ja lähdeportit täyttyvät.",
    en: "Both ROI and CLV are weak. Reduce paper stakes and track only observations that pass the data and source gates.",
    es: "Tanto el ROI como el CLV son débiles. Reduce los importes simulados y sigue solo observaciones que superen los filtros de datos y fuentes."
  }));
  if (!messages.length) messages.push(tr({
    fi: "Jatka samaa prosessia: kirjaa päätöshetken kerroin, lopputulos ja päätöskerroin jokaiselle paperikohteelle.",
    en: "Keep the process consistent: record entry odds, result and closing odds for every paper pick.",
    es: "Mantén el proceso: registra cuota inicial, resultado y cuota de cierre para cada pronóstico simulado."
  }));
  return messages.slice(0, 3);
}

export default function ProfileOverviewClient({ signedIn = false, email = "", authConfigured = true }) {
  const { tr, locale } = useLanguage();
  const [bets, setBets] = useState([]);
  const [bankroll, setBankroll] = useState(1000);
  const [kellyMode, setKellyMode] = useState("quarter");
  const [maxStakePercent, setMaxStakePercent] = useState(2);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBets(getTrackedBets());
    const settings = getSettings();
    setBankroll(Number(settings.bankroll || 1000));
    setKellyMode(settings.kellyMode || "quarter");
    setMaxStakePercent(Number(settings.maxStakePercent || 2));
  }, []);

  const stats = useMemo(() => calculateTrackingStats(bets), [bets]);
  const coach = useMemo(() => buildCoach(stats, tr), [stats, tr]);
  const money = (value) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));

  function persist() {
    saveSettings({ ...getSettings(), bankroll, kellyMode, maxStakePercent });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-7">
      <section className="rounded-[1.75rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">{tr({ fi: "Oma Scorecaster", en: "My Scorecaster", es: "Mi Scorecaster" })}</div>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-[var(--sc-text)] sm:text-4xl">{tr({ fi: "Tulokset, asetukset ja AI Coach", en: "Results, settings and AI Coach", es: "Resultados, ajustes y AI Coach" })}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--sc-muted)]">{tr({ fi: "Paikallinen paperiseuranta toimii myös ilman kirjautumista. Kirjautuminen tarvitaan vain pilvisynkronointiin ja käyttäjäkohtaisiin verkkotoimintoihin.", en: "Local paper tracking works without signing in. Authentication is only required for cloud sync and account-specific online features.", es: "El seguimiento local funciona sin iniciar sesión. La autenticación solo se necesita para sincronización y funciones de cuenta." })}</p>
          </div>
          <div className={`rounded-2xl border px-4 py-3 text-sm font-black ${signedIn ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-amber-400/25 bg-amber-400/10 text-amber-100"}`}>
            {signedIn ? email || tr({ fi: "Kirjautunut", en: "Signed in", es: "Sesión iniciada" }) : authConfigured ? tr({ fi: "Paikallinen tila", en: "Local mode", es: "Modo local" }) : tr({ fi: "Pilvi ei ole määritetty", en: "Cloud not configured", es: "Nube no configurada" })}
          </div>
        </div>
      </section>

      <TrustBar items={[
        { label: tr({ fi: "Tallennus", en: "Storage", es: "Almacenamiento" }), value: tr({ fi: "tämä laite", en: "this device", es: "este dispositivo" }), tone: "info" },
        { label: tr({ fi: "Kohteita", en: "Picks", es: "Pronósticos" }), value: stats.totalBets },
        { label: tr({ fi: "Ratkaistu", en: "Settled", es: "Resueltos" }), value: stats.settledBets },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: "paper only", tone: "warning" }
      ]} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label={tr({ fi: "Paperitulos", en: "Paper result", es: "Resultado simulado" })} value={money(stats.totalProfit)} tone={stats.totalProfit >= 0 ? "green" : "red"} />
        <MetricTile label="ROI" value={percent(stats.roi)} tone={stats.roi >= 0 ? "green" : "red"} />
        <MetricTile label="CLV" value={percent(stats.averageCLV)} tone={stats.averageCLV >= 0 ? "green" : "red"} />
        <MetricTile label={tr({ fi: "Osumaprosentti", en: "Win rate", es: "Acierto" })} value={percent(stats.winRate)} tone="blue" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="rounded-[1.75rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
          <SectionHeader eyebrow="AI Coach" title={tr({ fi: "Mitä datasi kertoo juuri nyt", en: "What your data says right now", es: "Qué dicen tus datos ahora" })} description={tr({ fi: "Coach käyttää vain tämän laitteen paperihistoriaa eikä lupaa tuottoa.", en: "The coach uses only this device's paper history and never promises returns.", es: "El coach usa solo el historial simulado de este dispositivo y no promete ganancias." })} />
          <div className="space-y-3">
            {coach.map((message, index) => <div key={`${index}-${message}`} className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm leading-6 text-[var(--sc-text-secondary)]"><span className="mr-2 font-black text-[var(--sc-brand)]">{index + 1}.</span>{message}</div>)}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Link href="/tracking" className="sc-button-primary text-center">{tr({ fi: "Omat vedot", en: "My picks", es: "Mis pronósticos" })}</Link>
            <Link href="/events" className="sc-button-secondary text-center">{tr({ fi: "Etsi kohteita", en: "Find picks", es: "Buscar pronósticos" })}</Link>
            <Link href="/transparency" className="sc-button-secondary text-center">{tr({ fi: "Kaavat", en: "Formulas", es: "Fórmulas" })}</Link>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">{tr({ fi: "Paperiasetukset", en: "Paper settings", es: "Ajustes simulados" })}</div>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Paperikassa (€)", en: "Paper bankroll (€)", es: "Banca simulada (€)" })}<input type="number" min="0" value={bankroll} onChange={(event) => setBankroll(Number(event.target.value || 0))} className="sc-input mt-2" /></label>
            <label className="block text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Panosmalli", en: "Stake model", es: "Modelo de importe" })}<select value={kellyMode} onChange={(event) => setKellyMode(event.target.value)} className="sc-input mt-2"><option value="conservative">{tr({ fi: "Erittäin varovainen", en: "Very conservative", es: "Muy conservador" })}</option><option value="quarter">Quarter Kelly</option><option value="half">Half Kelly</option><option value="full">Full Kelly</option></select></label>
            <label className="block text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Enimmäispanos (%)", en: "Maximum stake (%)", es: "Importe máximo (%)" })}<input type="number" min="0.1" max="10" step="0.1" value={maxStakePercent} onChange={(event) => setMaxStakePercent(Number(event.target.value || 2))} className="sc-input mt-2" /></label>
            <button type="button" onClick={persist} className="sc-button-primary w-full">{saved ? tr({ fi: "Tallennettu", en: "Saved", es: "Guardado" }) : tr({ fi: "Tallenna asetukset", en: "Save settings", es: "Guardar ajustes" })}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
