"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const CACHE_VERSION = "agent-v10-signed-grounded-4";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function stableKey(pick = {}, language = "fi") {
  const source = JSON.stringify({
    version: CACHE_VERSION,
    language,
    id: pick.id || pick.gameId || pick.eventId || pick.match,
    decision: pick.decision,
    selection: pick.selection,
    odds: pick.odds,
    probability: pick.stressTest?.probability,
    lower: pick.stressTest?.lower,
    downsideEv: pick.stressTest?.downsideEv,
    minimumPlayOdds: pick.priceGuard?.minimumPlayOdds,
    suggestedStake: pick.suggestedStake,
    portfolioReason: pick.portfolioReason
  });

  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `scorecaster.${CACHE_VERSION}.${(hash >>> 0).toString(16)}`;
}

function readCache(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.payload || null;
  } catch {
    return null;
  }
}

function writeCache(key, payload) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    // Optional cache must never block the Agent UI.
  }
}

function sameDecision(left, right) {
  const leftEvent = String(left?.gameId || left?.eventId || left?.id || left?.match || "");
  const rightEvent = String(right?.gameId || right?.eventId || right?.id || right?.match || "");
  return leftEvent === rightEvent && String(left?.selection || "") === String(right?.selection || "") && String(left?.decision || "") === String(right?.decision || "");
}

async function resolveServerDecision(pick) {
  if (pick?.explanationTicket) return pick;

  const sports = pick?.sportKey ? [pick.sportKey] : [];
  const response = await fetch("/api/agent/portfolio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sports,
      settings: {
        bankroll: Number(pick?.bankroll || 1000),
        maxStakePercent: Number(pick?.maxStakePercent || 1),
        maxTotalExposurePercent: 4,
        maxLeagueExposurePercent: 2
      }
    })
  });

  if (!response.ok) return pick;
  const data = await response.json();
  const authoritative = (data.decisions || []).find((candidate) => sameDecision(candidate, pick));
  return authoritative?.explanationTicket ? authoritative : pick;
}

function ExplanationBody({ payload, tr }) {
  const explanation = payload?.explanation;
  if (!explanation) return null;

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold text-fuchsia-200">Agent V10 · {tr({ fi: "valvottu selitys", en: "grounded explanation", es: "explicación controlada" })}</div>
        <div className="text-xs text-fuchsia-200/70">
          {payload.enhanced && payload.authoritative
            ? tr({ fi: "Kielimalli · palvelimen päätös · validoitu", en: "Language model · server decision · validated", es: "Modelo de lenguaje · decisión del servidor · validada" })
            : tr({ fi: "Deterministinen varaselitys", en: "Deterministic fallback", es: "Explicación determinista alternativa" })}
        </div>
      </div>
      <p className="text-sm leading-6 text-slate-100">{explanation.summary}</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3">
          <div className="text-sm font-bold text-emerald-300">{tr({ fi: "Vahvin peruste", en: "Strongest reason", es: "Motivo principal" })}</div>
          <p className="mt-1 text-sm text-slate-300">{explanation.strongestReason}</p>
        </div>
        <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-3">
          <div className="text-sm font-bold text-red-300">{tr({ fi: "Vastaväite", en: "Counterargument", es: "Contraargumento" })}</div>
          <p className="mt-1 text-sm text-slate-300">{explanation.counterpoint}</p>
        </div>
      </div>
      <div>
        <div className="text-sm font-bold text-yellow-300">{tr({ fi: "Tarkista seuraavaksi", en: "Check next", es: "Comprueba después" })}</div>
        <ul className="mt-1 space-y-1 text-sm text-slate-300">{(explanation.nextChecks || []).map((item) => <li key={item}>• {item}</li>)}</ul>
      </div>
      <p className="text-xs leading-5 text-slate-400">{explanation.limitation}</p>
      <div className="text-[11px] text-slate-500">
        {tr({ fi: "Päätöstunniste", en: "Decision ID", es: "Identificador de decisión" })} {payload.decisionHash || "–"} · {tr({ fi: "malli", en: "model", es: "modelo" })} {payload.model || "deterministic"}{payload.reason ? ` · ${payload.reason}` : ""}
      </div>
    </div>
  );
}

export default function AgentExplanation({ pick }) {
  const { language, tr } = useLanguage();
  const cacheKey = useMemo(() => stableKey(pick, language), [pick, language]);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPayload(readCache(cacheKey));
    setError("");
  }, [cacheKey]);

  async function explain() {
    setLoading(true);
    setError("");
    try {
      const authoritative = await resolveServerDecision(pick);
      const response = await fetch("/api/agent/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: authoritative,
          ticket: authoritative.explanationTicket || null,
          language
        })
      });
      const data = await response.json();
      if (!response.ok) {
        const retry = response.headers.get("retry-after");
        throw new Error(retry
          ? tr({ fi: `AI-selityksen käyttöraja täyttyi. Yritä uudelleen noin ${retry} sekunnin kuluttua.`, en: `The AI explanation limit was reached. Try again in about ${retry} seconds.`, es: `Se alcanzó el límite de explicaciones IA. Inténtalo de nuevo en unos ${retry} segundos.` })
          : data?.error || tr({ fi: "AI-selitystä ei voitu luoda.", en: "The AI explanation could not be created.", es: "No se pudo crear la explicación IA." }));
      }
      setPayload(data);
      writeCache(cacheKey, data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : tr({ fi: "AI-selitystä ei voitu luoda.", en: "The AI explanation could not be created.", es: "No se pudo crear la explicación IA." }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void explain()} disabled={loading} className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-2 text-sm font-bold text-fuchsia-200 disabled:opacity-50">
          {loading
            ? tr({ fi: "Vahvistetaan päätös ja luodaan selitystä…", en: "Verifying decision and creating explanation…", es: "Verificando la decisión y creando la explicación…" })
            : payload
              ? tr({ fi: "Päivitä Agent V10 -selitys", en: "Refresh Agent V10 explanation", es: "Actualizar explicación de Agent V10" })
              : tr({ fi: "Luo Agent V10 -selitys", en: "Create Agent V10 explanation", es: "Crear explicación de Agent V10" })}
        </button>
        <span className="text-xs text-slate-500">{tr({ fi: "Palvelin vahvistaa saman päätöksen ennen kielimallia. Epäonnistuessa käytetään determinististä varaselitystä.", en: "The server verifies the same decision before the language model. On failure, a deterministic fallback is used.", es: "El servidor verifica la misma decisión antes del modelo de lenguaje. Si falla, se usa una explicación determinista." })}</span>
      </div>
      {error && <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
      <ExplanationBody payload={payload} tr={tr} />
    </div>
  );
}
