import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import { ActionButton, Card, styles } from "../ui";

type AutonomyState = {
  mode: string;
  reason: string;
  stakeMultiplier: number;
  pickCap: number;
  blockers: string[];
  warnings: string[];
  history: {
    settledCount: number;
    roi: number | null;
    maxDrawdown: number;
    maxDrawdownRate: number;
    currentLosingStreak: number;
    recent30: { bankrollImpact: number | null };
    clv: { count: number; average: number | null; positiveRate: number | null };
  };
  dataReadiness: {
    candidateCount: number;
    averageVerifiedCoverage: number;
    multiProviderRate: number;
    averageOddsProviders: number;
  };
  modelLab: { status: string; sampleSize: number; driftStatus: string; challengerId: string | null };
  exposure: { openCount: number; openStake: number };
};

type DailyBudget = {
  dayStart: string;
  pickLimit: number;
  picksUsed: number;
  picksRemaining: number;
  stakeUsed: number;
  exposureCap: number;
  exposureRemaining: number;
  uniqueEvents: number;
  hardLimits: {
    maxStakePercent: number;
    maxDailyExposurePercent: number;
    maxLeagueExposurePercent: number;
  };
};

type Candidate = {
  eventId: string | null;
  match: string;
  selection: string;
  decision: string;
  odds: number;
  edge: number;
  verifiedCoverage: number | null;
  oddsProviders: number;
  safetyAction: string | null;
};

type Run = {
  id: string;
  status: string;
  saved_count: number;
  total_stake: number;
  candidate_count: number;
  started_at: string;
  error?: string | null;
};

type MissionPayload = {
  available: boolean;
  warning?: string;
  autonomy: AutonomyState;
  daily: DailyBudget;
  brief: { headline: string; canCreateNewPaperExposure: boolean; recommendations: string[] };
  configuration: { configured: boolean; agentActive: boolean };
  settings: { enabled: boolean };
  state: { next_check_at?: string | null } | null;
  modelLab: { status: string; sampleSize: number; minimumSamples: number; drift: { status: string }; challenger?: { id?: string } | null };
  currentCandidates: Candidate[];
  runs: Run[];
  paperOnly: boolean;
};

function pct(value: number | null | undefined, digits = 1) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";
}

