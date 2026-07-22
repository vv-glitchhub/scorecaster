import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import { ActionButton, Card, styles } from "../ui";

type Counts = { PLAY: number; CAUTION: number; SKIP: number };
type DiagnosticsPayload = {
  current: { total: number; status: string; counts: Counts; dataQuality: { staleRate: number; averageBookmakers: number | null; averageConfidence: number | null } };
  providerHealth: { status: string; score: number; coverageRate: number; staleRate: number; averageBookmakers: number | null; reasons: string[] };
  history: { available: boolean; warning?: string | null; items: Array<{ id: string; capturedAt: string; total: number; counts: Counts; staleRate: number; providerHealth?: { score?: number } }> };
  alerts: { warning?: string | null; live: Array<{ fingerprint: string; severity: string; title: string; message: string }>; stored: Array<{ id: string; fingerprint: string; severity: string; title: string; message: string; active: boolean }> };
  outcomes: { available: boolean; warning?: string | null; analysis: { settled: number; roi: number; totalProfit: number; averageClv: number | null; positiveClvRate: number | null; byDecision: Array<{ decision: string; settled: number; roi: number; winRate: number; averageClv: number | null }> } };
  simulator: { counts: Counts; changedCount: number };
};

function pct(value: number | null | undefined, digits = 1) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "positive" | "warning" | "negative" | "neutral" }) {
  return <View style={local.metric}><Text style={local.metricLabel}>{label}</Text><Text style={[local.metricValue, tone === "positive" && local.positive, tone === "warning" && local.warning, tone === "negative" && local.negative]}>{value}</Text></View>;
}

