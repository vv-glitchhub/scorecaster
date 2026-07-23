import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Switch, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import { ActionButton, Card, styles } from "../ui";

type Settings = {
  enabled: boolean;
  sports: string[];
  daily_pick_limit: number;
  min_priority_score: number;
  min_odds: number;
  max_odds: number;
};

type Controls = {
  kill_switch: boolean;
  autonomy_level: "observe" | "conservative" | "balanced";
  max_daily_loss_percent: number;
  max_drawdown_percent: number;
  max_loss_streak: number;
  allow_shadow_learning: boolean;
  allow_automatic_risk_tightening: boolean;
};

type V12State = {
  operating_state?: string;
  policy?: Record<string, unknown> & { riskScale?: number; maxPicks?: number; maxStakePercent?: number; minConfidence?: number };
  circuit_breakers?: { reasons?: string[]; warnings?: string[] };
  learning_report?: {
    status?: string;
    performance?: { sampleSize?: number; wins?: number; losses?: number; roi?: number | null; averageClv?: number | null; brier?: number | null; maxDrawdown?: number; currentLosingStreak?: number; clvSample?: number };
    calibration?: { expectedCalibrationError?: number | null };
    challenger?: { eligibleForShadowChampion?: boolean };
  };
  last_learning_at?: string | null;
};

type AuditRow = { id: string; action: string; selection?: string | null; reasons?: string[]; evidence?: { league?: string; odds?: number; edge?: number; confidence?: number }; created_at?: string };

type Payload = {
  ok: boolean;
  available: boolean;
  v12Available: boolean;
  v12Warning?: string | null;
  settings: Settings;
  controls: Controls;
  v12State?: V12State | null;
  audit?: AuditRow[];
  paperOnly: boolean;
};

const DEFAULT_CONTROLS: Controls = {
  kill_switch: false,
  autonomy_level: "balanced",
  max_daily_loss_percent: 4,
  max_drawdown_percent: 15,
  max_loss_streak: 10,
  allow_shadow_learning: true,
  allow_automatic_risk_tightening: true
};

