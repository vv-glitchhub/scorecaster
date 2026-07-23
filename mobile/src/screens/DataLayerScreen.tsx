import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import { ActionButton, Card, styles } from "../ui";

type Factor = {
  key: string;
  title: string;
  status: string;
  confidence: number;
  trust: number;
  impact: number;
  direction: string;
  useMode: string;
  usedByAi: boolean;
  reason: string;
  missing?: string[];
};

type Ledger = {
  coverage: { totalFamilies: number; configuredFamilies: number; usedFamilies: number; verifiedCoverageRate: number; independentOddsProviders: number };
  factors: Factor[];
  totalBoundedContextImpact: number;
  aiExplanation: { headline: string; explanation: string[] };
  safetyRecommendation: { action: string; reasons: string[] };
  missingData: Array<{ factor: string; missing: string }>;
};

type DataRow = { eventId: string; match: string; selection: string; decision: string; odds: number; ledger: Ledger | null };
type Payload = { data: DataRow[]; safety: { probabilitySource: string; contextCanUpgrade: boolean; paperOnly: boolean } };

type ProviderQuality = {
  provider: string;
  family: string;
  samples: number;
  availabilityRate: number;
  averageTrust: number | null;
  averageDivergence: number | null;
  status: string;
};

type Incident = { fingerprint: string; severity: string; title: string; message: string; active: boolean };
type ClosingRecord = { event_id: string; selection: string; opening_odds: number | null; closing_odds: number; price_clv: number | null };
type HistoryPayload = {
  historyAvailable: boolean;
  reason?: string;
  data: {
    summary: { snapshotCount: number; currentSelections: number; closingRecordCount: number; activeIncidentCount: number; averageCurrentCoverage: number; multiProviderSelections: number };
    providerQuality: ProviderQuality[];
    incidents: Incident[];
    closingRecords: ClosingRecord[];
    trend: Array<{ capturedAt: string; averageCoverage: number; averageProviderCount: number; downgradeCount: number; providerDisagreementCount: number }>;
  };
};

function emptyHistory(reason: string): HistoryPayload {
  return {
    historyAvailable: false,
    reason,
    data: {
      summary: { snapshotCount: 0, currentSelections: 0, closingRecordCount: 0, activeIncidentCount: 0, averageCurrentCoverage: 0, multiProviderSelections: 0 },
      providerQuality: [],
      incidents: [],
      closingRecords: [],
      trend: []
    }
  };
}

function pct(value: number | null | undefined, digits = 0) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";
}

