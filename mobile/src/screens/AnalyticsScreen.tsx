import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import { calculatePaperAnalytics } from "../lib/paperAnalytics";
import type { Bankroll, PaperBet } from "../types";
import { ActionButton, Card, percent, styles } from "../ui";

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" }) {
  return <View style={localStyles.metricCard}><Text style={localStyles.metricLabel}>{label}</Text><Text style={[localStyles.metricValue, tone === "positive" && localStyles.positive, tone === "negative" && localStyles.negative]}>{value}</Text></View>;
}
function signedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "–";
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${normalized > 0 ? "+" : ""}${normalized.toFixed(1)} %`;
}

export default function AnalyticsScreen() {
  const { tr, locale } = useLanguage();
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [loading, setLoading] = useState(true);
  const money = (value: unknown) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));

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
      Alert.alert(tr({ fi: "Analytiikkaa ei voitu ladata", en: "Analytics could not be loaded", es: "No se pudo cargar la analítica" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const analytics = useMemo(() => calculatePaperAnalytics(bets), [bets]);
  const exposurePercent = bankroll?.bankroll ? analytics.openExposure / bankroll.bankroll : 0;
  const exposureLimit = Number(bankroll?.max_daily_exposure_percent || 0) / 100;
  const exposureRisk = exposureLimit > 0 && exposurePercent >= exposureLimit * 0.8;
  const profitTone = analytics.totalProfit > 0 ? "positive" : analytics.totalProfit < 0 ? "negative" : "neutral";
  const roiTone = analytics.roi > 0 ? "positive" : analytics.roi < 0 ? "negative" : "neutral";
  const calibrationTone = analytics.calibrationGap === null ? "neutral" : Math.abs(analytics.calibrationGap) <= 0.05 ? "positive" : Math.abs(analytics.calibrationGap) >= 0.15 ? "negative" : "neutral";

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}><View style={localStyles.titleWrap}><Text style={styles.title}>{tr({ fi: "Analytiikka", en: "Analytics", es: "Analítica" })}</Text><Text style={styles.subtitle}>{tr({ fi: "Mittaa prosessia: ROI, CLV, riski, kalibrointi ja liigakohtainen tulos.", en: "Measure the process: ROI, CLV, risk, calibration and league performance.", es: "Mide el proceso: ROI, CLV, riesgo, calibración y rendimiento por liga." })}</Text></View><ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={load} tone="secondary" compact disabled={loading} /></View>

      {loading ? <ActivityIndicator color="#34d399" size="large" /> : <>
        <View style={localStyles.metricGrid}><Metric label={tr({ fi: "Paperitulos", en: "Paper result", es: "Resultado simulado" })} value={money(analytics.totalProfit)} tone={profitTone} /><Metric label="ROI" value={percent(analytics.roi)} tone={roiTone} /><Metric label={tr({ fi: "Osumaprosentti", en: "Win rate", es: "Porcentaje de acierto" })} value={percent(analytics.winRate)} /><Metric label={tr({ fi: "Keskimääräinen CLV", en: "Average CLV", es: "CLV medio" })} value={`${analytics.averageClv.toFixed(2)} %`} tone={analytics.averageClv > 0 ? "positive" : analytics.averageClv < 0 ? "negative" : "neutral"} /></View>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Riskitilanne", en: "Risk status", es: "Estado del riesgo" })}</Text><View style={localStyles.statRow}><Text style={styles.muted}>{tr({ fi: "Avoin paperialtistus", en: "Open paper exposure", es: "Exposición simulada abierta" })}</Text><Text style={[styles.value, exposureRisk && localStyles.negative]}>{money(analytics.openExposure)} · {percent(exposurePercent)}</Text></View><View style={localStyles.statRow}><Text style={styles.muted}>{tr({ fi: "Suurin toteutunut lasku", en: "Maximum drawdown", es: "Caída máxima" })}</Text><Text style={styles.value}>{money(analytics.maxDrawdown)}</Text></View><View style={localStyles.statRow}><Text style={styles.muted}>{tr({ fi: "Nykyinen putki", en: "Current streak", es: "Racha actual" })}</Text><Text style={styles.value}>{analytics.currentStreak}</Text></View><View style={localStyles.statRow}><Text style={styles.muted}>{tr({ fi: "Avoimet / ratkaistut", en: "Open / settled", es: "Abiertos / resueltos" })}</Text><Text style={styles.value}>{analytics.openBets} / {analytics.settledBets}</Text></View>{exposureRisk && <Text style={localStyles.warningText}>{tr({ fi: "Avoin altistus lähestyy paperirajaa. Uusi kohde kannattaa jättää väliin.", en: "Open exposure is approaching the paper limit. Consider skipping a new pick.", es: "La exposición abierta se acerca al límite simulado. Conviene omitir un nuevo pronóstico." })}</Text>}</Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Päätöksenteon laatu", en: "Decision quality", es: "Calidad de las decisiones" })}</Text><View style={localStyles.statRow}><Text style={styles.muted}>{tr({ fi: "Voitot / tappiot / mitättömät", en: "Wins / losses / voids", es: "Victorias / derrotas / anulados" })}</Text><Text style={styles.value}>{analytics.wins} / {analytics.losses} / {analytics.voids}</Text></View><View style={localStyles.statRow}><Text style={styles.muted}>{tr({ fi: "Keskimääräinen kerroin", en: "Average odds", es: "Cuota media" })}</Text><Text style={styles.value}>{analytics.averageOdds ? analytics.averageOdds.toFixed(2) : "–"}</Text></View><View style={localStyles.statRow}><Text style={styles.muted}>{tr({ fi: "Positiivisen CLV:n osuus", en: "Positive CLV rate", es: "Tasa de CLV positivo" })}</Text><Text style={styles.value}>{percent(analytics.positiveClvRate)}</Text></View><Text style={styles.muted}>{tr({ fi: "CLV auttaa arvioimaan prosessia tuloksesta riippumatta, mutta ei takaa tulevaa tuottoa.", en: "CLV helps evaluate the process independently of the result, but does not guarantee future returns.", es: "El CLV ayuda a evaluar el proceso con independencia del resultado, pero no garantiza beneficios futuros." })}</Text></Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Todennäköisyyksien kalibrointi", en: "Probability calibration", es: "Calibración de probabilidades" })}</Text>{analytics.calibratedBets === 0 ? <Text style={styles.muted}>{tr({ fi: "Kalibrointi alkaa näkyä, kun Scorecaster-kohteita on ratkaistu. Manuaaliset merkinnät ilman mallin todennäköisyyttä eivät vääristä mittaria.", en: "Calibration appears after Scorecaster picks are settled. Manual entries without model probabilities do not distort the metric.", es: "La calibración aparece cuando se resuelven pronósticos de Scorecaster. Las entradas manuales sin probabilidad del modelo no distorsionan la métrica." })}</Text> : <><View style={localStyles.statRow}><Text style={styles.muted}>{tr({ fi: "Kalibroituja kohteita", en: "Calibrated picks", es: "Pronósticos calibrados" })}</Text><Text style={styles.value}>{analytics.calibratedBets}</Text></View><View style={localStyles.statRow}><Text style={styles.muted}>{tr({ fi: "Mallin odottama osumataso", en: "Expected win rate", es: "Tasa esperada" })}</Text><Text style={styles.value}>{analytics.expectedWinRate === null ? "–" : percent(analytics.expectedWinRate)}</Text></View><View style={localStyles.statRow}><Text style={styles.muted}>{tr({ fi: "Toteutunut osumataso", en: "Actual win rate", es: "Tasa real" })}</Text><Text style={styles.value}>{analytics.actualCalibratedWinRate === null ? "–" : percent(analytics.actualCalibratedWinRate)}</Text></View><View style={localStyles.statRow}><Text style={styles.muted}>{tr({ fi: "Kalibrointiero", en: "Calibration gap", es: "Diferencia de calibración" })}</Text><Text style={[styles.value, calibrationTone === "positive" && localStyles.positive, calibrationTone === "negative" && localStyles.negative]}>{signedPercent(analytics.calibrationGap)}</Text></View><View style={localStyles.statRow}><Text style={styles.muted}>Brier score</Text><Text style={styles.value}>{analytics.brierScore === null ? "–" : analytics.brierScore.toFixed(3)}</Text></View><Text style={styles.muted}>{tr({ fi: "Pienempi Brier score on parempi. Pieni otos voi näyttää sattuman vuoksi liian hyvältä tai huonolta.", en: "A lower Brier score is better. A small sample can look unusually good or bad by chance.", es: "Una puntuación Brier menor es mejor. Una muestra pequeña puede parecer demasiado buena o mala por azar." })}</Text></>}</Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Liigakohtainen tulos", en: "Performance by league", es: "Rendimiento por liga" })}</Text>{analytics.leagues.length === 0 ? <Text style={styles.muted}>{tr({ fi: "Liigakohtaista dataa syntyy, kun paperikohteita ratkaistaan.", en: "League data appears after paper picks are settled.", es: "Los datos por liga aparecen cuando se resuelven pronósticos simulados." })}</Text> : analytics.leagues.map((league) => { const width = `${Math.min(100, Math.max(4, Math.abs(league.roi) * 250))}%` as const; return <View key={league.league} style={localStyles.leagueRow}><View style={styles.rowBetween}><View style={localStyles.leagueNameWrap}><Text style={styles.value} numberOfLines={1}>{league.league}</Text><Text style={styles.muted}>{league.settled} {tr({ fi: "ratkaistua", en: "settled", es: "resueltos" })} · {tr({ fi: "osumat", en: "hit rate", es: "aciertos" })} {percent(league.winRate)}</Text></View><Text style={[styles.value, league.profit > 0 && localStyles.positive, league.profit < 0 && localStyles.negative]}>{money(league.profit)}</Text></View><View style={localStyles.track}><View style={[localStyles.bar, league.roi < 0 && localStyles.barNegative, { width }]} /></View><Text style={styles.muted}>ROI {percent(league.roi)}</Text></View>; })}</Card>
      </>}
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  titleWrap: { flex: 1 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { width: "48%", minHeight: 92, borderWidth: 1, borderColor: "#1e293b", backgroundColor: "#0f172a", borderRadius: 16, padding: 14, justifyContent: "space-between" },
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