function pct(value: unknown, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)} %` : "–";
}

function num(value: unknown, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "–";
}

export default function AutonomousV12Screen() {
  const { tr } = useLanguage();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [controls, setControls] = useState<Controls>(DEFAULT_CONTROLS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const next = await apiRequest<Payload>("/api/cloud/autonomous-agent", { timeoutMs: 30000 });
      setPayload(next);
      setControls({ ...DEFAULT_CONTROLS, ...(next.controls || {}) });
    } catch (error) {
      Alert.alert(tr({ fi: "Autonomous V12 ei latautunut", en: "Autonomous V12 could not load", es: "No se pudo cargar Autonomous V12" }), error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save(nextControls = controls) {
    if (!payload?.settings) return;
    setSaving(true);
    try {
      const settings = payload.settings;
      await apiRequest("/api/cloud/autonomous-agent", {
        method: "PUT",
        timeoutMs: 30000,
        body: {
          enabled: settings.enabled,
          sports: settings.sports || [],
          dailyPickLimit: settings.daily_pick_limit,
          minPriorityScore: settings.min_priority_score,
          minOdds: settings.min_odds,
          maxOdds: settings.max_odds,
          killSwitch: nextControls.kill_switch,
          autonomyLevel: nextControls.autonomy_level,
          maxDailyLossPercent: nextControls.max_daily_loss_percent,
          maxDrawdownPercent: nextControls.max_drawdown_percent,
          maxLossStreak: nextControls.max_loss_streak,
          allowShadowLearning: nextControls.allow_shadow_learning,
          allowAutomaticRiskTightening: nextControls.allow_automatic_risk_tightening
        }
      });
      Alert.alert(tr({ fi: "Tallennettu", en: "Saved", es: "Guardado" }), tr({ fi: "Autonomous V12 -ohjaus päivitettiin.", en: "Autonomous V12 controls were updated.", es: "Se actualizaron los controles V12." }));
      await load();
    } catch (error) {
      Alert.alert(tr({ fi: "Tallennus epäonnistui", en: "Save failed", es: "Error al guardar" }), error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function queueRun() {
    try {
      await apiRequest("/api/cloud/autonomous-agent", { method: "POST", timeoutMs: 30000 });
      Alert.alert(tr({ fi: "Ajo jonotettu", en: "Run queued", es: "Ejecución en cola" }), tr({ fi: "V12 käynnistyy seuraavalla suojatulla worker-kierroksella.", en: "V12 will run on the next protected worker cycle.", es: "V12 se ejecutará en el próximo ciclo protegido." }));
      await load();
    } catch (error) {
      Alert.alert(tr({ fi: "Ajoa ei voitu jonottaa", en: "Run could not be queued", es: "No se pudo encolar" }), error instanceof Error ? error.message : "Unknown error");
    }
  }

  const state = payload?.v12State;
  const learning = state?.learning_report;
  const performance = learning?.performance || {};
  const policy = state?.policy || {};
  const circuit = state?.circuit_breakers || {};
  const audit = payload?.audit || [];

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>AUTONOMOUS SCORECASTER V12</Text>
          <Text style={styles.title}>{tr({ fi: "Itsenäinen paperiagentti", en: "Autonomous paper agent", es: "Agente autónomo simulado" })}</Text>
          <Text style={styles.subtitle}>{tr({ fi: "Valinnat, virtuaalipanokset, tulokset, CLV, oppiminen ja automaattiset hätäjarrut. Ei oikean rahan vetoja.", en: "Selections, virtual stakes, results, CLV, learning and automatic circuit breakers. No real-money betting.", es: "Selecciones, apuestas virtuales, CLV, aprendizaje y frenos. Sin dinero real." })}</Text>
        </View>
        <ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={load} tone="secondary" compact disabled={loading || saving} />
      </View>

      {loading && !payload ? <ActivityIndicator color="#c4b5fd" size="large" /> : null}
      {!loading && !payload?.v12Available ? <Card><Text style={styles.cardTitle}>{tr({ fi: "V12 ei ole vielä aktivoitu", en: "V12 is not activated yet", es: "V12 aún no está activo" })}</Text><Text style={styles.muted}>{payload?.v12Warning || "supabase/scorecaster_autonomous_v12.sql"}</Text></Card> : null}

      <View style={local.grid}>
        <Metric label={tr({ fi: "Tila", en: "State", es: "Estado" })} value={state?.operating_state || "LEARNING"} />
        <Metric label={tr({ fi: "Ratkaistut", en: "Settled", es: "Resueltas" })} value={String(performance.sampleSize || 0)} />
        <Metric label="ROI" value={pct(performance.roi)} />
        <Metric label="CLV" value={pct(performance.averageClv)} />
        <Metric label="Brier" value={num(performance.brier, 4)} />
        <Metric label={tr({ fi: "Riskiskaala", en: "Risk scale", es: "Escala" })} value={num(policy.riskScale, 2)} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Hätäjarru", en: "Kill switch", es: "Freno de emergencia" })}</Text>
        <View style={styles.rowBetween}><Text style={styles.muted}>{controls.kill_switch ? tr({ fi: "Agentti on pysäytetty", en: "Agent is stopped", es: "Agente detenido" }) : tr({ fi: "Agentti saa toimia turvarajojen sisällä", en: "Agent may operate inside safety limits", es: "El agente puede operar dentro de límites" })}</Text><Switch value={controls.kill_switch} onValueChange={(value) => setControls((current) => ({ ...current, kill_switch: value }))} /></View>
        <ActionButton label={controls.kill_switch ? tr({ fi: "Tallenna pysäytys", en: "Save stop", es: "Guardar parada" }) : tr({ fi: "Tallenna tila", en: "Save state", es: "Guardar estado" })} onPress={() => save()} tone={controls.kill_switch ? "danger" : "primary"} disabled={saving || !payload?.v12Available} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Autonomian taso", en: "Autonomy level", es: "Nivel de autonomía" })}</Text>
        {(["observe", "conservative", "balanced"] as const).map((level) => <ActionButton key={level} label={`${controls.autonomy_level === level ? "✓ " : ""}${level.toUpperCase()}`} onPress={() => setControls((current) => ({ ...current, autonomy_level: level }))} tone={controls.autonomy_level === level ? "primary" : "secondary"} compact />)}
        <Text style={styles.muted}>{tr({ fi: "Observe ei tallenna valintoja. Conservative tekee enintään yhden pienen paperivalinnan. Balanced käyttää kaikkia turvaportteja ja käyttäjän rajoja.", en: "Observe saves no picks. Conservative makes at most one small paper pick. Balanced uses all gates and user limits.", es: "Observe no guarda selecciones. Conservative hace como máximo una selección pequeña." })}</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Oppiminen ja riskirajat", en: "Learning and risk limits", es: "Aprendizaje y riesgo" })}</Text>
        <Text style={styles.muted}>{tr({ fi: "Päivän tappioraja", en: "Daily loss stop", es: "Límite diario" })}: {controls.max_daily_loss_percent}%</Text>
        <Text style={styles.muted}>{tr({ fi: "Drawdown-raja", en: "Drawdown stop", es: "Límite drawdown" })}: {controls.max_drawdown_percent}%</Text>
        <Text style={styles.muted}>{tr({ fi: "Tappioputken pysäytys", en: "Loss-streak stop", es: "Racha máxima" })}: {controls.max_loss_streak}</Text>
        <View style={styles.rowBetween}><Text style={styles.muted}>{tr({ fi: "Shadow-oppiminen", en: "Shadow learning", es: "Aprendizaje shadow" })}</Text><Switch value={controls.allow_shadow_learning} onValueChange={(value) => setControls((current) => ({ ...current, allow_shadow_learning: value }))} /></View>
        <View style={styles.rowBetween}><Text style={styles.muted}>{tr({ fi: "Automaattinen riskin kiristys", en: "Automatic risk tightening", es: "Endurecimiento automático" })}</Text><Switch value={controls.allow_automatic_risk_tightening} onValueChange={(value) => setControls((current) => ({ ...current, allow_automatic_risk_tightening: value }))} /></View>
        <ActionButton label={tr({ fi: "Tallenna V12-ohjaus", en: "Save V12 controls", es: "Guardar controles V12" })} onPress={() => save()} disabled={saving || !payload?.v12Available} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Circuit Breakers</Text>
        {(circuit.reasons || []).length === 0 && (circuit.warnings || []).length === 0 ? <Text style={styles.muted}>{tr({ fi: "Yksikään hätäjarru ei ole aktiivinen.", en: "No circuit breaker is active.", es: "No hay frenos activos." })}</Text> : null}
        {(circuit.reasons || []).map((reason) => <Text key={reason} style={styles.dangerText}>STOP · {reason}</Text>)}
        {(circuit.warnings || []).map((reason) => <Text key={reason} style={styles.warningText}>WATCH · {reason}</Text>)}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Champion / Challenger</Text>
        <Text style={styles.value}>{learning?.status?.toUpperCase() || "LEARNING"}</Text>
        <Text style={styles.muted}>{tr({ fi: "CLV-otos", en: "CLV sample", es: "Muestra CLV" })} {performance.clvSample || 0} · {tr({ fi: "kalibrointivirhe", en: "calibration error", es: "error de calibración" })} {pct(learning?.calibration?.expectedCalibrationError)}</Text>
        <Text style={styles.muted}>{tr({ fi: "Shadow champion -kelpoinen", en: "Eligible for shadow champion", es: "Elegible para campeón shadow" })}: {learning?.challenger?.eligibleForShadowChampion ? "YES" : "NO"}</Text>
        <Text style={styles.muted}>{tr({ fi: "Tuotannon todennäköisyys ei muutu automaattisesti.", en: "Production probability never changes automatically.", es: "La probabilidad de producción nunca cambia automáticamente." })}</Text>
      </Card>

      <Card>
        <View style={styles.rowBetween}><Text style={styles.cardTitle}>{tr({ fi: "Päätösauditointi", en: "Decision audit", es: "Auditoría" })}</Text><ActionButton label={tr({ fi: "Jonota ajo", en: "Queue run", es: "Encolar" })} onPress={queueRun} tone="secondary" compact disabled={!payload?.settings?.enabled} /></View>
        {audit.length === 0 ? <Text style={styles.muted}>{tr({ fi: "Ensimmäinen V12-kierros täyttää auditin.", en: "The first V12 cycle will populate the audit.", es: "El primer ciclo llenará la auditoría." })}</Text> : audit.slice(0, 20).map((row) => <View key={row.id} style={local.audit}><View style={styles.rowBetween}><Text style={styles.value}>{row.action} · {row.selection || tr({ fi: "Järjestelmä", en: "System", es: "Sistema" })}</Text><Text style={styles.muted}>{row.evidence?.league || ""}</Text></View>{(row.reasons || []).map((reason) => <Text key={reason} style={styles.muted}>• {reason}</Text>)}</View>)}
      </Card>

      <Card><Text style={styles.cardTitle}>{tr({ fi: "Pysyvä tuoteraja", en: "Permanent product boundary", es: "Límite permanente" })}</Text><Text style={styles.muted}>{tr({ fi: "V12 käyttää vain virtuaalista pelikassaa. Se ei kirjaudu vedonvälittäjälle, käsittele talletuksia tai aseta oikean rahan vetoja.", en: "V12 uses only a virtual bankroll. It never logs into a bookmaker, handles deposits or places real-money bets.", es: "V12 usa solo banca virtual y nunca apuesta dinero real." })}</Text></Card>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={local.metric}><Text style={local.metricLabel}>{label}</Text><Text style={local.metricValue}>{value}</Text></View>;
}

const local = {
  grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10 },
  metric: { width: "48%" as const, minHeight: 82, borderWidth: 1, borderColor: "#263449", backgroundColor: "#101b2d", borderRadius: 17, padding: 14, justifyContent: "space-between" as const },
  metricLabel: { color: "#8290a8", fontSize: 11, fontWeight: "800" as const },
  metricValue: { color: "#f8fafc", fontSize: 20, fontWeight: "900" as const },
  audit: { borderTopWidth: 1, borderTopColor: "#263449", paddingTop: 12, gap: 4 }
};
