import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import type { AgentDecision, AgentExplanationPayload, AgentPortfolio, Bankroll } from "../types";
import { ActionButton, Card, percent, styles } from "../ui";

type MetricSet = { brierScore?: number | null; logLoss?: number | null; calibrationGap?: number | null };
type ShadowLabReport = {
  status?: string;
  sampleSize?: number;
  minimumSamples?: number;
  trainSize?: number;
  holdoutSize?: number;
  excludedRows?: number;
  champion?: { id?: string; metrics?: MetricSet; train?: MetricSet; holdout?: MetricSet };
  challenger?: { id?: string; metrics?: MetricSet; train?: MetricSet; holdout?: MetricSet; holdoutImprovement?: { brier?: number | null; logLoss?: number | null } };
  promotion?: { eligible?: boolean; reasons?: string[] };
};
type ShadowLabPayload = { ok: boolean; report?: ShadowLabReport };
type FormRestShadow = {
  status?: string;
  mode?: string;
  shadowProbability?: number | null;
  marketProbability?: number | null;
  probabilityDelta?: number | null;
  home?: { sampleSize?: number; restDays?: number | null; gamesLast7Days?: number };
  away?: { sampleSize?: number; restDays?: number | null; gamesLast7Days?: number };
};

function decisionTone(decision: AgentDecision["decision"]) {
  if (decision === "PLAY") return null;
  if (decision === "WATCH") return styles.warningBadge;
  return styles.dangerBadge;
}

function decisionKey(decision: AgentDecision, index: number) {
  return String(decision.gameId || decision.eventId || decision.id || `${decision.match}-${decision.selection}-${index}`);
}

function optionalNumber(value: unknown, digits = 3) {
  if (value === null || value === undefined || value === "") return "–";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "–";
}

