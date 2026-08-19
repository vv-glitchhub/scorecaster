"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { MetricTile, SectionHeader } from "../components/ProductUI";

const PROFILES = ["conservative", "balanced", "aggressive"];

export default function AutonomousRiskProfileCard() {
  const { tr } = useLanguage();
  const [profile, setProfile] = useState("balanced");
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const labels = {
    conservative: tr({ fi: "Varovainen", en: "Conservative", es: "Conservador" }),
    balanced: tr({ fi: "Tasapainoinen", en: "Balanced", es: "Equilibrado" }),
    aggressive: tr({ fi: "Rohkea", en: "Aggressive", es: "Agresivo" })
  };
  const descriptions = {
    conservative: tr({
      fi: "Autonomia hyväksyy vain vahvimmat PLAY-kohteet ja käyttää pienempää virtuaalista panostusta.",
      en: "Autonomy accepts only the strongest PLAY candidates and uses smaller virtual sizing.",
      es: "La autonomía acepta solo los PLAY más fuertes y usa un importe virtual menor."
    }),
    balanced: tr({
      fi: "Scorecasterin oletus: vahva stressitesti, quarter-Kelly ja maltillinen virtuaalinen altistus.",
      en: "Scorecaster default: robust stress testing, quarter Kelly and moderate virtual exposure.",
      es: "Configuración estándar: prueba de estrés robusta, Kelly de un cuarto y exposición moderada."
    }),
    aggressive: tr({
      fi: "Autonomia voi hyväksyä enemmän rajatapauksia, mutta stressatun alarajan EV:n on silti oltava positiivinen.",
      en: "Autonomy may accept more borderline candidates, but stressed downside EV must still remain positive.",
      es: "La autonomía puede aceptar más casos límite, pero el EV estresado debe seguir siendo positivo."
    })
  };

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cloud/autonomous-agent/risk-profile", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Risk profile unavailable");
      setProfile(PROFILES.includes(data.riskProfile) ? data.riskProfile : "balanced");
      setPolicy(data.riskPolicy || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Risk profile unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function selectProfile(nextProfile) {
    if (!PROFILES.includes(nextProfile) || nextProfile === profile || saving) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/cloud/autonomous-agent/risk-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskProfile: nextProfile })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Risk profile could not be saved");
      setProfile(data.riskProfile);
      setPolicy(data.riskPolicy || null);
      setMessage(tr({
        fi: `Autonomisen Agentin riskitaso: ${labels[data.riskProfile]}.`,
        en: `Autonomous Agent risk level: ${labels[data.riskProfile]}.`,
        es: `Nivel de riesgo del Agent autónomo: ${labels[data.riskProfile]}.`
      }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Risk profile could not be saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section data-autonomous-risk-profile="true" className="rounded-3xl border border-purple-300/20 bg-purple-300/[0.06] p-5 md:p-6">
      <SectionHeader
        eyebrow="Autonomous Risk Control V1"
        title={tr({ fi: "Kuinka rohkeasti autonomia saa suositella?", en: "How aggressively may autonomy recommend?", es: "¿Con cuánto riesgo puede recomendar la autonomía?" })}
        description={tr({
          fi: "Sama riskipolitiikka ohjaa nyt myös taustalla toimivaa paperi-Agenttia. Profiili ei muuta probabilityä, edgeä tai EV:tä eikä koskaan löysää käyttäjän omia minimirajoja tai tuotannon hard capeja.",
          en: "The same risk policy now governs the background paper Agent. It never changes probability, edge or EV and never loosens your personal minimums or production hard caps.",
          es: "La misma política de riesgo controla el Agent simulado en segundo plano. Nunca cambia probabilidad, ventaja o EV ni reduce tus mínimos o límites duros."
        })}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {PROFILES.map((item) => {
          const active = item === profile;
          return (
            <button
              key={item}
              type="button"
              disabled={loading || saving}
              aria-pressed={active}
              onClick={() => void selectProfile(item)}
              className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? "border-purple-300/55 bg-purple-300/15" : "border-white/10 bg-black/20 hover:border-white/20"}`}
            >
              <div className={`font-black ${active ? "text-purple-100" : "text-white"}`}>{labels[item]}</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">{descriptions[item]}</div>
            </button>
          );
        })}
      </div>

      {policy && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile label="Min confidence" value={`${(Number(policy.minConfidence || 0) * 100).toFixed(0)} %`} tone="sky" />
          <MetricTile label="Min edge" value={`${(Number(policy.minEdge || 0) * 100).toFixed(1)} %`} tone="green" />
          <MetricTile label="Min EV" value={`${(Number(policy.minEv || 0) * 100).toFixed(1)} %`} tone="green" />
          <MetricTile label="Kelly" value={`${(Number(policy.kellyFraction || 0) * 100).toFixed(1)} %`} tone="purple" />
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-slate-500">
        {tr({
          fi: "Käyttäjän min edge / min confidence pysyvät lisäturvarajoina. Rohkeinkaan profiili ei saa ylittää 1 % yksittäistä panosta, 5 % kokonaisaltistusta tai 2,5 % liiga-altistusta eikä se voi tehdä oikean rahan vetoja.",
          en: "Your personal min edge / min confidence remain additional safety floors. Even Aggressive cannot exceed 1% single-pick, 5% total or 2.5% league exposure and cannot place real-money bets.",
          es: "Tus mínimos de edge/confidence siguen siendo barreras adicionales. Incluso Agresivo respeta 1% por selección, 5% total y 2,5% por liga y no puede apostar dinero real."
        })}
      </p>
      {message && <div className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm text-emerald-100">{message}</div>}
      {error && <div className="mt-4 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</div>}
    </section>
  );
}