export default function DiagnosticsScreen() {
  const { tr, locale } = useLanguage();
  const [data, setData] = useState<DiagnosticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<"production" | "balanced" | "strict">("production");

  async function load(nextPreset = preset) {
    setLoading(true);
    const values = nextPreset === "balanced"
      ? { playEdge: 0.015, playEv: 0.025, playConfidence: 0.5, playBookmakers: 4 }
      : nextPreset === "strict"
        ? { playEdge: 0.03, playEv: 0.05, playConfidence: 0.65, playBookmakers: 5 }
        : { playEdge: 0.02, playEv: 0.03, playConfidence: 0.55, playBookmakers: 4 };
    const query = new URLSearchParams({ limit: "24", ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) });
    try {
      const response = await apiRequest<DiagnosticsPayload>(`/api/diagnostics-v2?${query}`);
      setData(response);
    } catch (error) {
      Alert.alert(tr({ fi: "Diagnostiikkaa ei voitu ladata", en: "Diagnostics could not be loaded", es: "No se pudo cargar el diagnóstico" }), error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load("production"); }, []);

  function choosePreset(next: "production" | "balanced" | "strict") {
    setPreset(next);
    void load(next);
  }

  const activeAlerts = data ? (data.alerts.stored.filter((item) => item.active).length ? data.alerts.stored.filter((item) => item.active) : data.alerts.live) : [];
  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value || 0);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}><View style={local.titleWrap}><Text style={styles.kicker}>DECISION DIAGNOSTICS V2</Text><Text style={styles.title}>{tr({ fi: "Päätösvirran terveystila", en: "Decision-flow health", es: "Salud del flujo de decisiones" })}</Text><Text style={styles.subtitle}>{tr({ fi: "Historia, incidentit, Provider Health, tulokset, CLV ja turvallinen kynnysarvosimulaatio.", en: "History, incidents, Provider Health, outcomes, CLV and safe threshold simulation.", es: "Historial, incidencias, proveedor, resultados, CLV y simulación." })}</Text></View><ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={() => load()} tone="secondary" compact disabled={loading} /></View>

      {loading && !data ? <ActivityIndicator color="#bef264" size="large" /> : null}
      {data ? <>
        <View style={local.grid}><Metric label="PLAY" value={String(data.current.counts.PLAY)} tone="positive" /><Metric label="CAUTION" value={String(data.current.counts.CAUTION)} tone="warning" /><Metric label="SKIP" value={String(data.current.counts.SKIP)} tone="negative" /><Metric label="PROVIDER" value={`${data.providerHealth.score}/100`} tone={data.providerHealth.status === "healthy" ? "positive" : data.providerHealth.status === "down" ? "negative" : "warning"} /></View>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Automaattiset hälytykset", en: "Automatic alerts", es: "Alertas automáticas" })}</Text>{activeAlerts.length === 0 ? <Text style={styles.muted}>{tr({ fi: "Aktiivisia all-SKIP-, stale-data- tai provider-hälytyksiä ei ole.", en: "No active all-SKIP, stale-data or provider alerts.", es: "No hay alertas activas." })}</Text> : activeAlerts.map((item) => <View key={item.fingerprint || item.id} style={[local.alert, item.severity === "high" && local.alertHigh]}><Text style={local.alertTitle}>{item.title}</Text><Text style={styles.muted}>{item.message}</Text></View>)}</Card>

        <Card><Text style={styles.cardTitle}>Provider Health</Text><View style={local.row}><Text style={styles.muted}>{tr({ fi: "Tila", en: "Status", es: "Estado" })}</Text><Text style={styles.value}>{data.providerHealth.status.toUpperCase()}</Text></View><View style={local.row}><Text style={styles.muted}>{tr({ fi: "Hyväksytyt ottelut", en: "Accepted fixtures", es: "Eventos aceptados" })}</Text><Text style={styles.value}>{pct(data.providerHealth.coverageRate)}</Text></View><View style={local.row}><Text style={styles.muted}>{tr({ fi: "Vanhentunut data", en: "Stale data", es: "Datos antiguos" })}</Text><Text style={styles.value}>{pct(data.providerHealth.staleRate)}</Text></View><View style={local.row}><Text style={styles.muted}>{tr({ fi: "Vedonvälittäjiä keskimäärin", en: "Average bookmakers", es: "Casas de media" })}</Text><Text style={styles.value}>{data.providerHealth.averageBookmakers?.toFixed(1) ?? "–"}</Text></View></Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Viimeisimmät snapshotit", en: "Latest snapshots", es: "Snapshots recientes" })}</Text>{!data.history.available ? <Text style={styles.muted}>{data.history.warning}</Text> : data.history.items.length === 0 ? <Text style={styles.muted}>{tr({ fi: "Historia alkaa täyttyä hourly workerin jälkeen.", en: "History appears after the hourly worker runs.", es: "El historial aparecerá tras el proceso horario." })}</Text> : data.history.items.slice(0, 8).map((item) => <View key={item.id} style={local.historyRow}><View style={local.historyHeader}><Text style={styles.value}>{new Date(item.capturedAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text><Text style={styles.muted}>{item.providerHealth?.score ?? "–"}/100</Text></View><Text style={styles.muted}>PLAY {item.counts.PLAY} · CAUTION {item.counts.CAUTION} · SKIP {item.counts.SKIP} · stale {pct(item.staleRate)}</Text></View>)}</Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Tulokset ja CLV päätöksittäin", en: "Outcomes and CLV by decision", es: "Resultados y CLV por decisión" })}</Text>{!data.outcomes.available ? <Text style={styles.muted}>{data.outcomes.warning}</Text> : <><View style={local.grid}><Metric label={tr({ fi: "Ratkaistut", en: "Settled", es: "Resueltos" })} value={String(data.outcomes.analysis.settled)} /><Metric label="ROI" value={pct(data.outcomes.analysis.roi)} tone={data.outcomes.analysis.roi > 0 ? "positive" : data.outcomes.analysis.roi < 0 ? "negative" : "neutral"} /><Metric label={tr({ fi: "Tulos", en: "Result", es: "Resultado" })} value={money(data.outcomes.analysis.totalProfit)} tone={data.outcomes.analysis.totalProfit > 0 ? "positive" : data.outcomes.analysis.totalProfit < 0 ? "negative" : "neutral"} /><Metric label="CLV" value={data.outcomes.analysis.averageClv === null ? "–" : `${data.outcomes.analysis.averageClv.toFixed(2)} %`} /></View>{data.outcomes.analysis.byDecision.map((item) => <View key={item.decision} style={local.decisionRow}><Text style={styles.value}>{item.decision}</Text><Text style={styles.muted}>{item.settled} settled · ROI {pct(item.roi)} · win {pct(item.winRate)} · CLV {item.averageClv === null ? "–" : `${item.averageClv.toFixed(2)} %`}</Text></View>)}</>}</Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Kynnysarvosimulaattori", en: "Threshold simulator", es: "Simulador de umbrales" })}</Text><Text style={styles.muted}>{tr({ fi: "Presetit eivät muuta tuotannon asetuksia tai päätöksiä.", en: "Presets never change production settings or decisions.", es: "Los presets no cambian la producción." })}</Text><View style={local.presetRow}>{(["production", "balanced", "strict"] as const).map((item) => <Pressable key={item} onPress={() => choosePreset(item)} style={[local.preset, preset === item && local.presetActive]}><Text style={[local.presetText, preset === item && local.presetTextActive]}>{item.toUpperCase()}</Text></Pressable>)}</View><View style={local.grid}><Metric label="PLAY" value={String(data.simulator.counts.PLAY)} tone="positive" /><Metric label="CAUTION" value={String(data.simulator.counts.CAUTION)} tone="warning" /><Metric label="SKIP" value={String(data.simulator.counts.SKIP)} tone="negative" /><Metric label={tr({ fi: "Muutokset", en: "Changes", es: "Cambios" })} value={String(data.simulator.changedCount)} /></View></Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Turvaraja", en: "Safety boundary", es: "Límite de seguridad" })}</Text><Text style={styles.muted}>{tr({ fi: "Diagnostiikka on kuvaileva. Se ei muuta todennäköisyyksiä, panoksia tai tuotannon PLAY/CAUTION/SKIP-päätöksiä.", en: "Diagnostics is descriptive. It does not change probabilities, stakes or production PLAY/CAUTION/SKIP decisions.", es: "El diagnóstico es descriptivo y no cambia probabilidades ni decisiones." })}</Text></Card>
      </> : null}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  titleWrap: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48%", minHeight: 88, borderWidth: 1, borderColor: "#263449", backgroundColor: "#101b2d", borderRadius: 17, padding: 14, justifyContent: "space-between" },
  metricLabel: { color: "#8290a8", fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  metricValue: { color: "#f8fafc", fontSize: 23, fontWeight: "900" },
  positive: { color: "#bef264" },
  warning: { color: "#fbbf24" },
  negative: { color: "#fb7185" },
  alert: { borderWidth: 1, borderColor: "#92400e", backgroundColor: "#451a031f", borderRadius: 14, padding: 13, gap: 4 },
  alertHigh: { borderColor: "#9f1239", backgroundColor: "#4c05191f" },
  alertTitle: { color: "#f8fafc", fontSize: 14, fontWeight: "900" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  historyRow: { borderTopWidth: 1, borderTopColor: "#263449", paddingTop: 10, gap: 4 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  decisionRow: { borderTopWidth: 1, borderTopColor: "#263449", paddingTop: 10, gap: 3 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: { minHeight: 42, justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 14, backgroundColor: "#0f172a" },
  presetActive: { borderColor: "#bef264", backgroundColor: "#bef264" },
  presetText: { color: "#94a3b8", fontSize: 11, fontWeight: "900" },
  presetTextActive: { color: "#17200c" }
});