export default function AgentScreen() {
  const { language, tr, locale } = useLanguage();
  const [portfolio, setPortfolio] = useState<AgentPortfolio | null>(null);
  const [shadowLab, setShadowLab] = useState<ShadowLabReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, AgentExplanationPayload>>({});
  const money = (value: unknown) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));

  async function load() {
    setLoading(true);
    try {
      const bankrollResponse = await apiRequest<{ data: Bankroll }>("/api/cloud/bankroll");
      const bankroll = bankrollResponse.data;
      const [portfolioResponse, labResponse] = await Promise.all([
        apiRequest<AgentPortfolio>("/api/agent/portfolio", {
          method: "POST",
          timeoutMs: 45000,
          body: { settings: { bankroll: bankroll.bankroll, maxStakePercent: bankroll.max_stake_percent, maxTotalExposurePercent: bankroll.max_daily_exposure_percent, maxLeagueExposurePercent: bankroll.max_single_league_exposure_percent ?? 4 } }
        }),
        apiRequest<ShadowLabPayload>("/api/agent/form-rest-lab", { timeoutMs: 30000 }).catch(() => null)
      ]);
      setPortfolio(portfolioResponse);
      setShadowLab(labResponse?.report || null);
    } catch (error) {
      Alert.alert(tr({ fi: "AI-portfoliota ei voitu ladata", en: "AI portfolio could not be loaded", es: "No se pudo cargar la cartera IA" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
      setPortfolio(null);
      setShadowLab(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function explain(decision: AgentDecision, id: string) {
    setBusyId(id);
    try {
      const response = await apiRequest<AgentExplanationPayload>("/api/agent/explain", { method: "POST", timeoutMs: 30000, body: { decision, ticket: decision.explanationTicket || null, language } });
      setExplanations((current) => ({ ...current, [id]: response }));
    } catch (error) {
      Alert.alert(tr({ fi: "AI-selitystä ei voitu luoda", en: "AI explanation could not be created", es: "No se pudo crear la explicación IA" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setBusyId(null); }
  }

  async function save(decision: AgentDecision, id: string) {
    if (decision.decision !== "PLAY" || !decision.suggestedStake) return;
    setBusyId(id);
    try {
      await apiRequest("/api/cloud/bets", {
        method: "POST",
        body: { bets: [{ id, eventId: decision.gameId || decision.eventId || decision.id, match: decision.match || [decision.homeTeam, decision.awayTeam].filter(Boolean).join(" – "), homeTeam: decision.homeTeam, awayTeam: decision.awayTeam, selection: decision.selection || decision.label, odds: decision.odds, stake: decision.suggestedStake, edge: decision.edge, ev: decision.ev, confidence: decision.confidence, league: decision.league || decision.leagueTitle, sport: decision.sportKey, bookmaker: decision.bookmaker, decision: decision.decision, qualityScore: decision.trustScore, modelProbability: decision.stressTest?.probability || decision.consensusProbability, impliedProbability: decision.marketProbability, source: "scorecaster-mobile-agent-v11-sports-intelligence-v1", agentVersion: decision.agentVersion, probabilityAdjustedByLearning: false, probabilityAdjustedByIntelligence: false }] }
      });
      Alert.alert(tr({ fi: "Tallennettu paperiseurantaan", en: "Saved to paper tracking", es: "Guardado en seguimiento simulado" }), tr({ fi: "Palvelin varmisti kohteen ja tallensi vire- ja leposnapshotin auditointia varten. Varjomalli ei muuttanut päätöstä.", en: "The server verified the pick and stored the form-and-rest snapshot for audit. The shadow model did not change the decision.", es: "El servidor verificó el pronóstico y guardó el snapshot de forma y descanso para auditoría. El modelo sombra no cambió la decisión." }));
    } catch (error) {
      Alert.alert(tr({ fi: "Tallennus epäonnistui", en: "Save failed", es: "No se pudo guardar" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setBusyId(null); }
  }

  const modelLab = portfolio?.modelLab;
  const improvement = modelLab?.challenger?.holdoutImprovement?.brier;
  const shadowImprovement = shadowLab?.challenger?.holdoutImprovement?.brier;
  const intelligenceCounts = useMemo(() => {
    const counts = { verified: 0, partial: 0, marketOnly: 0 };
    for (const decision of portfolio?.decisions || []) {
      const level = decision.sportsIntelligence?.readiness?.level;
      if (level === "verified") counts.verified += 1;
      else if (level === "partial") counts.partial += 1;
      else counts.marketOnly += 1;
    }
    return counts;
  }, [portfolio]);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.title}>Agent V11</Text><Text style={styles.subtitle}>{tr({ fi: "Stressitesti, portfoliohallinta, Sports Intelligence sekä vire- ja lepovarjomalli. Vain paperiseuranta.", en: "Stress testing, portfolio management, Sports Intelligence and a form-and-rest shadow model. Paper tracking only.", es: "Prueba de estrés, gestión de cartera, Sports Intelligence y modelo sombra de forma y descanso. Solo seguimiento simulado." })}</Text></View><ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={load} compact tone="secondary" disabled={loading || busyId !== null} /></View>
      {loading && <ActivityIndicator color="#34d399" size="large" />}

      {!loading && portfolio && <>
        <Card><Text style={styles.cardTitle}>{tr({ fi: "AI-portfolio", en: "AI portfolio", es: "Cartera IA" })}</Text><Text style={styles.metric}>{money(portfolio.totalAllocated)}</Text><Text style={styles.muted}>PLAY {portfolio.counts.PLAY} · WATCH {portfolio.counts.WATCH} · SKIP {portfolio.counts.SKIP}</Text><Text style={styles.muted}>{tr({ fi: "Altistus", en: "Exposure", es: "Exposición" })} {percent(portfolio.exposurePercent)} · {tr({ fi: "kokonaiskatto", en: "total cap", es: "límite total" })} {money(portfolio.totalCap)} · {tr({ fi: "liigakatto", en: "league cap", es: "límite por liga" })} {money(portfolio.leagueCap)}</Text><Text style={styles.muted}>Sports Intelligence: {intelligenceCounts.verified} verified · {intelligenceCounts.partial} partial · {intelligenceCounts.marketOnly} market-only</Text>{(portfolio.warnings || []).map((warning) => <Text key={warning} style={styles.muted}>• {warning}</Text>)}</Card>

        <Card><Text style={styles.cardTitle}>Agent V11 Model Lab</Text><Text style={styles.value}>{modelLab?.status || "unavailable"}</Text><Text style={styles.muted}>{tr({ fi: "Otos", en: "Sample", es: "Muestra" })} {modelLab?.sampleSize || 0}/{modelLab?.minimumSamples || 120} · train {modelLab?.trainSize || 0} · holdout {modelLab?.holdoutSize || 0}</Text><Text style={styles.muted}>Holdout Brier {modelLab?.champion?.holdout ? optionalNumber(modelLab.champion.holdout.brierScore) : "–"} → {modelLab?.challenger?.holdout ? optionalNumber(modelLab.challenger.holdout.brierScore) : "–"} · Δ {optionalNumber(improvement)}</Text><Text style={styles.muted}>{tr({ fi: "Nykyinen markkinatodennäköisyys pysyy muuttumattomana.", en: "The current market probability remains unchanged.", es: "La probabilidad de mercado actual permanece sin cambios." })}</Text></Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Vire- ja lepovarjomallin laboratorio", en: "Form & Rest Shadow Lab", es: "Laboratorio sombra de forma y descanso" })}</Text><Text style={styles.value}>{shadowLab?.status || tr({ fi: "ei saatavilla", en: "unavailable", es: "no disponible" })}</Text><Text style={styles.muted}>{tr({ fi: "Palvelimen varmentama otos", en: "Server-verified sample", es: "Muestra verificada por el servidor" })} {shadowLab?.sampleSize || 0}/{shadowLab?.minimumSamples || 40} · train {shadowLab?.trainSize || 0} · holdout {shadowLab?.holdoutSize || 0}</Text><Text style={styles.muted}>Champion {shadowLab?.champion?.id || "market-consensus"} · Challenger {shadowLab?.challenger?.id || "form-rest-shadow-v1"}</Text><Text style={styles.muted}>Holdout Brier {optionalNumber(shadowLab?.champion?.holdout?.brierScore || shadowLab?.champion?.metrics?.brierScore)} → {optionalNumber(shadowLab?.challenger?.holdout?.brierScore || shadowLab?.challenger?.metrics?.brierScore)} · Δ {optionalNumber(shadowImprovement)}</Text><Text style={styles.muted}>{tr({ fi: "Pakollinen varjotila: ei automaattista promootiota eikä vaikutusta PLAY-päätökseen, edgeen, EV:hen tai panokseen.", en: "Mandatory shadow mode: no automatic promotion and no effect on PLAY, edge, EV or stake.", es: "Modo sombra obligatorio: sin promoción automática ni efecto en PLAY, ventaja, EV o importe." })}</Text></Card>

        {portfolio.decisions.slice(0, 12).map((decision, index) => {
          const id = decisionKey(decision, index);
          const explanation = explanations[id];
          const stress = decision.stressTest || {};
          const price = decision.priceGuard || {};
          const intelligence = decision.sportsIntelligence;
          const readiness = intelligence?.readiness;
          const shadow = (decision as AgentDecision & { formRestShadow?: FormRestShadow }).formRestShadow;
          const shadowReady = shadow?.status === "ready";
          return <Card key={id}>
            <View style={styles.rowBetween}><View style={[styles.badge, decisionTone(decision.decision)]}><Text style={styles.badgeText}>{decision.decision}</Text></View><Text style={styles.muted}>{decision.leagueTitle || decision.league || decision.sportKey || "Sport"}</Text></View>
            <Text style={styles.cardTitle}>{decision.match || `${decision.homeTeam || ""} – ${decision.awayTeam || ""}`}</Text><Text style={styles.value}>{decision.selection || decision.label} · {Number(decision.odds || 0).toFixed(2)}</Text><Text style={styles.muted}>{decision.bookmaker || tr({ fi: "Paras saatavilla oleva hinta", en: "Best available price", es: "Mejor cuota disponible" })}</Text>
            <View style={styles.divider} /><Text style={styles.muted}>{tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} {percent(stress.probability)} · {tr({ fi: "stressialue", en: "stress range", es: "rango de estrés" })} {percent(stress.lower)}–{percent(stress.upper)}</Text><Text style={styles.muted}>{tr({ fi: "Perus-EV", en: "Base EV", es: "EV base" })} {percent(stress.baseEv)} · {tr({ fi: "alarajan EV", en: "downside EV", es: "EV a la baja" })} {percent(stress.downsideEv)} · robustness {percent(decision.robustnessScore)}</Text><Text style={styles.muted}>{tr({ fi: "Kerroinraja", en: "Odds floor", es: "Cuota mínima" })} {Number(price.minimumPlayOdds || 0).toFixed(2)} · {tr({ fi: "paperipanos", en: "paper stake", es: "importe simulado" })} {money(decision.suggestedStake)}</Text>
            <Text style={styles.value}>{tr({ fi: "Riippumaton evidenssi", en: "Independent evidence", es: "Evidencia independiente" })}: {readiness?.level || "market-only"}</Text><Text style={styles.muted}>{decision.evidenceGateReason || tr({ fi: "Intelligence ei muuttanut markkinatodennäköisyyttä.", en: "Intelligence did not change the market probability.", es: "La inteligencia no modificó la probabilidad de mercado." })}</Text>
            <Text style={styles.value}>{tr({ fi: "Vire & lepo", en: "Form & rest", es: "Forma y descanso" })}: {shadow?.status || "unavailable"}</Text><Text style={styles.muted}>{shadowReady ? `${tr({ fi: "markkina", en: "market", es: "mercado" })} ${percent(shadow?.marketProbability)} · shadow ${percent(shadow?.shadowProbability)} · Δ ${percent(shadow?.probabilityDelta)}` : tr({ fi: "Varjotodennäköisyyttä ei muodostettu tälle kohteelle.", en: "No shadow probability was produced for this pick.", es: "No se produjo probabilidad sombra para este pronóstico." })}</Text><Text style={styles.muted}>{tr({ fi: "Otokset koti/vieras", en: "Home/away samples", es: "Muestras local/visitante" })} {shadow?.home?.sampleSize || 0}/{shadow?.away?.sampleSize || 0} · {tr({ fi: "lepo", en: "rest", es: "descanso" })} {optionalNumber(shadow?.home?.restDays, 1)}/{optionalNumber(shadow?.away?.restDays, 1)} d · {tr({ fi: "ei päätöskäyttöä", en: "not used for decision", es: "no usado para decisión" })}</Text>
            <View style={styles.actionRow}><ActionButton label={busyId === id ? tr({ fi: "Odota…", en: "Wait…", es: "Espera…" }) : tr({ fi: "AI-selitys", en: "AI explanation", es: "Explicación IA" })} onPress={() => explain(decision, id)} disabled={busyId !== null} compact tone="secondary" /><ActionButton label={tr({ fi: "Paperiseurantaan", en: "Paper tracking", es: "Seguimiento simulado" })} onPress={() => save(decision, id)} disabled={busyId !== null || decision.decision !== "PLAY" || !decision.suggestedStake} compact /></View>
            {explanation && <View style={{ gap: 8 }}><Text style={styles.cardTitle}>{explanation.enhanced && explanation.authoritative ? tr({ fi: "Valvottu AI-selitys", en: "Governed AI explanation", es: "Explicación IA controlada" }) : tr({ fi: "Deterministinen selitys", en: "Deterministic explanation", es: "Explicación determinista" })}</Text><Text style={styles.muted}>{explanation.explanation.summary}</Text><Text style={styles.value}>{tr({ fi: "Vahvin peruste", en: "Strongest reason", es: "Motivo principal" })}</Text><Text style={styles.muted}>{explanation.explanation.strongestReason}</Text><Text style={styles.value}>{tr({ fi: "Vastaväite", en: "Counterargument", es: "Contraargumento" })}</Text><Text style={styles.muted}>{explanation.explanation.counterpoint}</Text>{explanation.explanation.nextChecks.map((item) => <Text key={item} style={styles.muted}>• {item}</Text>)}<Text style={styles.muted}>{explanation.explanation.limitation}</Text></View>}
          </Card>;
        })}
      </>}
    </ScrollView>
  );
}
