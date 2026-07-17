import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import type { AgentDecision, AgentExplanationPayload, AgentPortfolio, Bankroll } from "../types";
import { ActionButton, Card, percent, styles } from "../ui";

function decisionTone(decision: AgentDecision["decision"]) {
  if (decision === "PLAY") return null;
  if (decision === "WATCH") return styles.warningBadge;
  return styles.dangerBadge;
}

function decisionKey(decision: AgentDecision, index: number) {
  return String(decision.gameId || decision.eventId || decision.id || `${decision.match}-${decision.selection}-${index}`);
}

function optionalNumber(value: unknown, digits = 3) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "–";
}

export default function AgentScreen() {
  const { language, tr, locale } = useLanguage();
  const [portfolio, setPortfolio] = useState<AgentPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, AgentExplanationPayload>>({});
  const money = (value: unknown) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));

  async function load() {
    setLoading(true);
    try {
      const bankrollResponse = await apiRequest<{ data: Bankroll }>("/api/cloud/bankroll");
      const bankroll = bankrollResponse.data;
      const response = await apiRequest<AgentPortfolio>("/api/agent/portfolio", {
        method: "POST",
        timeoutMs: 45000,
        body: { settings: { bankroll: bankroll.bankroll, maxStakePercent: bankroll.max_stake_percent, maxTotalExposurePercent: bankroll.max_daily_exposure_percent, maxLeagueExposurePercent: bankroll.max_single_league_exposure_percent ?? 4 } }
      });
      setPortfolio(response);
    } catch (error) {
      Alert.alert(tr({ fi: "AI-portfoliota ei voitu ladata", en: "AI portfolio could not be loaded", es: "No se pudo cargar la cartera IA" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
      setPortfolio(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function explain(decision: AgentDecision, id: string) {
    setBusyId(id);
    try {
      const response = await apiRequest<AgentExplanationPayload>("/api/agent/explain", {
        method: "POST",
        timeoutMs: 30000,
        body: { decision, ticket: decision.explanationTicket || null, language }
      });
      setExplanations((current) => ({ ...current, [id]: response }));
    } catch (error) {
      Alert.alert(tr({ fi: "AI-selitystä ei voitu luoda", en: "AI explanation could not be created", es: "No se pudo crear la explicación IA" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally {
      setBusyId(null);
    }
  }

  async function save(decision: AgentDecision, id: string) {
    if (decision.decision !== "PLAY" || !decision.suggestedStake) return;
    setBusyId(id);
    try {
      await apiRequest("/api/cloud/bets", {
        method: "POST",
        body: { bets: [{ id, eventId: decision.gameId || decision.eventId || decision.id, match: decision.match || [decision.homeTeam, decision.awayTeam].filter(Boolean).join(" – "), homeTeam: decision.homeTeam, awayTeam: decision.awayTeam, selection: decision.selection || decision.label, odds: decision.odds, stake: decision.suggestedStake, edge: decision.edge, ev: decision.ev, confidence: decision.confidence, league: decision.league || decision.leagueTitle, sport: decision.sportKey, bookmaker: decision.bookmaker, decision: decision.decision, qualityScore: decision.trustScore, modelProbability: decision.stressTest?.probability || decision.consensusProbability, impliedProbability: decision.marketProbability, source: "scorecaster-mobile-agent-v11-real-intelligence-v1", agentVersion: decision.agentVersion, learningStatus: decision.selfLearning?.status, learningSampleSize: decision.selfLearning?.sampleSize, probabilityAdjustedByLearning: false, probabilityAdjustedByContext: false }] }
      });
      Alert.alert(tr({ fi: "Tallennettu paperiseurantaan", en: "Saved to paper tracking", es: "Guardado en seguimiento simulado" }), tr({ fi: "Kohde lisättiin virtuaaliseen seurantaan. Oppimis- tai kontekstikerros ei muuttanut todennäköisyyttä.", en: "The selection was added to virtual tracking. Neither learning nor context changed the probability.", es: "La selección se añadió al seguimiento virtual. Ni el aprendizaje ni el contexto cambiaron la probabilidad." }));
    } catch (error) {
      Alert.alert(tr({ fi: "Tallennus epäonnistui", en: "Save failed", es: "No se pudo guardar" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally {
      setBusyId(null);
    }
  }

  const modelLab = portfolio?.modelLab;
  const intelligence = portfolio?.sportsIntelligence;
  const improvement = modelLab?.challenger?.holdoutImprovement?.brier;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.title}>Agent V11</Text><Text style={styles.subtitle}>{tr({ fi: "Palvelimen laskema markkina-analyysi, Model Lab ja lähteistetty urheilukonteksti. Konteksti voi vain alentaa päätöstä.", en: "Server-calculated market analysis, Model Lab and sourced sports context. Context may only downgrade a decision.", es: "Análisis de mercado, Model Lab y contexto deportivo con fuentes calculados por el servidor. El contexto solo puede rebajar una decisión." })}</Text></View><ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={load} compact tone="secondary" disabled={loading || busyId !== null} /></View>
      {loading && <ActivityIndicator color="#34d399" size="large" />}

      {!loading && portfolio && <>
        <Card><Text style={styles.cardTitle}>{tr({ fi: "AI-portfolio", en: "AI portfolio", es: "Cartera IA" })}</Text><Text style={styles.metric}>{money(portfolio.totalAllocated)}</Text><Text style={styles.muted}>PLAY {portfolio.counts.PLAY} · WATCH {portfolio.counts.WATCH} · SKIP {portfolio.counts.SKIP}</Text><Text style={styles.muted}>{tr({ fi: "Altistus", en: "Exposure", es: "Exposición" })} {percent(portfolio.exposurePercent)} · {tr({ fi: "kokonaiskatto", en: "total cap", es: "límite total" })} {money(portfolio.totalCap)} · {tr({ fi: "liigakatto", en: "league cap", es: "límite por liga" })} {money(portfolio.leagueCap)}</Text><Text style={styles.muted}>{tr({ fi: "Selitystila", en: "Explanation mode", es: "Modo de explicación" })}: {portfolio.signingConfigured ? tr({ fi: "palvelimen allekirjoittama", en: "server-signed", es: "firmada por el servidor" }) : tr({ fi: "deterministinen varaselitys", en: "deterministic fallback", es: "alternativa determinista" })}</Text>{(portfolio.warnings || []).map((warning) => <Text key={warning} style={styles.muted}>• {warning}</Text>)}</Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Real Sports Intelligence V1", en: "Real Sports Intelligence V1", es: "Real Sports Intelligence V1" })}</Text><Text style={styles.value}>{tr({ fi: "Arvioitu", en: "Evaluated", es: "Evaluado" })} {intelligence?.evaluated || 0}/{intelligence?.maximumEvaluatedPerRequest || 6}</Text><Text style={styles.muted}>{tr({ fi: "Varmennettu", en: "Verified", es: "Verificado" })} {intelligence?.verified || 0} · {tr({ fi: "osittainen", en: "partial", es: "parcial" })} {intelligence?.partial || 0} · {tr({ fi: "ei saatavilla", en: "unavailable", es: "no disponible" })} {intelligence?.unavailable || 0}</Text><Text style={styles.muted}>{tr({ fi: "Konteksti esti tai jätti arvioimatta", en: "Context blocked or left unevaluated", es: "Contexto bloqueado o no evaluado" })}: {intelligence?.blockedByVerifiedContext || 0}</Text><Text style={styles.muted}>{tr({ fi: "Todennäköisyyttä ei muutettu. Ulkoinen markkina ei ole päätössyöte.", en: "Probability was not changed. External markets are not a decision input.", es: "La probabilidad no cambió. Los mercados externos no son una entrada de decisión." })}</Text></Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Agent V11 Model Lab", en: "Agent V11 Model Lab", es: "Model Lab de Agent V11" })}</Text><Text style={styles.value}>{modelLab?.status || tr({ fi: "ei saatavilla", en: "unavailable", es: "no disponible" })}</Text><Text style={styles.muted}>{tr({ fi: "Otos", en: "Sample", es: "Muestra" })} {modelLab?.sampleSize || 0}/{modelLab?.minimumSamples || 120} · {tr({ fi: "koulutus", en: "train", es: "entrenamiento" })} {modelLab?.trainSize || 0} · holdout {modelLab?.holdoutSize || 0}</Text><Text style={styles.muted}>{tr({ fi: "Champion", en: "Champion", es: "Champion" })}: {modelLab?.champion?.id || "identity"} · {tr({ fi: "Challenger", en: "Challenger", es: "Challenger" })}: {modelLab?.challenger?.id || "–"}</Text><Text style={styles.muted}>Holdout Brier {modelLab?.champion?.holdout ? optionalNumber(modelLab.champion.holdout.brierScore) : "–"} → {modelLab?.challenger?.holdout ? optionalNumber(modelLab.challenger.holdout.brierScore) : "–"} · Δ {optionalNumber(improvement)}</Text><Text style={styles.muted}>{tr({ fi: "Drift", en: "Drift", es: "Drift" })}: {modelLab?.drift?.status || "unknown"}. {modelLab?.drift?.note || ""}</Text><Text style={styles.muted}>{modelLab?.promotion?.eligible ? tr({ fi: "Ehdokas läpäisi portin, mutta pysyy varjotilassa erilliseen hyväksyntään asti.", en: "The challenger passed the gate but remains in shadow mode until separately approved.", es: "El challenger superó el filtro, pero permanece en modo sombra hasta una aprobación separada." }) : tr({ fi: "Ehdokasta ei oteta käyttöön. Nykyinen todennäköisyys pysyy muuttumattomana.", en: "The challenger is not activated. The current probability remains unchanged.", es: "El challenger no se activa. La probabilidad actual permanece sin cambios." })}</Text>{(modelLab?.promotion?.reasons || []).slice(0, 3).map((reason) => <Text key={reason} style={styles.muted}>• {reason}</Text>)}</Card>

        {portfolio.decisions.slice(0, 12).map((decision, index) => {
          const id = decisionKey(decision, index);
          const explanation = explanations[id];
          const stress = decision.stressTest || {};
          const price = decision.priceGuard || {};
          const context = decision.verifiedIntelligence;
          return <Card key={id}>
            <View style={styles.rowBetween}><View style={[styles.badge, decisionTone(decision.decision)]}><Text style={styles.badgeText}>{decision.decision}</Text></View><Text style={styles.muted}>{decision.leagueTitle || decision.league || decision.sportKey || "Sport"}</Text></View>
            <Text style={styles.cardTitle}>{decision.match || `${decision.homeTeam || ""} – ${decision.awayTeam || ""}`}</Text><Text style={styles.value}>{decision.selection || decision.label} · {Number(decision.odds || 0).toFixed(2)}</Text><Text style={styles.muted}>{decision.bookmaker || tr({ fi: "Paras saatavilla oleva hinta", en: "Best available price", es: "Mejor cuota disponible" })}</Text>
            <View style={styles.divider} /><Text style={styles.muted}>{tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} {percent(stress.probability)} · {tr({ fi: "stressialue", en: "stress range", es: "rango de estrés" })} {percent(stress.lower)}–{percent(stress.upper)}</Text><Text style={styles.muted}>{tr({ fi: "Perus-EV", en: "Base EV", es: "EV base" })} {percent(stress.baseEv)} · {tr({ fi: "alarajan EV", en: "downside EV", es: "EV a la baja" })} {percent(stress.downsideEv)} · robustness {percent(decision.robustnessScore)}</Text><Text style={styles.muted}>{tr({ fi: "Kerroinraja", en: "Odds floor", es: "Cuota mínima" })} {Number(price.minimumPlayOdds || 0).toFixed(2)} · {tr({ fi: "paperipanos", en: "paper stake", es: "importe simulado" })} {money(decision.suggestedStake)}</Text><Text style={styles.muted}>{decision.decisionReason || tr({ fi: "Päätös perustuu deterministiseen ytimeen.", en: "The decision is based on the deterministic core.", es: "La decisión se basa en el núcleo determinista." })}</Text>{decision.portfolioReason && <Text style={styles.muted}>{tr({ fi: "Portfolio", en: "Portfolio", es: "Cartera" })}: {decision.portfolioReason}</Text>}
            <Text style={styles.muted}>{tr({ fi: "Urheilukonteksti", en: "Sports context", es: "Contexto deportivo" })}: {context?.status || "unavailable"} · {tr({ fi: "kattavuus", en: "coverage", es: "cobertura" })} {percent(context?.coverageScore)} · {decision.contextGovernance?.blocked ? tr({ fi: "PLAY estetty", en: "PLAY blocked", es: "PLAY bloqueado" }) : tr({ fi: "ei uutta estettä", en: "no new blocker", es: "sin nuevo bloqueo" })}</Text>
            {(context?.sources || []).slice(0, 4).map((source) => <Text key={`${id}-${source.category}`} style={styles.muted}>• {source.category}: {source.provider} · {source.mode}</Text>)}
            <Text style={styles.muted}>{tr({ fi: "Oppiminen", en: "Learning", es: "Aprendizaje" })}: {decision.selfLearning?.status || "shadow"} · {tr({ fi: "otos", en: "sample", es: "muestra" })} {decision.selfLearning?.sampleSize || 0} · drift {decision.selfLearning?.driftStatus || "unknown"} · {tr({ fi: "todennäköisyys muuttumaton", en: "probability unchanged", es: "probabilidad sin cambios" })}</Text>
            <View style={styles.actionRow}><ActionButton label={busyId === id ? tr({ fi: "Odota…", en: "Wait…", es: "Espera…" }) : tr({ fi: "AI-selitys", en: "AI explanation", es: "Explicación IA" })} onPress={() => explain(decision, id)} disabled={busyId !== null} compact tone="secondary" /><ActionButton label={tr({ fi: "Paperiseurantaan", en: "Paper tracking", es: "Seguimiento simulado" })} onPress={() => save(decision, id)} disabled={busyId !== null || decision.decision !== "PLAY" || !decision.suggestedStake} compact /></View>
            {explanation && <View style={{ gap: 8 }}><Text style={styles.cardTitle}>{explanation.enhanced && explanation.authoritative ? tr({ fi: "Valvottu AI-selitys", en: "Governed AI explanation", es: "Explicación IA controlada" }) : tr({ fi: "Deterministinen selitys", en: "Deterministic explanation", es: "Explicación determinista" })}</Text><Text style={styles.muted}>{explanation.explanation.summary}</Text><Text style={styles.value}>{tr({ fi: "Vahvin peruste", en: "Strongest reason", es: "Motivo principal" })}</Text><Text style={styles.muted}>{explanation.explanation.strongestReason}</Text><Text style={styles.value}>{tr({ fi: "Vastaväite", en: "Counterargument", es: "Contraargumento" })}</Text><Text style={styles.muted}>{explanation.explanation.counterpoint}</Text><Text style={styles.value}>{tr({ fi: "Tarkista seuraavaksi", en: "Check next", es: "Comprueba después" })}</Text>{explanation.explanation.nextChecks.map((item) => <Text key={item} style={styles.muted}>• {item}</Text>)}<Text style={styles.muted}>{explanation.explanation.limitation}</Text></View>}
          </Card>;
        })}
      </>}
    </ScrollView>
  );
}
