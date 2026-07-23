import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import { ActionButton, Card, percent, styles } from "../ui";

type State = {
  operating_mode?: string;
  health_score?: number;
  kill_switch_active?: boolean;
  kill_switch_reason?: string | null;
  next_check_at?: string;
  next_interval_minutes?: number;
  champion_model_key?: string;
  challenger_model_key?: string;
  last_saved_count?: number;
  last_total_stake?: number;
};

type Learning = {
  id: string;
  operating_mode: string;
  health_score: number;
  sample_size: number;
  champion_model_key: string;
  challenger_model_key: string;
  promotion_action: string;
  performance?: { recent?: { roi?: number | null; averageClv?: number | null }; all?: { lossStreak?: number }; drawdownPercent?: number };
  provider_health?: { score?: number; status?: string };
  captured_at: string;
};

type Incident = { id: string; severity: string; incident_type: string; title: string; message: string; active: boolean };
type Run = { id: string; operating_mode?: string; health_score?: number; saved_count?: number; total_stake?: number; incident_count?: number; created_at: string };
type Payload = {
  available: boolean;
  v12Active?: boolean;
  agentActive?: boolean;
  warning?: string | null;
  state?: State | null;
  learning?: Learning[];
  incidents?: Incident[];
  runs?: Run[];
  settings?: { enabled?: boolean; autonomy_profile?: string };
};

function number(value: unknown, digits = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : "–";
}

