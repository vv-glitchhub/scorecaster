import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { apiRequest } from "../lib/api";
import { calculatePaperAnalytics } from "../lib/paperAnalytics";
import type { Bankroll, PaperBet } from "../types";
import { ActionButton, Card, money, percent, styles } from "../ui";

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" }) {
  return (
    <View style={localStyles.metricCard}>
      <Text style={localStyles.metricLabel}>{label}</Text>
      <Text
        style={[
          localStyles.metricValue,
          tone === "positive" && localStyles.positive,
          tone === "negative" && localStyles.negative
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [betResponse, bankrollResponse] = await Promise.all([
        apiRequest<{ data: PaperBet[] }>("/api/cloud/bets"),
        apiRequest<{ data: Bankroll }>("/api/cloud/bankroll")
      ]);
      setBets(betResponse.data || []);
      setBankroll(bankrollResponse.data);
    } catch (error) {
      Alert.alert("Analytiikkaa ei voitu ladata", error instanceof Error ? error.message : "Tuntematon virhe");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const analytics = useMemo(() => calculatePaperAnalytics(bets), [bets]);
  const exposurePercent = bankroll?.bankroll
    ? analytics.openExposure / bankroll.bankroll
    : 0;
  const exposureLimit = Number(bankroll?.max_daily_exposure_percent || 0) / 100;
  const exposureRisk = exposureLimit > 0 && exposurePercent >= exposureLimit * 0.8;
  const profitTone = analytics.totalProfit > 0 ? "positive" : analytics.totalProfit < 0 ? "negative" : "neutral";
  const roiTone = analytics.roi > 0 ? "positive" : analytics.roi < 0 ? "negative" : "neutral";

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}>
        <View style={localStyles.titleWrap}>
          <Text style={styles.title}>Analytiikka</Text>
          <Text style={styles.subtitle}>Mittaa prosessia: ROI, CLV, riski ja liigakohtainen tulos.</Text>
        </View>
        <ActionButton label="Päivitä" onPress={load} tone="secondary" compact disabled={loading} />
      </View>

      {loading ? (
        <ActivityIndicator color="#34d399" size="large" />
      ) : (
        <>
          <View style={localStyles.metricGrid}>
            <Metric label="Paperitulos" value={money(analytics.totalProfit)} tone={profitTone} />
            <Metric label="ROI" value={percent(analytics.roi)} tone={roiTone} />
            <Metric label="Osumaprosentti" value={percent(analytics.winRate)} />
            <Metric label="Keskimääräinen CLV" value={`${analytics.averageClv.toFixed(2)} %`} tone={analytics.averageClv > 0 ? "positive" : analytics.averageClv < 0 ? "negative" : "neutral"} />
          </View>

          <Card>
            <Text style={styles.cardTitle}>Riskitilanne</Text>
            <View style={localStyles.statRow}>
              <Text style={styles.muted}>Avoin paperialtistus</Text>
              <Text style={[styles.value, exposureRisk && localStyles.negative]}>
                {money(analytics.openExposure)} · {percent(exposurePercent)}
              </Text>
            </View>
            <View style={localStyles.statRow}>
              <Text style={styles.muted}>Suurin toteutunut lasku</Text>
              <Text style={styles.value}>{money(analytics.maxDrawdown)}</Text>
            </View>
            <View style={localStyles.statRow}>
              <Text style={styles.muted}>Nykyinen putki</Text>
              <Text style={styles.value}>{analytics.currentStreak}</Text>
            </View>
            <View style={localStyles.statRow}>
              <Text style={styles.muted}>Avoimet / ratkaistut</Text>
              <Text style={styles.value}>{analytics.openBets} / {analytics.settledBets}</Text>
            </View>
            {exposureRisk && (
              <Text style={localStyles.warningText}>Avoin altistus lähestyy määritettyä paperirajaa. Uusi kohde kannattaa jättää väliin.</Text>
            )}
          </Card>

          <Card>
            <Text style={styles.cardTitle}>Päätöksenteon laatu</Text>
            <View style={localStyles.statRow}>
              <Text style={styles.muted}>Voitot / tappiot / mitättömät</Text>
              <Text style={styles.value}>{analytics.wins} / {analytics.losses} / {analytics.voids}</Text>
            </View>
            <View style={localStyles.statRow}>
              <Text style={styles.muted}>Keskimääräinen kerroin</Text>
              <Text style={styles.value}>{analytics.averageOdds ? analytics.averageOdds.toFixed(2) : "–"}</Text>
            </View>
            <View style={localStyles.statRow}>
              <Text style={styles.muted}>Positiivisen CLV:n osuus</Text>
              <Text style={styles.value}>{percent(analytics.positiveClvRate)}</Text>
            </View>
            <Text style={styles.muted}>CLV kertoo yleensä prosessin laadusta nopeammin kuin lyhyen jakson voitto tai tappio. Se ei kuitenkaan takaa tulevaa tuottoa.</Text>
          </Card>

          <Card>
            <Text style={styles.cardTitle}>Liigakohtainen tulos</Text>
            {analytics.leagues.length === 0 ? (
              <Text style={styles.muted}>Liigakohtaista dataa syntyy, kun paperivetoja ratkaistaan.</Text>
            ) : (
              analytics.leagues.map((league) => {
                const width = `${Math.min(100, Math.max(4, Math.abs(league.roi) * 250))}%` as const;
                return (
                  <View key={league.league} style={localStyles.leagueRow}>
                    <View style={styles.rowBetween}>
                      <View style={localStyles.leagueNameWrap}>
                        <Text style={styles.value} numberOfLines={1}>{league.league}</Text>
                        <Text style={styles.muted}>{league.settled} ratkaistua · osumat {percent(league.winRate)}</Text>
                      </View>
                      <Text style={[styles.value, league.profit > 0 && localStyles.positive, league.profit < 0 && localStyles.negative]}>
                        {money(league.profit)}
                      </Text>
                    </View>
                    <View style={localStyles.track}>
                      <View
                        style={[
                          localStyles.bar,
                          league.roi < 0 && localStyles.barNegative,
                          { width }
                        ]}
                      />
                    </View>
                    <Text style={styles.muted}>ROI {percent(league.roi)}</Text>
                  </View>
                );
              })
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  titleWrap: { flex: 1 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    width: "48%",
    minHeight: 92,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 14,
    justifyContent: "space-between"
  },
  metricLabel: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  metricValue: { color: "#f8fafc", fontSize: 22, fontWeight: "900" },
  positive: { color: "#34d399" },
  negative: { color: "#fb7185" },
  warningText: { color: "#fbbf24", fontSize: 13, lineHeight: 19, fontWeight: "700" },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  leagueRow: { gap: 7, paddingVertical: 6 },
  leagueNameWrap: { flex: 1, minWidth: 0 },
  track: { height: 5, borderRadius: 999, backgroundColor: "#1e293b", overflow: "hidden" },
  bar: { height: 5, borderRadius: 999, backgroundColor: "#10b981" },
  barNegative: { backgroundColor: "#e11d48" }
});
