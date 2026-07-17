import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { apiRequest } from "../lib/api";
import type {
  AgentDecision,
  AgentExplanationPayload,
  AgentPortfolio,
  Bankroll
} from "../types";
import { ActionButton, Card, money, percent, styles } from "../ui";

function decisionTone(decision: AgentDecision["decision"]) {
  if (decision === "PLAY") return null;
  if (decision === "WATCH") return styles.warningBadge;
  return styles.dangerBadge;
}

function decisionKey(decision: AgentDecision, index: number) {
  return String(decision.gameId || decision.eventId || decision.id || `${decision.match}-${decision.selection}-${index}`);
}

export default function AgentScreen() {
  const [portfolio, setPortfolio] = useState<AgentPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, AgentExplanationPayload>>({});

  async function load() {
    setLoading(true);
    try {
      const bankrollResponse = await apiRequest<{ data: Bankroll }>("/api/cloud/bankroll");
      const bankroll = bankrollResponse.data;
      const response = await apiRequest<AgentPortfolio>("/api/agent/portfolio", {
        method: "POST",
        timeoutMs: 45000,
        body: {
          settings: {
            bankroll: bankroll.bankroll,
            maxStakePercent: bankroll.max_stake_percent,
            maxTotalExposurePercent: bankroll.max_daily_exposure_percent,
            maxLeagueExposurePercent: bankroll.max_single_league_exposure_percent ?? 4
          }
        }
      });
      setPortfolio(response);
    } catch (error) {
      Alert.alert("AI-portfoliota ei voitu ladata", error instanceof Error ? error.message : "Tuntematon virhe");
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
        body: {
          decision,
          ticket: decision.explanationTicket || null
        }
      });
      setExplanations((current) => ({ ...current, [id]: response }));
    } catch (error) {
      Alert.alert("AI-selitystä ei voitu luoda", error instanceof Error ? error.message : "Tuntematon virhe");
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
        body: {
          bets: [{
            id,
            eventId: decision.gameId || decision.eventId || decision.id,
            match: decision.match || [decision.homeTeam, decision.awayTeam].filter(Boolean).join(" – "),
            homeTeam: decision.homeTeam,
            awayTeam: decision.awayTeam,
            selection: decision.selection || decision.label,
            odds: decision.odds,
            stake: decision.suggestedStake,
            edge: decision.edge,
            ev: decision.ev,
            confidence: decision.confidence,
            league: decision.league || decision.leagueTitle,
            sport: decision.sportKey,
            bookmaker: decision.bookmaker,
            decision: decision.decision,
            qualityScore: decision.trustScore,
            modelProbability: decision.stressTest?.probability || decision.consensusProbability,
            impliedProbability: decision.marketProbability,
            source: "scorecaster-mobile-agent-v10"
          }]
        }
      });
      Alert.alert("Tallennettu paperiseurantaan", "Agent V10 -kohde lisättiin virtuaaliseen seurantaan. Oikeaa vetoa ei asetettu.");
    } catch (error) {
      Alert.alert("Tallennus epäonnistui", error instanceof Error ? error.message : "Tuntematon virhe");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Agent V10</Text>
          <Text style={styles.subtitle}>Palvelimen laskema vastatesti, portfoliohallinta ja valvottu selitys. Paperiseuranta vain.</Text>
        </View>
        <ActionButton label="Päivitä" onPress={load} compact tone="secondary" disabled={loading || busyId !== null} />
      </View>

      {loading && <ActivityIndicator color="#34d399" size="large" />}

      {!loading && portfolio && (
        <>
          <Card>
            <Text style={styles.cardTitle}>AI-portfolio</Text>
            <Text style={styles.metric}>{money(portfolio.totalAllocated)}</Text>
            <Text style={styles.muted}>
              PLAY {portfolio.counts.PLAY} · WATCH {portfolio.counts.WATCH} · SKIP {portfolio.counts.SKIP}
            </Text>
            <Text style={styles.muted}>
              Altistus {percent(portfolio.exposurePercent)} · kokonaiskatto {money(portfolio.totalCap)} · liigakatto {money(portfolio.leagueCap)}
            </Text>
            <Text style={styles.muted}>
              Selitystila: {portfolio.signingConfigured ? "palvelimen allekirjoittama päätös" : "deterministinen varaselitys"}
            </Text>
            {(portfolio.warnings || []).map((warning) => <Text key={warning} style={styles.muted}>• {warning}</Text>)}
          </Card>

          {portfolio.decisions.slice(0, 12).map((decision, index) => {
            const id = decisionKey(decision, index);
            const explanation = explanations[id];
            const stress = decision.stressTest || {};
            const price = decision.priceGuard || {};

            return (
              <Card key={id}>
                <View style={styles.rowBetween}>
                  <View style={[styles.badge, decisionTone(decision.decision)]}>
                    <Text style={styles.badgeText}>{decision.decision}</Text>
                  </View>
                  <Text style={styles.muted}>{decision.leagueTitle || decision.league || decision.sportKey || "Sport"}</Text>
                </View>

                <Text style={styles.cardTitle}>{decision.match || `${decision.homeTeam || ""} – ${decision.awayTeam || ""}`}</Text>
                <Text style={styles.value}>{decision.selection || decision.label} · {Number(decision.odds || 0).toFixed(2)}</Text>
                <Text style={styles.muted}>{decision.bookmaker || "Paras saatavilla oleva hinta"}</Text>

                <View style={styles.divider} />
                <Text style={styles.muted}>
                  Konsensus {percent(stress.probability)} · stressialue {percent(stress.lower)}–{percent(stress.upper)}
                </Text>
                <Text style={styles.muted}>
                  Perus-EV {percent(stress.baseEv)} · alarajan EV {percent(stress.downsideEv)} · robustness {percent(decision.robustnessScore)}
                </Text>
                <Text style={styles.muted}>
                  Kerroinraja {Number(price.minimumPlayOdds || 0).toFixed(2)} · paperipanos {money(decision.suggestedStake)}
                </Text>
                <Text style={styles.muted}>{decision.decisionReason || "Päätös perustuu deterministiseen Agent V9 -ytimeen."}</Text>
                {decision.portfolioReason && <Text style={styles.muted}>Portfolio: {decision.portfolioReason}</Text>}

                <View style={styles.actionRow}>
                  <ActionButton
                    label={busyId === id ? "Odota…" : "AI-selitys"}
                    onPress={() => explain(decision, id)}
                    disabled={busyId !== null}
                    compact
                    tone="secondary"
                  />
                  <ActionButton
                    label="Paperiseurantaan"
                    onPress={() => save(decision, id)}
                    disabled={busyId !== null || decision.decision !== "PLAY" || !decision.suggestedStake}
                    compact
                  />
                </View>

                {explanation && (
                  <View style={{ gap: 8 }}>
                    <Text style={styles.cardTitle}>{explanation.enhanced && explanation.authoritative ? "Valvottu AI-selitys" : "Deterministinen selitys"}</Text>
                    <Text style={styles.muted}>{explanation.explanation.summary}</Text>
                    <Text style={styles.value}>Vahvin peruste</Text>
                    <Text style={styles.muted}>{explanation.explanation.strongestReason}</Text>
                    <Text style={styles.value}>Vastaväite</Text>
                    <Text style={styles.muted}>{explanation.explanation.counterpoint}</Text>
                    <Text style={styles.value}>Tarkista seuraavaksi</Text>
                    {explanation.explanation.nextChecks.map((item) => <Text key={item} style={styles.muted}>• {item}</Text>)}
                    <Text style={styles.muted}>{explanation.explanation.limitation}</Text>
                  </View>
                )}
              </Card>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}