export default function AutonomousIntelligenceScreen() {
  const { tr, locale } = useLanguage();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setPayload(await apiRequest<Payload>("/api/cloud/autonomous-agent"));
    } catch (error) {
      Alert.alert(tr({ fi: "Autonomous Intelligence ei latautunut", en: "Autonomous Intelligence did not load", es: "No se cargó Autonomous Intelligence" }), error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function queueRun() {
    setRequesting(true);
    try {
      await apiRequest("/api/cloud/autonomous-agent", { method: "POST" });
      Alert.alert(tr({ fi: "Paperiajo jonotettu", en: "Paper cycle queued", es: "Ciclo simulado en cola" }), tr({ fi: "Suojattu worker käsittelee ajon seuraavalla kierroksella.", en: "The protected worker will process it on the next cycle.", es: "El worker protegido lo procesará en el siguiente ciclo." }));
      await load();
    } catch (error) {
      Alert.alert(tr({ fi: "Ajoa ei voitu jonottaa", en: "Cycle could not be queued", es: "No se pudo iniciar el ciclo" }), error instanceof Error ? error.message : "Unknown error");
    } finally {
      setRequesting(false);
    }
  }

  useEffect(() => { void load(); }, []);
  const state = payload?.state || {};
  const latest = payload?.learning?.[0];
  const activeIncidents = useMemo(() => (payload?.incidents || []).filter((item) => item.active !== false), [payload]);
  const mode = state.operating_mode || (payload?.v12Active ? "learning" : "fallback-v1");
  const health = Number(state.health_score ?? latest?.health_score ?? 0);
  const date = (value?: string) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}><Text style={styles.kicker}>AUTONOMOUS INTELLIGENCE V12</Text><Text style={styles.title}>{tr({ fi: "Oppiva autonominen paperiagentti", en: "Learning autonomous paper agent", es: "Agente simulado autónomo" })}</Text><Text style={styles.subtitle}>{tr({ fi: "Health score, kill switch, provider-portit, champion–challenger ja adaptiivinen ajastus yhdessä natiivinäkymässä.", en: "Health score, kill switch, provider gates, champion–challenger and adaptive scheduling in one native view.", es: "Salud, parada automática, proveedores, modelos y programación adaptativa." })}</Text></View>
        <ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={load} tone="secondary" compact disabled={loading || requesting} />
      </View>
      {loading && !payload ? <ActivityIndicator color="#c4b5fd" size="large" /> : null}
      {payload?.warning ? <Card><Text style={styles.cardTitle}>{tr({ fi: "Aktivointi kesken", en: "Activation pending", es: "Activación pendiente" })}</Text><Text style={styles.muted}>{payload.warning}</Text></Card> : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Metric label={tr({ fi: "Tila", en: "Mode", es: "Modo" })} value={String(mode).toUpperCase()} />
        <Metric label="Health" value={`${number(health)}/100`} />
        <Metric label="Kill switch" value={state.kill_switch_active ? "ON" : "OFF"} />
        <Metric label={tr({ fi: "Incidentit", en: "Incidents", es: "Incidencias" })} value={String(activeIncidents.length)} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Autonominen ohjaus", en: "Autonomous control", es: "Control autónomo" })}</Text>
        <Text style={styles.value}>{payload?.settings?.autonomy_profile || "conservative"}</Text>
        <Text style={styles.muted}>{tr({ fi: "Seuraava ajo", en: "Next cycle", es: "Próximo ciclo" })}: {date(state.next_check_at)} · {state.next_interval_minutes || 180} min</Text>
        <Text style={styles.muted}>{tr({ fi: "Viimeksi tallennettu", en: "Last saved", es: "Últimos guardados" })}: {state.last_saved_count || 0} · {number(state.last_total_stake, 2)} €</Text>
        {state.kill_switch_reason ? <Text style={styles.dangerText}>{state.kill_switch_reason}</Text> : null}
        <ActionButton label={requesting ? tr({ fi: "Jonotetaan…", en: "Queuing…", es: "Encolando…" }) : tr({ fi: "Pyydä uusi paperiajo", en: "Queue paper cycle", es: "Iniciar ciclo simulado" })} onPress={queueRun} disabled={requesting || !payload?.available || !payload?.settings?.enabled} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Champion–challenger</Text>
        <Text style={styles.value}>Champion: {state.champion_model_key || latest?.champion_model_key || "identity"}</Text>
        <Text style={styles.muted}>Challenger: {state.challenger_model_key || latest?.challenger_model_key || "identity"}</Text>
        <Text style={styles.muted}>{latest?.promotion_action || "KEEP_CHALLENGER_SHADOW"} · {latest?.sample_size || 0}/300</Text>
        <Text style={styles.muted}>{tr({ fi: "Promootio vaikuttaa vain papeririskipolitiikkaan. Julkaistu markkinatodennäköisyys ei muutu.", en: "Promotion affects paper-risk policy only. The published market probability does not change.", es: "La promoción solo afecta al riesgo simulado." })}</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Oppimisen suorituskyky", en: "Learning performance", es: "Rendimiento del aprendizaje" })}</Text>
        <Text style={styles.muted}>Recent ROI {latest?.performance?.recent?.roi === null || latest?.performance?.recent?.roi === undefined ? "–" : percent(latest.performance.recent.roi)}</Text>
        <Text style={styles.muted}>Recent CLV {latest?.performance?.recent?.averageClv === null || latest?.performance?.recent?.averageClv === undefined ? "–" : percent(latest.performance.recent.averageClv)}</Text>
        <Text style={styles.muted}>Drawdown {latest?.performance?.drawdownPercent === null || latest?.performance?.drawdownPercent === undefined ? "–" : percent(latest.performance.drawdownPercent)} · loss streak {latest?.performance?.all?.lossStreak || 0}</Text>
        <Text style={styles.muted}>Provider {number(latest?.provider_health?.score)}/100 · {latest?.provider_health?.status || "unknown"}</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Aktiiviset turvaincidentit", en: "Active safety incidents", es: "Incidencias activas" })}</Text>
        {activeIncidents.length === 0 ? <Text style={styles.muted}>{tr({ fi: "Ei aktiivisia incidenttejä.", en: "No active incidents.", es: "No hay incidencias activas." })}</Text> : activeIncidents.slice(0, 10).map((incident) => <View key={incident.id} style={{ borderTopWidth: 1, borderTopColor: "#263449", paddingTop: 10, gap: 4 }}><Text style={styles.value}>{incident.severity.toUpperCase()} · {incident.title}</Text><Text style={styles.muted}>{incident.message}</Text></View>)}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Viimeisimmät ajot", en: "Latest cycles", es: "Últimos ciclos" })}</Text>
        {(payload?.runs || []).slice(0, 10).map((run) => <View key={run.id} style={{ borderTopWidth: 1, borderTopColor: "#263449", paddingTop: 10, gap: 3 }}><Text style={styles.value}>{String(run.operating_mode || "unknown").toUpperCase()} · {number(run.health_score)}/100</Text><Text style={styles.muted}>{date(run.created_at)} · saved {run.saved_count || 0} · {number(run.total_stake, 2)} € · incidents {run.incident_count || 0}</Text></View>)}
      </Card>

      <Card><Text style={styles.cardTitle}>{tr({ fi: "Turvaraja", en: "Safety boundary", es: "Límite de seguridad" })}</Text><Text style={styles.muted}>{tr({ fi: "V12 tekee ja ratkaisee vain virtuaalisia paperivalintoja. Se ei kirjaudu vedonvälittäjälle, käsittele maksuja tai aseta oikean rahan vetoja.", en: "V12 creates and settles virtual paper selections only. It never logs into a bookmaker, handles payments or places real-money bets.", es: "V12 solo gestiona selecciones simuladas y nunca apuesta dinero real." })}</Text></Card>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={{ width: "48%", minHeight: 84, borderWidth: 1, borderColor: "#263449", backgroundColor: "#101b2d", borderRadius: 17, padding: 14, justifyContent: "space-between" }}><Text style={styles.muted}>{label}</Text><Text style={styles.metric}>{value}</Text></View>;
}
