"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import {
  compareRecommendationSnapshots,
  snapshotRecommendationFeed
} from "../../lib/recommendation-change-radar.mjs";

const SNAPSHOT_KEY = "scorecaster:recommendation-radar:v1";
const SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function percent(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)} %` : "–";
}

function odds(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number.toFixed(2) : "–";
}

function decisionTone(decision) {
  if (decision === "PLAY") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (decision === "CAUTION") return "border-amber-400/30 bg-amber-500/10 text-amber-100";
  return "border-slate-500/30 bg-slate-500/10 text-slate-200";
}

function reasonLabel(reason, tr) {
  if (!reason?.code) return "";
  if (reason.code === "positive-edge") return tr({ fi: `Positiivinen edge ${percent(reason.value)}`, en: `Positive edge ${percent(reason.value)}`, es: `Ventaja positiva ${percent(reason.value)}` });
  if (reason.code === "positive-ev") return tr({ fi: `Positiivinen EV ${percent(reason.value)}`, en: `Positive EV ${percent(reason.value)}`, es: `EV positivo ${percent(reason.value)}` });
  if (reason.code === "price-above-fair") return tr({ fi: `Markkinahinta ${odds(reason.odds)} ylittää reilun kertoimen ${odds(reason.fairOdds)}`, en: `Market price ${odds(reason.odds)} is above fair odds ${odds(reason.fairOdds)}`, es: `La cuota ${odds(reason.odds)} supera la cuota justa ${odds(reason.fairOdds)}` });
  if (reason.code === "market-coverage") return tr({ fi: `${reason.value} vedonvälittäjää konsensuksessa`, en: `${reason.value} bookmakers in consensus`, es: `${reason.value} casas en el consenso` });
  if (reason.code === "verified-evidence") return tr({ fi: "Riippumaton evidenssi varmennettu", en: "Independent evidence verified", es: "Evidencia independiente verificada" });
  if (reason.code === "fresh-data") return tr({ fi: "Markkinadata on tuoretta", en: "Market data is fresh", es: "Los datos están actualizados" });
  if (reason.code === "confidence") return tr({ fi: `Datan luottamus ${percent(reason.value)}`, en: `Data confidence ${percent(reason.value)}`, es: `Confianza de datos ${percent(reason.value)}` });
  return reason.code;
}

function gateLabel(gate, recommendation, tr) {
  if (!gate?.code) return tr({ fi: "Tarkista seuraava markkinapäivitys", en: "Check the next market update", es: "Comprueba la siguiente actualización" });
  if (gate.code === "maintain-play-gates") return tr({ fi: "PLAY-portit ovat auki – seuraa hinnan ja evidenssin säilymistä", en: "PLAY gates are open – monitor price and evidence", es: "Los filtros PLAY están abiertos: vigila cuota y evidencia" });
  if (gate.code === "fresh-data") return tr({ fi: "Tarvitaan tuoreempi markkinadata", en: "Fresher market data is required", es: "Se necesitan datos más recientes" });
  if (gate.code === "bookmaker-coverage") return tr({ fi: `Bookmaker-kattavuus ${gate.current || 0}/${gate.target || 4}`, en: `Bookmaker coverage ${gate.current || 0}/${gate.target || 4}`, es: `Cobertura de casas ${gate.current || 0}/${gate.target || 4}` });
  if (gate.code === "confidence") return tr({ fi: `Confidence ${percent(gate.current)} → tavoite ${percent(gate.target)}`, en: `Confidence ${percent(gate.current)} → target ${percent(gate.target)}`, es: `Confianza ${percent(gate.current)} → objetivo ${percent(gate.target)}` });
  if (gate.code === "edge") return tr({ fi: `Edge ${percent(gate.current)} → PLAY-hintaportti ${percent(gate.target)}`, en: `Edge ${percent(gate.current)} → PLAY price gate ${percent(gate.target)}`, es: `Ventaja ${percent(gate.current)} → filtro PLAY ${percent(gate.target)}` });
  if (gate.code === "ev") return tr({ fi: `EV ${percent(gate.current)} → tavoite ${percent(gate.target)}; vastaava kerroin noin ${odds(gate.minimumEvOdds || recommendation?.minimumEvOdds)}`, en: `EV ${percent(gate.current)} → target ${percent(gate.target)}; corresponding odds about ${odds(gate.minimumEvOdds || recommendation?.minimumEvOdds)}`, es: `EV ${percent(gate.current)} → objetivo ${percent(gate.target)}; cuota aproximada ${odds(gate.minimumEvOdds || recommendation?.minimumEvOdds)}` });
  if (gate.code === "verified-evidence") return tr({ fi: "Hinta- ja markkinaportit ovat riittävät, mutta riippumaton evidenssi pitää vielä varmentaa", en: "Price and market gates are sufficient, but independent evidence still needs verification", es: "Los filtros de precio y mercado son suficientes, pero falta verificar la evidencia independiente" });
  return tr({ fi: "Turvaportti vaatii uuden tarkistuksen", en: "The safety gate requires another check", es: "El filtro de seguridad requiere otra comprobación" });
}

function changeLabel(change, tr) {
  if (!change?.type) return "";
  if (change.type === "decision-upgrade") return tr({ fi: `Päätös vahvistui ${change.from} → ${change.to}`, en: `Decision strengthened ${change.from} → ${change.to}`, es: `La decisión mejoró ${change.from} → ${change.to}` });
  if (change.type === "decision-downgrade") return tr({ fi: `Päätös heikkeni ${change.from} → ${change.to}`, en: `Decision weakened ${change.from} → ${change.to}`, es: `La decisión empeoró ${change.from} → ${change.to}` });
  if (change.type === "evidence-upgrade") return tr({ fi: `Evidenssi vahvistui ${change.from} → ${change.to}`, en: `Evidence improved ${change.from} → ${change.to}`, es: `La evidencia mejoró ${change.from} → ${change.to}` });
  if (change.type === "evidence-downgrade") return tr({ fi: `Evidenssi heikkeni ${change.from} → ${change.to}`, en: `Evidence weakened ${change.from} → ${change.to}`, es: `La evidencia empeoró ${change.from} → ${change.to}` });
  if (change.type === "price-gate-open") return tr({ fi: `3 % EV-hintaraja ylittyi @ ${odds(change.odds)}`, en: `3% EV price gate opened @ ${odds(change.odds)}`, es: `Se abrió el filtro de precio EV 3 % @ ${odds(change.odds)}` });
  if (change.type === "price-gate-lost") return tr({ fi: `3 % EV-hintaraja menetettiin @ ${odds(change.odds)}`, en: `3% EV price gate was lost @ ${odds(change.odds)}`, es: `Se perdió el filtro de precio EV 3 % @ ${odds(change.odds)}` });
  if (change.type === "edge-gate-open") return tr({ fi: "Edge ylitti 2 % portin", en: "Edge crossed the 2% gate", es: "La ventaja superó el filtro del 2 %" });
  if (change.type === "edge-gate-lost") return tr({ fi: "Edge putosi alle 2 % portin", en: "Edge fell below the 2% gate", es: "La ventaja cayó por debajo del 2 %" });
  if (change.type === "ev-gate-open") return tr({ fi: "EV ylitti 3 % portin", en: "EV crossed the 3% gate", es: "El EV superó el 3 %" });
  if (change.type === "ev-gate-lost") return tr({ fi: "EV putosi alle 3 % portin", en: "EV fell below the 3% gate", es: "El EV cayó por debajo del 3 %" });
  if (change.type === "new-leader") return tr({ fi: "Uusi #1 suositus nousi kärkeen", en: "A new #1 recommendation took the lead", es: "Una nueva recomendación #1 pasó al primer lugar" });
  if (change.type === "price-improved") return tr({ fi: `Kerroin parani ${odds(change.from)} → ${odds(change.to)}`, en: `Odds improved ${odds(change.from)} → ${odds(change.to)}`, es: `La cuota mejoró ${odds(change.from)} → ${odds(change.to)}` });
  if (change.type === "price-shortened") return tr({ fi: `Kerroin lyheni ${odds(change.from)} → ${odds(change.to)}`, en: `Odds shortened ${odds(change.from)} → ${odds(change.to)}`, es: `La cuota bajó ${odds(change.from)} → ${odds(change.to)}` });
  if (change.type === "rank-up") return tr({ fi: `Ranking nousi #${change.from} → #${change.to}`, en: `Rank improved #${change.from} → #${change.to}`, es: `El ranking mejoró #${change.from} → #${change.to}` });
  if (change.type === "rank-down") return tr({ fi: `Ranking laski #${change.from} → #${change.to}`, en: `Rank fell #${change.from} → #${change.to}`, es: `El ranking bajó #${change.from} → #${change.to}` });
  return change.type;
}

