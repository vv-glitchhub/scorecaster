import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import { ActionButton, Card, styles } from "../ui";

type RiskProfile = "conservative" | "balanced" | "aggressive";
type RiskPolicy = { minConfidence?: number; minEdge?: number; minEv?: number; kellyFraction?: number };
type RiskPayload = { riskProfile: RiskProfile; riskPolicy?: RiskPolicy; paperOnly: boolean; realMoneyBetting: boolean };

type Settings = {
  enabled: boolean;
  sports: string[];
  daily_pick_limit: number;
  min_priority_score: number;
  min_odds: number;
  max_odds: number;
  risk_profile?: RiskProfile;
  min_data_coverage: number;
  min_provider_count: number;
  max_provider_disagreement: number;
  max_drawdown_percent: number;
  max_daily_loss_percent: number;
  pause_after_losses: number;
  cooldown_hours: number;
  max_open_picks: number;
  minimum_minutes_before_start: number;
  maximum_hours_before_start: number;
  auto_pause_on_incident: boolean;
  require_unified_data: boolean;
  adaptive_cadence: boolean;
  shadow_learning_enabled: boolean;
};

type AgentState = {
  last_status?: string;
  health_status?: string;
  health_score?: number;
  next_check_at?: string;
  paused_until?: string | null;
  pause_reason?: string | null;
  last_saved_count?: number;
  last_total_stake?: number;
  resolved_sample?: number;
  consecutive_losses?: number;
  drawdown_percent?: number;
  roi?: number | null;
  average_clv?: number | null;
  last_brief?: Brief | null;
};

type Brief = {
  headline?: string;
  cycle?: { candidates?: number; saved?: number; blocked?: number; totalVirtualStake?: number };
  health?: { overall?: string; system?: string; performance?: string; performanceScore?: number };
  learning?: { resolvedSample?: number; averageClv?: number | null; roi?: number | null; mode?: string };
  commonBlockReasons?: Array<{ reason: string; count: number }>;
};

type AuditRow = {
  id: string;
  match: string;
  selection: string;
  league: string;
  allowed: boolean;
  reasons: string[];
  warnings: string[];
  quality_score: number | null;
  data_coverage: number | null;
  provider_count: number | null;
  provider_disagreement: number | null;
  odds: number | null;
  risk_profile?: RiskProfile;
  risk_policy?: RiskPolicy;
  created_at: string;
};

type RunRow = {
  id: string;
  status: string;
  health_status?: string;
  health_score?: number;
  candidate_count: number;
  saved_count: number;
  total_stake: number;
  next_check_minutes?: number;
  completed_at?: string;
  started_at?: string;
};

type Payload = {
  available: boolean;
  warning?: string;
  agentActive: boolean;
  settings: Settings;
  state: AgentState | null;
  readiness: { ready: boolean; blockers: string[]; healthStatus: string; healthScore: number };
  audit: AuditRow[];
  runs: RunRow[];
  briefs: Array<{ brief: Brief }>;
};

const SAFE_PRESET = {
  min_data_coverage: 0.7,
  min_provider_count: 2,
  max_provider_disagreement: 0.08,
  max_drawdown_percent: 8,
  max_daily_loss_percent: 3,
  pause_after_losses: 4,
  cooldown_hours: 18,
  max_open_picks: 8,
  minimum_minutes_before_start: 30,
  maximum_hours_before_start: 48
};

const STANDARD_PRESET = {
  min_data_coverage: 0.6,
  min_provider_count: 1,
  max_provider_disagreement: 0.12,
  max_drawdown_percent: 12,
  max_daily_loss_percent: 4,
  pause_after_losses: 5,
  cooldown_hours: 12,
  max_open_picks: 12,
  minimum_minutes_before_start: 20,
  maximum_hours_before_start: 72
};