function money(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)} €` : "–";
}

function modeStyle(mode: string) {
  if (mode === "ACTIVE") return local.active;
  if (mode === "GUARDED") return local.guarded;
  if (mode === "BOOTSTRAP") return local.bootstrap;
  if (mode === "DEGRADED") return local.degraded;
  return local.frozen;
}

export default function MissionControlScreen() {
  const { tr } = useLanguage();
  const [payload, setPayload] = useState<MissionPayload | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setPayload(await apiRequest<MissionPayload>("/api/cloud/autonomy-mission-control"));
    } catch (error) {
      Alert.alert(
        tr({ fi: "Mission Controlia ei voitu ladata", en: "Mission Control could not be loaded", es: "No se pudo cargar Mission Control" }),
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const autonomy = payload?.autonomy;
  const daily = payload?.daily;
  const history = autonomy?.history;
  const readiness = autonomy?.dataReadiness;
  const mode = autonomy?.mode || "FROZEN";

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}>
        <View style={local.titleWrap}>
          <Text style={styles.kicker}>AUTONOMOUS SCORECASTER V12</Text>
          <Text style={styles.title}>{tr({ fi: "Mission Control", en: "Mission Control", es: "Centro de control" })}</Text>
          <Text style={styles.subtitle}>{tr({ fi: "Oppiminen, paperipelikassa, pysyvä UTC-päiväkiintiö, provider-data, circuit breakerit ja worker-ajot yhdessä näkymässä.", en: "Learning, paper bankroll, persistent UTC daily budget, provider data, circuit breakers and worker cycles in one view.", es: "Aprendizaje, banca simulada, presupuesto UTC, datos, límites y ciclos en una vista." })}</Text>
        </View>
        <ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={() => load()} tone="secondary" compact disabled={loading} />
      </View>

      {loading && !payload ? <ActivityIndicator color="#bef264" size="large" /> : null}
      {payload?.available === false ? <Card><Text style={styles.cardTitle}>{tr({ fi: "Tuotantokerros ei ole aktiivinen", en: "Production layer is not active", es: "La capa no está activa" })}</Text><Text style={styles.muted}>{payload.warning}</Text></Card> : null}

      {autonomy ? <>
        <View style={[local.modeCard, modeStyle(mode)]}>
          <Text style={local.modeKicker}>AUTONOMY MODE</Text>
          <Text style={local.modeTitle}>{mode}</Text>
          <Text style={local.modeText}>{autonomy.reason}</Text>
        </View>

        <Card>
          <Text style={styles.kicker}>{tr({ fi: "PYSYVÄ UTC-PÄIVÄBUDJETTI", en: "PERSISTENT UTC DAILY BUDGET", es: "PRESUPUESTO UTC PERSISTENTE" })}</Text>
          <Text style={styles.cardTitle}>{tr({ fi: "Kaikki worker-kierrokset käyttävät samaa päivän kiintiötä", en: "Every worker cycle shares the same daily quota", es: "Todos los ciclos comparten la misma cuota diaria" })}</Text>
          <View style={local.grid}>
            <Metric label={tr({ fi: "Valinnat", en: "Picks", es: "Selecciones" })} value={`${daily?.picksUsed || 0}/${daily?.pickLimit || 0}`} />
            <Metric label={tr({ fi: "Jäljellä", en: "Remaining", es: "Restante" })} value={String(daily?.picksRemaining || 0)} />
            <Metric label={tr({ fi: "Panos käytetty", en: "Stake used", es: "Apuesta usada" })} value={`${money(daily?.stakeUsed)} / ${money(daily?.exposureCap)}`} />
            <Metric label={tr({ fi: "Budjettia jäljellä", en: "Budget remaining", es: "Presupuesto restante" })} value={money(daily?.exposureRemaining)} />
            <Metric label={tr({ fi: "Yksittäinen PLAY", en: "Single PLAY", es: "PLAY individual" })} value={`≤ ${daily?.hardLimits?.maxStakePercent || 1}%`} />
            <Metric label={tr({ fi: "Päivä / avoin", en: "Daily / open", es: "Diario / abierto" })} value={`≤ ${daily?.hardLimits?.maxDailyExposurePercent || 5}%`} />
            <Metric label={tr({ fi: "Yksi liiga", en: "Single league", es: "Una liga" })} value={`≤ ${daily?.hardLimits?.maxLeagueExposurePercent || 2.5}%`} />
            <Metric label={tr({ fi: "Uniikit tapahtumat", en: "Unique events", es: "Eventos únicos" })} value={String(daily?.uniqueEvents || 0)} />
          </View>
        </Card>

        <View style={local.grid}>
          <Metric label={tr({ fi: "Ratkaistu otos", en: "Settled sample", es: "Muestra" })} value={String(history?.settledCount || 0)} />
          <Metric label="ROI" value={pct(history?.roi)} />
          <Metric label="Average CLV" value={pct(history?.clv?.average)} />
          <Metric label={tr({ fi: "Drawdown", en: "Drawdown", es: "Drawdown" })} value={`${money(history?.maxDrawdown)} · ${pct(history?.maxDrawdownRate)}`} />
          <Metric label={tr({ fi: "Tappioputki", en: "Losing streak", es: "Racha" })} value={String(history?.currentLosingStreak || 0)} />
          <Metric label={tr({ fi: "Varmennettu data", en: "Verified data", es: "Datos verificados" })} value={pct(readiness?.averageVerifiedCoverage)} />
          <Metric label="Multi-provider" value={pct(readiness?.multiProviderRate)} />
          <Metric label={tr({ fi: "Avoin altistus", en: "Open exposure", es: "Exposición" })} value={`${autonomy.exposure.openCount} · ${money(autonomy.exposure.openStake)}`} />
        </View>

        <Card>
          <Text style={styles.kicker}>{tr({ fi: "PÄIVITTÄINEN BRIEF", en: "DAILY BRIEF", es: "RESUMEN DIARIO" })}</Text>
          <Text style={styles.cardTitle}>{payload?.brief?.headline || autonomy.reason}</Text>
          <View style={local.rowGap}><StatusPill label={payload?.brief?.canCreateNewPaperExposure ? "EXPOSURE ALLOWED" : "EXPOSURE BLOCKED"} good={Boolean(payload?.brief?.canCreateNewPaperExposure)} /><StatusPill label={`${autonomy.stakeMultiplier.toFixed(2)}× STAKE`} good={autonomy.stakeMultiplier > 0} /><StatusPill label={`${autonomy.pickCap} MODE PICKS`} good={autonomy.pickCap > 0} /><StatusPill label={`${daily?.picksRemaining || 0} DAILY LEFT`} good={Number(daily?.picksRemaining || 0) > 0} /></View>
          {(payload?.brief?.recommendations || []).map((item) => <Text key={item} style={styles.muted}>• {item}</Text>)}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>{tr({ fi: "Circuit breakerit", en: "Circuit breakers", es: "Límites de seguridad" })}</Text>
          {autonomy.blockers.length === 0 ? <Text style={local.goodText}>{tr({ fi: "Ei aktiivisia kovia estäjiä.", en: "No active hard blockers.", es: "No hay bloqueos críticos." })}</Text> : autonomy.blockers.map((item) => <View key={item} style={local.blocker}><Text style={local.blockerKicker}>BLOCKER</Text><Text style={local.blockerText}>{item}</Text></View>)}
          {autonomy.warnings.map((item) => <View key={item} style={local.warning}><Text style={local.warningKicker}>WARNING</Text><Text style={local.warningText}>{item}</Text></View>)}
        </Card>

        <Card>
          <Text style={styles.kicker}>CHAMPION / CHALLENGER</Text>
          <Text style={styles.cardTitle}>{tr({ fi: "Mallilabra", en: "Model lab", es: "Laboratorio del modelo" })}</Text>
          <View style={local.grid}>
            <Metric label={tr({ fi: "Tila", en: "Status", es: "Estado" })} value={payload?.modelLab?.status || "–"} />
            <Metric label={tr({ fi: "Otos", en: "Sample", es: "Muestra" })} value={`${payload?.modelLab?.sampleSize || 0}/${payload?.modelLab?.minimumSamples || 120}`} />
            <Metric label="Challenger" value={payload?.modelLab?.challenger?.id || "–"} />
            <Metric label="Drift" value={payload?.modelLab?.drift?.status || "–"} />
          </View>
          <Text style={styles.muted}>{tr({ fi: "Varjomalli ei muuta tuotannon todennäköisyyttä tai päätöksiä automaattisesti.", en: "The shadow model never changes production probability or decisions automatically.", es: "El modelo sombra no cambia automáticamente la probabilidad." })}</Text>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>{tr({ fi: "Nykyiset ehdokkaat", en: "Current candidates", es: "Candidatos actuales" })}</Text>
          {(payload?.currentCandidates || []).slice(0, 12).map((item) => <View key={`${item.eventId}:${item.selection}`} style={local.item}>
            <View style={styles.rowBetween}><View style={local.itemTitle}><Text style={styles.value}>{item.match}</Text><Text style={styles.muted}>{item.selection} · {Number(item.odds || 0).toFixed(2)}</Text></View><Text style={local.decision}>{item.decision}</Text></View>
            <Text style={styles.muted}>Edge {pct(item.edge)} · verified {pct(item.verifiedCoverage)} · {item.oddsProviders || 1} providers</Text>
            <Text style={styles.muted}>Safety {item.safetyAction || "–"}</Text>
          </View>)}
          {(payload?.currentCandidates || []).length === 0 ? <Text style={styles.muted}>{tr({ fi: "Nykyisiä varmennettuja ehdokkaita ei ole.", en: "No current verified candidates.", es: "No hay candidatos verificados." })}</Text> : null}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>{tr({ fi: "Viimeiset worker-ajot", en: "Recent worker cycles", es: "Ciclos recientes" })}</Text>
          {(payload?.runs || []).slice(0, 10).map((run) => <View key={run.id} style={local.item}><View style={styles.rowBetween}><View><Text style={styles.value}>{new Date(run.started_at).toLocaleString()}</Text><Text style={styles.muted}>{run.candidate_count} candidates · {run.saved_count} saved · {money(run.total_stake)}</Text></View><Text style={run.status === "success" ? local.runGood : run.status === "deferred" ? local.runDeferred : local.runBad}>{run.status.toUpperCase()}</Text></View>{run.error ? <Text style={local.errorText}>{run.error}</Text> : null}</View>)}
        </Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Turvasopimus", en: "Safety contract", es: "Contrato de seguridad" })}</Text><Text style={styles.muted}>{tr({ fi: "Vain paperitila. Pysyvä UTC-päiväkiintiö, kovat 1 % / 5 % / 2,5 % katot, ei vedonvälittäjätiliä, talletuksia, oikean rahan vetoja tai automaattista mallipromootiota.", en: "Paper mode only. Persistent UTC daily quota, hard 1% / 5% / 2.5% caps, no bookmaker account, deposits, real-money bets or automatic model promotion.", es: "Solo modo simulado, cuota UTC persistente, límites duros y sin dinero real ni promoción automática." })}</Text></Card>
      </> : null}
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={local.metric}><Text style={local.metricLabel}>{label}</Text><Text style={local.metricValue}>{value}</Text></View>;
}

function StatusPill({ label, good }: { label: string; good: boolean }) {
  return <View style={[local.pill, good ? local.pillGood : local.pillBad]}><Text style={[local.pillText, good ? local.pillGoodText : local.pillBadText]}>{label}</Text></View>;
}

const local = StyleSheet.create({
  titleWrap: { flex: 1 },
  modeCard: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 7 },
  active: { borderColor: "#166534", backgroundColor: "#052e16" },
  guarded: { borderColor: "#1d4ed8", backgroundColor: "#172554" },
  bootstrap: { borderColor: "#7e22ce", backgroundColor: "#3b0764" },
  degraded: { borderColor: "#a16207", backgroundColor: "#422006" },
  frozen: { borderColor: "#b91c1c", backgroundColor: "#450a0a" },
  modeKicker: { color: "#cbd5e1", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  modeTitle: { color: "#f8fafc", fontSize: 30, fontWeight: "900" },
  modeText: { color: "#e2e8f0", fontSize: 14, lineHeight: 21 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48%", minHeight: 84, borderWidth: 1, borderColor: "#263449", backgroundColor: "#101b2d", borderRadius: 17, padding: 14, justifyContent: "space-between" },
  metricLabel: { color: "#8290a8", fontSize: 11, fontWeight: "800" },
  metricValue: { color: "#f8fafc", fontSize: 19, fontWeight: "900" },
  rowGap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillGood: { backgroundColor: "#14532d" },
  pillBad: { backgroundColor: "#7f1d1d" },
  pillText: { fontSize: 9, fontWeight: "900" },
  pillGoodText: { color: "#bbf7d0" },
  pillBadText: { color: "#fecaca" },
  goodText: { color: "#bbf7d0", fontWeight: "800" },
  blocker: { borderWidth: 1, borderColor: "#7f1d1d", backgroundColor: "#450a0a", borderRadius: 14, padding: 12, gap: 4 },
  blockerKicker: { color: "#fca5a5", fontSize: 9, fontWeight: "900" },
  blockerText: { color: "#fee2e2", fontWeight: "800" },
  warning: { borderWidth: 1, borderColor: "#92400e", backgroundColor: "#451a03", borderRadius: 14, padding: 12, gap: 4 },
  warningKicker: { color: "#fcd34d", fontSize: 9, fontWeight: "900" },
  warningText: { color: "#fef3c7", fontWeight: "800" },
  item: { borderTopWidth: 1, borderTopColor: "#263449", paddingTop: 12, gap: 5 },
  itemTitle: { flex: 1 },
  decision: { color: "#bef264", fontSize: 10, fontWeight: "900" },
  runGood: { color: "#86efac", fontSize: 10, fontWeight: "900" },
  runDeferred: { color: "#fde68a", fontSize: 10, fontWeight: "900" },
  runBad: { color: "#fca5a5", fontSize: 10, fontWeight: "900" },
  errorText: { color: "#fca5a5", fontSize: 12 }
});