function readPreviousSnapshot() {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    const captured = new Date(snapshot?.capturedAt || 0).getTime();
    if (!captured || Date.now() - captured > SNAPSHOT_MAX_AGE_MS) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export default function RecommendationSpotlight() {
  const { tr } = useLanguage();
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [radar, setRadar] = useState(null);

  async function load({ silent = false } = {}) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/recommendations?limit=8", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || "Recommendations unavailable");

      const currentSnapshot = snapshotRecommendationFeed(payload);
      const previousSnapshot = readPreviousSnapshot();
      const nextRadar = compareRecommendationSnapshots(previousSnapshot, currentSnapshot);
      setRadar(nextRadar);
      setFeed(payload);
      window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(currentSnapshot));
    } catch (cause) {
      setError(cause?.message || "Recommendations unavailable");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load({ silent: true }), 120000);
    return () => window.clearInterval(timer);
  }, []);

  const top = feed?.topRecommendation || null;
  const change = radar?.topChange || null;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[var(--sc-brand-border)] bg-[var(--sc-surface)] shadow-2xl">
      <div className="border-b border-[var(--sc-border)] bg-[var(--sc-brand-soft)] px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Recommendation Change Radar V1</div>
            <h2 className="mt-1 text-xl font-black text-[var(--sc-text)] sm:text-2xl">{tr({ fi: "Scorecasterin #1 paperisuositus juuri nyt", en: "Scorecaster's #1 paper recommendation right now", es: "Recomendación simulada #1 de Scorecaster" })}</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => load()} className="sc-button-secondary">{tr({ fi: "Tarkista nyt", en: "Check now", es: "Comprobar" })}</button>
            <Link href="/recommendations" className="sc-button-primary">{tr({ fi: "Kaikki suositukset", en: "All recommendations", es: "Todas" })}</Link>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        {loading && <div className="h-56 animate-pulse rounded-3xl bg-[var(--sc-surface-soft)]" />}
        {!loading && error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}
        {!loading && !error && !top && <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 text-sm text-[var(--sc-muted)]">{tr({ fi: "Tällä hetkellä ei ole riittävää live-dataa suosituksen muodostamiseen.", en: "There is not enough live data to form a recommendation right now.", es: "No hay suficientes datos en vivo para crear una recomendación." })}</div>}

        {!loading && top && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">#{top.rank || 1} · {top.league || "Scorecaster"}</div>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[var(--sc-text)] sm:text-3xl">{top.match}</h3>
                  <div className="mt-2 text-lg font-black text-[var(--sc-text-secondary)]">{top.selection} <span className="text-[var(--sc-brand)]">@ {odds(top.odds)}</span></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${decisionTone(top.decision)}`}>{top.decision}</span>
                  <span className="rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 py-1.5 text-xs font-black text-[var(--sc-text-secondary)]">{Math.round(Number(top.score || 0))}/100</span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">Edge</div><div className="mt-1 font-black text-[var(--sc-text)]">{percent(top.edge)}</div></div>
                <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">EV</div><div className="mt-1 font-black text-[var(--sc-text)]">{percent(top.ev)}</div></div>
                <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">Confidence</div><div className="mt-1 font-black text-[var(--sc-text)]">{percent(top.confidence)}</div></div>
                <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">Fair</div><div className="mt-1 font-black text-[var(--sc-text)]">{odds(top.fairOdds)}</div></div>
                <div className="rounded-2xl bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">Bookmakers</div><div className="mt-1 font-black text-[var(--sc-text)]">{top.bookmakerCount || 0}</div></div>
              </div>

              <div className="mt-5 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--sc-faint)]">{tr({ fi: "Miksi tämä on #1?", en: "Why is this #1?", es: "¿Por qué es #1?" })}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(top.reasons || []).map((reason, index) => <span key={`${reason.code}-${index}`} className="rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface)] px-3 py-1.5 text-xs font-bold text-[var(--sc-text-secondary)]">{reasonLabel(reason, tr)}</span>)}
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--sc-muted)]">{top.decisionReason || tr({ fi: "Päätös perustuu tämänhetkiseen markkinaan, dataan ja turvaportteihin.", en: "The decision is based on the current market, data and safety gates.", es: "La decisión se basa en el mercado, datos y filtros actuales." })}</p>
              </div>
            </div>

            <aside className="space-y-3">
              <div className="rounded-2xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--sc-brand)]">{tr({ fi: "Seuraava portti", en: "Next gate", es: "Siguiente filtro" })}</div>
                <div className="mt-2 text-lg font-black text-[var(--sc-text)]">{gateLabel(top.nextGate, top, tr)}</div>
                {top.minimumEvOdds && <div className="mt-3 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: `3 % EV -hintaraja tällä fair-arviolla on noin ${odds(top.minimumEvOdds)}. Sen ylittyminen ei yksin tee kohteesta PLAYta.`, en: `The 3% EV price threshold at this fair estimate is about ${odds(top.minimumEvOdds)}. Crossing it alone does not make the pick PLAY.`, es: `El umbral de precio para EV 3 % es aprox. ${odds(top.minimumEvOdds)}. Superarlo no convierte por sí solo la selección en PLAY.` })}</div>}
              </div>

              <div className={`rounded-2xl border p-4 ${change?.severity === "high" ? "border-emerald-400/30 bg-emerald-500/10" : change?.severity === "medium" ? "border-amber-400/30 bg-amber-500/10" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)]"}`}>
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--sc-faint)]">{tr({ fi: "Muutosradar", en: "Change radar", es: "Radar de cambios" })}</div>
                <div className="mt-2 font-black text-[var(--sc-text)]">{change ? changeLabel(change, tr) : tr({ fi: "Ei olennaista muutosta edelliseen tarkistukseen", en: "No material change since the previous check", es: "Sin cambios relevantes desde la última comprobación" })}</div>
                <div className="mt-2 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Radar seuraa päätöstä, evidenssiä, 2 % edge- ja 3 % EV-portteja, hintaa sekä rankingia. Vertailu tallennetaan vain tähän selaimeen.", en: "The radar tracks decision, evidence, 2% edge and 3% EV gates, price and ranking. The comparison is stored only in this browser.", es: "El radar sigue decisión, evidencia, filtros de edge 2 % y EV 3 %, cuota y ranking. La comparación se guarda solo en este navegador." })}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link href="/agent" className="sc-button-secondary text-center">{tr({ fi: "AI-auditointi", en: "AI audit", es: "Auditoría IA" })}</Link>
                <Link href="/recommendations" className="sc-button-secondary text-center">{tr({ fi: "Ranking", en: "Ranking", es: "Ranking" })}</Link>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