function pp(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? "+" : ""}${(Number(value) * 100).toFixed(2)} pp` : "–";
}

function decimal(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "–";
}

export default function DataLayerScreen() {
  const { tr } = useLanguage();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const next = await apiRequest<Payload>("/api/data-layer");
      setPayload(next);
      setSelectedId((current) => current || next.data?.[0]?.eventId || "");
      try {
        setHistory(await apiRequest<HistoryPayload>("/api/data-layer/history?hours=168&limit=1200"));
      } catch (historyError) {
        setHistory(emptyHistory(historyError instanceof Error ? historyError.message : "History unavailable"));
      }
    } catch (error) {
      Alert.alert(tr({ fi: "Datakerrosta ei voitu ladata", en: "Data layer could not be loaded", es: "No se pudo cargar la capa" }), error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  const selected = useMemo(() => payload?.data?.find((row) => row.eventId === selectedId) || payload?.data?.[0] || null, [payload, selectedId]);
  const ledger = selected?.ledger;
  const summary = history?.data?.summary;
  const activeIncidents = (history?.data?.incidents || []).filter((item) => item.active !== false);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}><View style={local.titleWrap}><Text style={styles.kicker}>UNIFIED SPORTS DATA V2</Text><Text style={styles.title}>{tr({ fi: "Mitä dataa AI käytti", en: "What data AI used", es: "Qué datos utilizó la IA" })}</Text><Text style={styles.subtitle}>{tr({ fi: "Nykyinen ledger, 30 minuutin historia, provider-laatu, closing odds ja incidentit.", en: "Current ledger, 30-minute history, provider quality, closing odds and incidents.", es: "Registro actual, historial, calidad, cierre e incidentes." })}</Text></View><ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={() => load()} tone="secondary" compact disabled={loading} /></View>
      {loading && !payload ? <ActivityIndicator color="#bef264" size="large" /> : null}
      {payload?.data?.length === 0 ? <Card><Text style={styles.cardTitle}>{tr({ fi: "Nykyisiä kohteita ei ole", en: "No current selections", es: "No hay selecciones" })}</Text></Card> : null}

      <View style={local.selectorGrid}>
        {(payload?.data || []).map((row) => <Pressable key={`${row.eventId}:${row.selection}`} onPress={() => setSelectedId(row.eventId)} style={[local.selector, selected?.eventId === row.eventId && local.selectorActive]}><View style={styles.rowBetween}><Text style={local.selectorTitle}>{row.match}</Text><Text style={local.decision}>{row.decision}</Text></View><Text style={styles.muted}>{row.selection} · {Number(row.odds || 0).toFixed(2)}</Text><Text style={styles.muted}>{row.ledger?.coverage?.usedFamilies || 0} used · {pct(row.ledger?.coverage?.verifiedCoverageRate)} verified · {row.ledger?.coverage?.independentOddsProviders || 1} odds providers</Text></Pressable>)}
      </View>

      {ledger ? <>
        <View style={local.grid}><Metric label={tr({ fi: "AI käytti", en: "AI used", es: "IA usó" })} value={String(ledger.coverage.usedFamilies)} /><Metric label={tr({ fi: "Varmennettu", en: "Verified", es: "Verificado" })} value={pct(ledger.coverage.verifiedCoverageRate)} /><Metric label={tr({ fi: "Odds-providerit", en: "Odds providers", es: "Proveedores" })} value={String(ledger.coverage.independentOddsProviders)} /><Metric label={tr({ fi: "Kontekstivaikutus", en: "Context impact", es: "Impacto" })} value={pp(ledger.totalBoundedContextImpact)} /></View>
        <Card><Text style={styles.cardTitle}>{ledger.aiExplanation?.headline}</Text>{(ledger.aiExplanation?.explanation || []).map((line) => <Text key={line} style={styles.muted}>{line}</Text>)}</Card>
        <Card><Text style={styles.cardTitle}>{tr({ fi: "Signaalit", en: "Signals", es: "Señales" })}</Text>{ledger.factors.map((item) => <View key={item.key} style={local.factor}><View style={styles.rowBetween}><View style={local.factorTitleWrap}><Text style={styles.value}>{item.title}</Text><Text style={styles.muted}>{item.useMode} · {item.status}</Text></View><View style={[local.usedBadge, !item.usedByAi && local.notUsedBadge]}><Text style={[local.usedText, !item.usedByAi && local.notUsedText]}>{item.usedByAi ? "AI USED" : "NOT USED"}</Text></View></View><Text style={styles.muted}>{item.reason}</Text><Text style={styles.muted}>Impact {pp(item.impact)} · confidence {pct(item.confidence)} · trust {pct(item.trust)}</Text></View>)}</Card>
      </> : null}

      <Card>
        <Text style={styles.kicker}>30 MIN HISTORY</Text>
        <Text style={styles.cardTitle}>{tr({ fi: "Datakerroksen tuotantohistoria", en: "Production data history", es: "Historial de producción" })}</Text>
        {history?.historyAvailable ? <View style={local.grid}><Metric label={tr({ fi: "Snapshotteja", en: "Snapshots", es: "Capturas" })} value={String(summary?.snapshotCount || 0)} /><Metric label={tr({ fi: "Kattavuus", en: "Coverage", es: "Cobertura" })} value={pct(summary?.averageCurrentCoverage)} /><Metric label="Multi-provider" value={String(summary?.multiProviderSelections || 0)} /><Metric label="Closing" value={String(summary?.closingRecordCount || 0)} /></View> : <Text style={styles.muted}>{history?.reason || tr({ fi: "Historia aktivoituu Supabase-migraation ja capture-workerin jälkeen. Nykyinen ledger toimii silti.", en: "History activates after migration and capture. The current ledger still works.", es: "El historial se activa tras la migración. El registro actual sigue funcionando." })}</Text>}
      </Card>

      {history?.historyAvailable ? <>
        <Card><Text style={styles.cardTitle}>Provider Quality</Text>{(history.data.providerQuality || []).map((provider) => <View key={provider.provider} style={local.factor}><View style={styles.rowBetween}><View style={local.factorTitleWrap}><Text style={styles.value}>{provider.provider}</Text><Text style={styles.muted}>{provider.family} · {provider.samples} samples</Text></View><Text style={[local.status, provider.status === "healthy" ? local.healthy : provider.status === "offline" ? local.offline : local.degraded]}>{provider.status.toUpperCase()}</Text></View><Text style={styles.muted}>Availability {pct(provider.availabilityRate)} · trust {pct(provider.averageTrust)} · divergence {pct(provider.averageDivergence, 1)}</Text></View>)}</Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Aktiiviset incidentit", en: "Active incidents", es: "Incidentes activos" })}</Text>{activeIncidents.length === 0 ? <Text style={styles.muted}>{tr({ fi: "Ei aktiivisia datakerrosincidenttejä.", en: "No active data-layer incidents.", es: "No hay incidentes activos." })}</Text> : activeIncidents.slice(0, 10).map((item) => <View key={item.fingerprint} style={local.factor}><Text style={styles.value}>{item.severity.toUpperCase()} · {item.title}</Text><Text style={styles.muted}>{item.message}</Text></View>)}</Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Closing odds ja markkina-CLV", en: "Closing odds and market CLV", es: "Cierre y CLV" })}</Text>{(history.data.closingRecords || []).slice(0, 12).map((row) => <View key={`${row.event_id}:${row.selection}`} style={local.factor}><Text style={styles.value}>{row.selection}</Text><Text style={styles.muted}>{decimal(row.opening_odds)} → {decimal(row.closing_odds)} · CLV {pct(row.price_clv, 1)}</Text></View>)}{(history.data.closingRecords || []).length === 0 ? <Text style={styles.muted}>{tr({ fi: "Closing-recordit syntyvät seurattujen otteluiden alkaessa.", en: "Closing records appear when tracked events start.", es: "Los cierres aparecen al comenzar los eventos." })}</Text> : null}</Card>
      </> : null}

      <Card><Text style={styles.cardTitle}>{tr({ fi: "Turvaraja", en: "Safety boundary", es: "Límite" })}</Text><Text style={styles.muted}>{tr({ fi: "Todennäköisyys tulee no-vig-markkinakonsensuksesta. Konteksti ei voi nostaa päätöstä PLAYksi, ja closing odds lukitaan vasta viimeisestä ennen aloitusta tallennetusta snapshotista.", en: "Probability comes from no-vig market consensus. Context cannot upgrade to PLAY, and closing odds are locked only from the final pre-start snapshot.", es: "La probabilidad proviene del consenso. El contexto no puede elevar a PLAY." })}</Text></Card>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={local.metric}><Text style={local.metricLabel}>{label}</Text><Text style={local.metricValue}>{value}</Text></View>;
}

const local = StyleSheet.create({
  titleWrap: { flex: 1 },
  selectorGrid: { gap: 10 },
  selector: { borderWidth: 1, borderColor: "#263449", backgroundColor: "#101b2d", borderRadius: 17, padding: 14, gap: 5 },
  selectorActive: { borderColor: "#93c5fd", backgroundColor: "#172554" },
  selectorTitle: { flex: 1, color: "#f8fafc", fontSize: 14, fontWeight: "900" },
  decision: { color: "#bef264", fontSize: 11, fontWeight: "900" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48%", minHeight: 84, borderWidth: 1, borderColor: "#263449", backgroundColor: "#101b2d", borderRadius: 17, padding: 14, justifyContent: "space-between" },
  metricLabel: { color: "#8290a8", fontSize: 11, fontWeight: "800" },
  metricValue: { color: "#f8fafc", fontSize: 22, fontWeight: "900" },
  factor: { borderTopWidth: 1, borderTopColor: "#263449", paddingTop: 12, gap: 6 },
  factorTitleWrap: { flex: 1 },
  usedBadge: { borderRadius: 999, backgroundColor: "#c4b5fd", paddingHorizontal: 9, paddingVertical: 5 },
  notUsedBadge: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#475569" },
  usedText: { color: "#172033", fontSize: 9, fontWeight: "900" },
  notUsedText: { color: "#94a3b8" },
  status: { fontSize: 9, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
  healthy: { backgroundColor: "#14532d", color: "#bbf7d0" },
  degraded: { backgroundColor: "#78350f", color: "#fde68a" },
  offline: { backgroundColor: "#7f1d1d", color: "#fecaca" }
});