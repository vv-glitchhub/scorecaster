"use client";

import { useEffect, useMemo, useState } from "react";

const CACHE_VERSION = "agent-v10-signed-grounded-3";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function stableKey(pick = {}) {
  const source = JSON.stringify({
    version: CACHE_VERSION,
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
    // Explanation caching is optional and must never block the Agent UI.
  }
}

function sameDecision(left, right) {
  const leftEvent = String(left?.gameId || left?.eventId || left?.id || left?.match || "");
  const rightEvent = String(right?.gameId || right?.eventId || right?.id || right?.match || "");
  return leftEvent === rightEvent &&
    String(left?.selection || "") === String(right?.selection || "") &&
    String(left?.decision || "") === String(right?.decision || "");
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

function ExplanationBody({ payload }) {
  const explanation = payload?.explanation;
  if (!explanation) return null;

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold text-fuchsia-200">Agent V10 · Grounded explanation</div>
        <div className="text-xs text-fuchsia-200/70">
          {payload.enhanced && payload.authoritative
            ? "Kielimalli · palvelimen päätös · validoitu"
            : "Deterministinen varaselitys"}
        </div>
      </div>
      <p className="text-sm leading-6 text-slate-100">{explanation.summary}</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3">
          <div className="text-sm font-bold text-emerald-300">Vahvin peruste</div>
          <p className="mt-1 text-sm text-slate-300">{explanation.strongestReason}</p>
        </div>
        <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-3">
          <div className="text-sm font-bold text-red-300">Vastaväite</div>
          <p className="mt-1 text-sm text-slate-300">{explanation.counterpoint}</p>
        </div>
      </div>
      <div>
        <div className="text-sm font-bold text-yellow-300">Tarkista seuraavaksi</div>
        <ul className="mt-1 space-y-1 text-sm text-slate-300">
          {(explanation.nextChecks || []).map((item) => <li key={item}>• {item}</li>)}
        </ul>
      </div>
      <p className="text-xs leading-5 text-slate-400">{explanation.limitation}</p>
      <div className="text-[11px] text-slate-500">
        Päätöstunniste {payload.decisionHash || "–"} · malli {payload.model || "deterministic"}
        {payload.reason ? ` · ${payload.reason}` : ""}
      </div>
    </div>
  );
}

export default function AgentExplanation({ pick }) {
  const cacheKey = useMemo(() => stableKey(pick), [pick]);
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
          ticket: authoritative.explanationTicket || null
        })
      });
      const data = await response.json();
      if (!response.ok) {
        const retry = response.headers.get("retry-after");
        throw new Error(retry
          ? `AI-selityksen käyttöraja täyttyi. Yritä uudelleen noin ${retry} sekunnin kuluttua.`
          : data?.error || "AI-selitystä ei voitu luoda.");
      }
      setPayload(data);
      writeCache(cacheKey, data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "AI-selitystä ei voitu luoda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void explain()}
          disabled={loading}
          className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-2 text-sm font-bold text-fuchsia-200 disabled:opacity-50"
        >
          {loading ? "Vahvistetaan päätös ja luodaan selitystä…" : payload ? "Päivitä Agent V10 -selitys" : "Luo Agent V10 -selitys"}
        </button>
        <span className="text-xs text-slate-500">
          Palvelin yrittää vahvistaa saman päätöksen ennen kielimallia. Epäonnistuessa käytetään vain determinististä varaselitystä.
        </span>
      </div>
      {error && <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
      <ExplanationBody payload={payload} />
    </div>
  );
}