const STRICT_PRESET = {
  min_data_coverage: 0.8,
  min_provider_count: 2,
  max_provider_disagreement: 0.06,
  max_drawdown_percent: 6,
  max_daily_loss_percent: 2,
  pause_after_losses: 3,
  cooldown_hours: 24,
  max_open_picks: 6,
  minimum_minutes_before_start: 45,
  maximum_hours_before_start: 36
};

function pct(value: number | null | undefined, digits = 1) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";
}

function date(value?: string | null) {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString();
}

export default function AutonomousAgentScreen() {
  const { tr } = useLanguage();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [settingsState, setSettingsState] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("balanced");
  const [riskPolicy, setRiskPolicy] = useState<RiskPolicy | null>(null);
  const [riskSaving, setRiskSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [next, risk] = await Promise.all([
        apiRequest<Payload>("/api/cloud/autonomous-agent"),
        apiRequest<RiskPayload>("/api/cloud/autonomous-agent/risk-profile")
      ]);
      setPayload(next);
      setSettingsState(next.settings);
      setRiskProfile(risk.riskProfile || next.settings.risk_profile || "balanced");
      setRiskPolicy(risk.riskPolicy || null);
    } catch (error) {
      Alert.alert(tr({ fi: "Autonomous Agentia ei voitu ladata", en: "Autonomous Agent could not be loaded", es: "No se pudo cargar Autonomous Agent" }), error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save(nextSettings = settingsState) {
    if (!nextSettings) return;
    setSaving(true);
    try {
      await apiRequest("/api/cloud/autonomous-agent", {
        method: "PUT",
        body: {
          enabled: nextSettings.enabled,
          sports: nextSettings.sports,
          dailyPickLimit: nextSettings.daily_pick_limit,
          minPriorityScore: nextSettings.min_priority_score,
          minOdds: nextSettings.min_odds,
          maxOdds: nextSettings.max_odds,
          minDataCoverage: nextSettings.min_data_coverage,
          minProviderCount: nextSettings.min_provider_count,
          maxProviderDisagreement: nextSettings.max_provider_disagreement,
          maxDrawdownPercent: nextSettings.max_drawdown_percent,
          maxDailyLossPercent: nextSettings.max_daily_loss_percent,
          pauseAfterLosses: nextSettings.pause_after_losses,
          cooldownHours: nextSettings.cooldown_hours,
          maxOpenPicks: nextSettings.max_open_picks,
          minimumMinutesBeforeStart: nextSettings.minimum_minutes_before_start,
          maximumHoursBeforeStart: nextSettings.maximum_hours_before_start,
          autoPauseOnIncident: nextSettings.auto_pause_on_incident,
          requireUnifiedData: nextSettings.require_unified_data,
          adaptiveCadence: nextSettings.adaptive_cadence,
          shadowLearningEnabled: nextSettings.shadow_learning_enabled
        }
      });
      await load();
    } catch (error) {
      Alert.alert(tr({ fi: "Asetuksia ei voitu tallentaa", en: "Settings could not be saved", es: "No se pudo guardar" }), error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function saveRiskProfile(nextProfile: RiskProfile) {
    if (riskSaving || nextProfile === riskProfile) return;
    setRiskSaving(true);
    try {
      const next = await apiRequest<RiskPayload>("/api/cloud/autonomous-agent/risk-profile", {
        method: "PUT",
        body: { riskProfile: nextProfile }
      });
      setRiskProfile(next.riskProfile);
      setRiskPolicy(next.riskPolicy || null);
    } catch (error) {
      Alert.alert(tr({ fi: "Riskitasoa ei voitu tallentaa", en: "Risk level could not be saved", es: "No se pudo guardar el riesgo" }), error instanceof Error ? error.message : "Unknown error");
    } finally {
      setRiskSaving(false);
    }
  }

  async function requestRun() {
    setRequesting(true);
    try {
      await apiRequest("/api/cloud/autonomous-agent", { method: "POST" });
      Alert.alert(tr({ fi: "Paperiajo jonotettiin", en: "Paper run queued", es: "Ejecución en cola" }), tr({ fi: "Seuraava suojattu worker-sykli käsittelee pyynnön.", en: "The next protected worker cycle will process it.", es: "El próximo ciclo protegido la procesará." }));
      await load();
    } catch (error) {
      Alert.alert(tr({ fi: "Ajoa ei voitu jonottaa", en: "Run could not be queued", es: "No se pudo encolar" }), error instanceof Error ? error.message : "Unknown error");
    } finally {
      setRequesting(false);
    }
  }

  async function emergencyStop() {
    if (!settingsState) return;
    const stopped = { ...settingsState, enabled: false };
    setSettingsState(stopped);
    await save(stopped);
  }

  function applyPreset(preset: Partial<Settings>) {
    setSettingsState((current) => current ? { ...current, ...preset } : current);
  }

  const state = payload?.state;
  const readiness = payload?.readiness;
  const brief = payload?.briefs?.[0]?.brief || state?.last_brief || null;
  const audit = payload?.audit || [];
  const allowed = useMemo(() => audit.filter((item) => item.allowed).length, [audit]);
  const riskLabels: Record<RiskProfile, string> = {
    conservative: tr({ fi: "Varovainen", en: "Conservative", es: "Conservador" }),
    balanced: tr({ fi: "Tasapainoinen", en: "Balanced", es: "Equilibrado" }),
    aggressive: tr({ fi: "Rohkea", en: "Aggressive", es: "Agresivo" })
  };

  if (loading && !payload) return <View style={local.loading}><ActivityIndicator color="#c4b5fd" size="large" /></View>;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.mobileHero}>
        <Text style={styles.kicker}>AUTONOMOUS PAPER AGENT V2</Text>
        <Text style={styles.title}>{tr({ fi: "Autonominen, mutta aina valvottu", en: "Autonomous, always governed", es: "Autónomo, siempre controlado" })}</Text>
        <Text style={styles.subtitle}>{tr({ fi: "Unified Data, providerit, drawdown, CLV, tappioputki ja incidentit tarkistetaan ennen jokaista paperivalintaa.", en: "Unified Data, providers, drawdown, CLV, loss streak and incidents are checked before every paper selection.", es: "Datos, proveedores, drawdown, CLV e incidencias se verifican antes de cada selección." })}</Text>
      </View>

      {!payload?.available ? <Card><Text style={styles.cardTitle}>{tr({ fi: "V2 ei ole vielä aktivoitu", en: "V2 is not activated yet", es: "V2 aún no está activado" })}</Text><Text style={styles.muted}>{payload?.warning || "Migration required"}</Text></Card> : null}

      <View style={local.grid}>
        <Metric label="Readiness" value={readiness?.ready ? "READY" : "BLOCKED"} />
        <Metric label={tr({ fi: "Terveys", en: "Health", es: "Salud" })} value={`${Number(state?.health_score ?? 0).toFixed(0)}/100`} />
        <Metric label="ROI" value={pct(state?.roi)} />
        <Metric label="CLV" value={pct(state?.average_clv)} />
        <Metric label="Drawdown" value={`${Number(state?.drawdown_percent || 0).toFixed(1)} %`} />
        <Metric label={tr({ fi: "Tappioputki", en: "Loss streak", es: "Racha" })} value={String(state?.consecutive_losses || 0)} />
      </View>

      <Card>
        <View style={styles.rowBetween}>
          <View style={local.flex}><Text style={styles.cardTitle}>{tr({ fi: "Autonominen opt-in", en: "Autonomous opt-in", es: "Activación autónoma" })}</Text><Text style={styles.muted}>{tr({ fi: "Tämä sallii vain paperivalinnat. Turvaportti voi silti pysäyttää agentin.", en: "This permits paper selections only. The safety gate can still pause the Agent.", es: "Solo permite selecciones simuladas." })}</Text></View>
          <Switch value={Boolean(settingsState?.enabled)} onValueChange={(value) => setSettingsState((current) => current ? { ...current, enabled: value } : current)} trackColor={{ false: "#334155", true: "#7c3aed" }} />
        </View>
        <View style={local.actions}><ActionButton label={saving ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Tallenna", en: "Save", es: "Guardar" })} onPress={() => save()} disabled={saving || !settingsState} /><ActionButton label={requesting ? tr({ fi: "Jonotetaan…", en: "Queuing…", es: "Encolando…" }) : tr({ fi: "Pyydä ajo", en: "Queue run", es: "Solicitar" })} onPress={requestRun} tone="secondary" disabled={requesting || !settingsState?.enabled || !readiness?.ready} /><ActionButton label={tr({ fi: "Hätäpysäytys", en: "Emergency stop", es: "Parada" })} onPress={emergencyStop} tone="secondary" disabled={!settingsState?.enabled || saving} /></View>
      </Card>

      <Card>
        <Text style={styles.kicker}>AUTONOMOUS RISK CONTROL V1</Text>
        <Text style={styles.cardTitle}>{tr({ fi: "Kuinka rohkeasti autonomia saa suositella?", en: "How aggressively may autonomy recommend?", es: "¿Con cuánto riesgo puede recomendar la autonomía?" })}</Text>
        <Text style={styles.muted}>{tr({ fi: "Riskitaso muuttaa vain recommendation-portteja ja virtuaalista panostusta. Probability, edge ja EV eivät muutu, ja omat min edge / min confidence -rajasi pysyvät lisäturvana.", en: "Risk changes recommendation gates and virtual sizing only. Probability, edge and EV stay unchanged, and your min edge / min confidence remain extra safety floors.", es: "El riesgo solo cambia los filtros y el importe virtual. Probabilidad, edge y EV no cambian y tus mínimos siguen activos." })}</Text>
        <View style={local.actions}>
          {(["conservative", "balanced", "aggressive"] as RiskProfile[]).map((item) => <RiskChoice key={item} label={riskLabels[item]} active={riskProfile === item} disabled={riskSaving} onPress={() => void saveRiskProfile(item)} />)}
        </View>
        <View style={local.settingsList}>
          <Row label={tr({ fi: "Valittu", en: "Selected", es: "Seleccionado" })} value={riskLabels[riskProfile]} />
          <Row label="Min confidence" value={pct(riskPolicy?.minConfidence, 0)} />
          <Row label="Min edge" value={pct(riskPolicy?.minEdge, 1)} />
          <Row label="Min EV" value={pct(riskPolicy?.minEv, 1)} />
          <Row label="Kelly" value={pct(riskPolicy?.kellyFraction, 1)} />
        </View>
        <Text style={[styles.muted, local.riskNote]}>{tr({ fi: "Hard capit pysyvät aina enintään 1 % / 5 % / 2,5 %. Ei oikean rahan vetoja.", en: "Hard caps always remain at most 1% / 5% / 2.5%. No real-money bets.", es: "Los límites siguen en 1% / 5% / 2,5%. Sin apuestas con dinero real." })}</Text>
      </Card>

      {readiness?.blockers?.length ? <Card><Text style={styles.cardTitle}>{tr({ fi: "Aktiiviset estot", en: "Active blockers", es: "Bloqueos activos" })}</Text>{readiness.blockers.map((item) => <Text key={item} style={local.blocker}>• {item}</Text>)}{state?.pause_reason ? <Text style={styles.muted}>{state.pause_reason}</Text> : null}{state?.paused_until ? <Text style={styles.muted}>{tr({ fi: "Tauko päättyy", en: "Cooldown ends", es: "Pausa hasta" })}: {date(state.paused_until)}</Text> : null}</Card> : null}

      <Card>
        <Text style={styles.kicker}>SAFETY PRESETS</Text>
        <Text style={styles.cardTitle}>{tr({ fi: "Valitse valvonnan tiukkuus", en: "Choose governance strictness", es: "Elige la intensidad" })}</Text>
        <View style={local.actions}><Preset label={tr({ fi: "Turvallinen", en: "Safe", es: "Seguro" })} onPress={() => applyPreset(SAFE_PRESET)} /><Preset label={tr({ fi: "Vakio", en: "Standard", es: "Estándar" })} onPress={() => applyPreset(STANDARD_PRESET)} /><Preset label={tr({ fi: "Erittäin tiukka", en: "Very strict", es: "Muy estricto" })} onPress={() => applyPreset(STRICT_PRESET)} /></View>
        {settingsState ? <View style={local.settingsList}><Row label={tr({ fi: "Datakattavuus", en: "Data coverage", es: "Cobertura" })} value={pct(settingsState.min_data_coverage, 0)} /><Row label={tr({ fi: "Odds-providerit", en: "Odds providers", es: "Proveedores" })} value={String(settingsState.min_provider_count)} /><Row label={tr({ fi: "Provider-eron raja", en: "Provider gap limit", es: "Límite de diferencia" })} value={pct(settingsState.max_provider_disagreement, 0)} /><Row label="Max drawdown" value={`${settingsState.max_drawdown_percent} %`} /><Row label={tr({ fi: "Päivätappio", en: "Daily loss", es: "Pérdida diaria" })} value={`${settingsState.max_daily_loss_percent} %`} /><Row label={tr({ fi: "Cooldown", en: "Cooldown", es: "Pausa" })} value={`${settingsState.cooldown_hours} h`} /></View> : null}
      </Card>

      {brief ? <Card><Text style={styles.kicker}>DAILY AUTONOMOUS BRIEF</Text><Text style={styles.cardTitle}>{brief.headline || "–"}</Text><View style={local.grid}><Metric label={tr({ fi: "Ehdokkaat", en: "Candidates", es: "Candidatos" })} value={String(brief.cycle?.candidates || 0)} /><Metric label={tr({ fi: "Tallennettu", en: "Saved", es: "Guardados" })} value={String(brief.cycle?.saved || 0)} /><Metric label="Sample" value={String(brief.learning?.resolvedSample || 0)} /><Metric label="CLV" value={pct(brief.learning?.averageClv)} /></View>{(brief.commonBlockReasons || []).map((item) => <Row key={item.reason} label={item.reason} value={String(item.count)} />)}</Card> : null}

      <Card>
        <View style={styles.rowBetween}><View><Text style={styles.kicker}>DECISION AUDIT</Text><Text style={styles.cardTitle}>{tr({ fi: "Hyväksytyt ja estetyt", en: "Allowed and blocked", es: "Permitidos y bloqueados" })}</Text></View><Text style={local.auditCount}>{allowed}/{audit.length}</Text></View>
        {audit.length === 0 ? <Text style={styles.muted}>{tr({ fi: "Ensimmäinen V2-sykli luo audit-historian.", en: "The first V2 cycle creates audit history.", es: "El primer ciclo V2 crea el historial." })}</Text> : audit.slice(0, 15).map((item) => <View key={item.id} style={local.audit}><View style={styles.rowBetween}><View style={local.flex}><Text style={styles.value}>{item.match}</Text><Text style={styles.muted}>{item.selection} · {item.league} · {Number(item.odds || 0).toFixed(2)}</Text></View><Text style={[local.status, item.allowed ? local.allowed : local.blocked]}>{item.allowed ? "ALLOWED" : "BLOCKED"}</Text></View><Text style={styles.muted}>Quality {Number(item.quality_score || 0).toFixed(0)} · coverage {pct(item.data_coverage, 0)} · providers {item.provider_count ?? "–"} · gap {pct(item.provider_disagreement, 1)}{item.risk_profile ? ` · ${riskLabels[item.risk_profile]}` : ""}</Text>{item.reasons.map((reason) => <Text key={reason} style={local.reason}>• {reason}</Text>)}</View>)}
      </Card>

      <Card><Text style={styles.cardTitle}>{tr({ fi: "Viimeisimmät syklit", en: "Recent cycles", es: "Ciclos recientes" })}</Text>{(payload?.runs || []).slice(0, 10).map((run) => <View key={run.id} style={local.audit}><View style={styles.rowBetween}><Text style={styles.value}>{String(run.status).toUpperCase()} · {String(run.health_status || "learning").toUpperCase()}</Text><Text style={styles.muted}>{date(run.completed_at || run.started_at)}</Text></View><Text style={styles.muted}>{run.candidate_count} candidates · {run.saved_count} saved · {Number(run.total_stake || 0).toFixed(2)} € · next {run.next_check_minutes || "–"} min</Text></View>)}</Card>

      <Card><Text style={styles.cardTitle}>{tr({ fi: "Paperitila on ehdoton", en: "Paper-only is absolute", es: "Solo modo simulado" })}</Text><Text style={styles.muted}>{tr({ fi: "Agentti ei käsittele talletuksia, vedonvälittäjätilejä tai oikean rahan vetoja. Oppiminen ei muuta tuotantotodennäköisyyttä automaattisesti.", en: "The Agent never handles deposits, bookmaker accounts or real-money bets. Learning never changes production probability automatically.", es: "El Agent no gestiona dinero real y el aprendizaje no cambia la probabilidad automáticamente." })}</Text></Card>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={local.metric}><Text style={local.metricLabel}>{label}</Text><Text style={local.metricValue}>{value}</Text></View>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <View style={local.row}><Text style={styles.muted}>{label}</Text><Text style={local.rowValue}>{value}</Text></View>;
}

function Preset({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [local.preset, pressed && styles.cardPressed]}><Text style={local.presetText}>{label}</Text></Pressable>;
}

function RiskChoice({ label, active, disabled, onPress }: { label: string; active: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: active, disabled }} onPress={onPress} style={({ pressed }) => [local.riskChoice, active && local.riskChoiceActive, disabled && local.riskChoiceDisabled, pressed && !disabled && styles.cardPressed]}><Text style={[local.riskChoiceText, active && local.riskChoiceTextActive]}>{label}</Text></Pressable>;
}

const local = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#07101f" },
  flex: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48%", minHeight: 82, borderWidth: 1, borderColor: "#263449", backgroundColor: "#101b2d", borderRadius: 17, padding: 14, justifyContent: "space-between" },
  metricLabel: { color: "#8290a8", fontSize: 11, fontWeight: "800" },
  metricValue: { color: "#f8fafc", fontSize: 20, fontWeight: "900" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  blocker: { color: "#fecaca", fontSize: 13, fontWeight: "700", marginTop: 6 },
  preset: { borderWidth: 1, borderColor: "#6d5fd2", backgroundColor: "#2e1f59", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  presetText: { color: "#ede9fe", fontWeight: "900", fontSize: 12 },
  riskChoice: { borderWidth: 1, borderColor: "#334155", backgroundColor: "#101b2d", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  riskChoiceActive: { borderColor: "#a78bfa", backgroundColor: "#2e1f59" },
  riskChoiceDisabled: { opacity: 0.55 },
  riskChoiceText: { color: "#cbd5e1", fontWeight: "900", fontSize: 12 },
  riskChoiceTextActive: { color: "#f5f3ff" },
  riskNote: { marginTop: 14 },
  settingsList: { marginTop: 14, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: 1, borderTopColor: "#263449", paddingTop: 10 },
  rowValue: { color: "#f8fafc", fontWeight: "900" },
  auditCount: { color: "#c4b5fd", fontWeight: "900", fontSize: 18 },
  audit: { borderTopWidth: 1, borderTopColor: "#263449", paddingTop: 12, marginTop: 12, gap: 6 },
  status: { fontSize: 9, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, overflow: "hidden" },
  allowed: { backgroundColor: "#14532d", color: "#bbf7d0" },
  blocked: { backgroundColor: "#7f1d1d", color: "#fecaca" },
  reason: { color: "#fca5a5", fontSize: 12 }
});
