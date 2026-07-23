import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import { ActionButton, Card, styles } from "../ui";

type Audit = {
  id: string;
  event_id?: string | null;
  match?: string | null;
  selection?: string | null;
  allowed: boolean;
  reasons?: string[];
  data_coverage?: number | null;
  provider_count?: number | null;
  provider_disagreement?: number | null;
  odds?: number | null;
};

type V13Payload = {
  available: boolean;
  warning?: string;
  settings?: { enabled?: boolean };
  state?: {
    paused_until?: string | null;
    pause_reason?: string | null;
    health_status?: string | null;
    health_score?: number | null;
    resolved_sample?: number | null;
    consecutive_losses?: number | null;
    roi?: number | null;
    average_clv?: number | null;
    last_brief?: Record<string, unknown> | null;
  } | null;
  runs?: Array<{ next_check_minutes?: number | null }>;
  audits?: Audit[];
  briefs?: Array<{ brief?: any }>;
};

function pct(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)} %` : "–";
}

export default function MissionControlV13Panel() {
  const { tr } = useLanguage();
  const [payload, setPayload] = useState<V13Payload | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setPayload(await apiRequest<V13Payload>("/api/cloud/autonomous-agent"));
    } catch (error) {
      Alert.alert(tr({ fi: "V13-governancea ei voitu ladata", en: "V13 governance could not be loaded", es: "No se pudo cargar V13" }), error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function emergencyStop() {
    Alert.alert(
      tr({ fi: "Emergency stop", en: "Emergency stop", es: "Parada de emergencia" }),
      tr({ fi: "Tämä estää kaikki uudet autonomiset paperivalinnat. Olemassa olevat kohteet jäävät ratkaistaviksi.", en: "This blocks all new autonomous paper selections. Existing positions remain available for settlement.", es: "Esto bloquea nuevas selecciones simuladas. Las posiciones existentes permanecen." }),
      [
        { text: tr({ fi: "Peruuta", en: "Cancel", es: "Cancelar" }), style: "cancel" },
        {
          text: tr({ fi: "PYSÄYTÄ", en: "STOP", es: "DETENER" }),
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest("/api/cloud/autonomous-agent", { method: "DELETE" });
              await load();
            } catch (error) {
              Alert.alert("Emergency stop", error instanceof Error ? error.message : "Unknown error");
            }
          }
        }
      ]
    );
  }

  useEffect(() => { void load(); }, []);
  const audits = payload?.audits || [];
  const latestBrief = payload?.briefs?.[0]?.brief || payload?.state?.last_brief || null;
  const paused = Boolean(payload?.state?.paused_until && Date.parse(payload.state.paused_until) > Date.now());
  const auditSummary = useMemo(() => {
    const allowed = audits.filter((item) => item.allowed).length;
    const reasons = new Map<string, number>();
    audits.filter((item) => !item.allowed).forEach((item) => (item.reasons || []).forEach((reason) => reasons.set(reason, (reasons.get(reason) || 0) + 1)));
    return { allowed, blocked: audits.length - allowed, reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6) };
  }, [audits]);

  return (
    <Card>
      <View style={styles.rowBetween}>
        <View style={local.titleWrap}><Text style={styles.kicker}>AUTONOMOUS V13 GOVERNANCE</Text><Text style={styles.cardTitle}>{tr({ fi: "Cooldown, incidentit ja kandidaattiloki", en: "Cooldown, incidents and candidate audit", es: "Cooldown, incidentes y auditoría" })}</Text></View>
        <ActionButton label={loading ? "…" : tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={() => load()} tone="secondary" compact disabled={loading} />
      </View>

      {payload?.available === false ? <Text style={styles.muted}>{payload.warning || "V13 migration required"}</Text> : null}
      {payload?.available ? <>
        <View style={local.grid}>
          <Metric label={tr({ fi: "Agentti", en: "Agent", es: "Agente" })} value={payload.settings?.enabled ? "ENABLED" : "STOPPED"} />
          <Metric label="Health" value={`${payload.state?.health_status || "learning"} · ${Number(payload.state?.health_score || 0).toFixed(0)}/100`} />
          <Metric label={tr({ fi: "Tietokantapause", en: "Database pause", es: "Pausa" })} value={paused ? "ACTIVE" : "OFF"} />
          <Metric label={tr({ fi: "Seuraava ajoväli", en: "Next cadence", es: "Próxima cadencia" })} value={`${payload.runs?.[0]?.next_check_minutes || "–"} min`} />
          <Metric label={tr({ fi: "Ratkaistu otos", en: "Resolved sample", es: "Muestra" })} value={String(payload.state?.resolved_sample || 0)} />
          <Metric label={tr({ fi: "Tappioputki", en: "Loss streak", es: "Racha" })} value={String(payload.state?.consecutive_losses || 0)} />
          <Metric label="ROI" value={pct(payload.state?.roi)} />
          <Metric label="CLV" value={pct(payload.state?.average_clv)} />
        </View>

        {paused ? <View style={local.pause}><Text style={local.pauseKicker}>DATABASE-ENFORCED PAUSE</Text><Text style={local.pauseText}>{payload.state?.pause_reason || "Safety cooldown"}</Text><Text style={local.pauseMuted}>{payload.state?.paused_until ? new Date(payload.state.paused_until).toLocaleString() : ""}</Text></View> : null}

        <View style={local.brief}><Text style={styles.kicker}>DAILY BRIEF</Text><Text style={styles.value}>{latestBrief?.headline || tr({ fi: "Briefiä ei ole vielä", en: "No brief yet", es: "Aún no hay resumen" })}</Text><Text style={styles.muted}>{tr({ fi: "Hyväksytty", en: "Allowed", es: "Permitido" })} {auditSummary.allowed} · {tr({ fi: "estetty", en: "blocked", es: "bloqueado" })} {auditSummary.blocked}</Text>{auditSummary.reasons.map(([reason, count]) => <Text key={reason} style={styles.muted}>• {reason}: {count}</Text>)}</View>

        {audits.slice(0, 8).map((audit) => <View key={audit.id} style={[local.audit, audit.allowed ? local.allowed : local.blocked]}><View style={styles.rowBetween}><View style={local.titleWrap}><Text style={styles.value}>{audit.match || audit.event_id}</Text><Text style={styles.muted}>{audit.selection} · {Number(audit.odds || 0).toFixed(2)}</Text></View><Text style={audit.allowed ? local.allowedText : local.blockedText}>{audit.allowed ? "ALLOWED" : "BLOCKED"}</Text></View><Text style={styles.muted}>coverage {pct(audit.data_coverage)} · providers {audit.provider_count ?? "–"} · disagreement {pct(audit.provider_disagreement)}</Text>{(audit.reasons || []).length ? <Text style={styles.muted}>{audit.reasons?.join(" · ")}</Text> : null}</View>)}

        <ActionButton label={tr({ fi: "EMERGENCY STOP", en: "EMERGENCY STOP", es: "PARADA DE EMERGENCIA" })} onPress={() => emergencyStop()} tone="danger" disabled={payload.settings?.enabled === false} />
        <Text style={styles.muted}>{tr({ fi: "Pysäytys estää uudet paperivalinnat mutta säilyttää historian, auditit ja avoimien kohteiden ratkaisun.", en: "The stop blocks new paper selections while preserving history, audits and settlement of existing positions.", es: "La parada bloquea nuevas selecciones y conserva historial, auditoría y liquidación." })}</Text>
      </> : null}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={local.metric}><Text style={local.metricLabel}>{label}</Text><Text style={local.metricValue}>{value}</Text></View>;
}

const local = StyleSheet.create({
  titleWrap: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48%", minHeight: 76, borderWidth: 1, borderColor: "#263449", backgroundColor: "#101b2d", borderRadius: 16, padding: 12, justifyContent: "space-between" },
  metricLabel: { color: "#8290a8", fontSize: 10, fontWeight: "800" },
  metricValue: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  pause: { borderWidth: 1, borderColor: "#b91c1c", backgroundColor: "#450a0a", borderRadius: 15, padding: 13, gap: 5 },
  pauseKicker: { color: "#fca5a5", fontSize: 9, fontWeight: "900" },
  pauseText: { color: "#fee2e2", fontWeight: "900" },
  pauseMuted: { color: "#fecaca", fontSize: 12 },
  brief: { borderWidth: 1, borderColor: "#263449", backgroundColor: "#101b2d", borderRadius: 15, padding: 13, gap: 5 },
  audit: { borderWidth: 1, borderRadius: 15, padding: 13, gap: 5 },
  allowed: { borderColor: "#166534", backgroundColor: "#052e16" },
  blocked: { borderColor: "#7f1d1d", backgroundColor: "#450a0a" },
  allowedText: { color: "#86efac", fontSize: 9, fontWeight: "900" },
  blockedText: { color: "#fca5a5", fontSize: 9, fontWeight: "900" }
});
