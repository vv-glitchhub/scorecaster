import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import { ActionButton, Card, percent, styles } from "../ui";

type NextGate = {
  code?: string;
  status?: string;
  current?: unknown;
  target?: unknown;
  minimumEvOdds?: number;
};

type Recommendation = {
  rank?: number;
  eventId?: string;
  match?: string;
  selection?: string;
  league?: string;
  sportKey?: string;
  commenceTime?: string;
  decision?: "PLAY" | "CAUTION" | "SKIP" | string;
  score?: number;
  odds?: number;
  fairOdds?: number;
  minimumEvOdds?: number;
  edge?: number;
  ev?: number;
  confidence?: number;
  bookmakerCount?: number;
  readiness?: string;
  nextGate?: NextGate;
};

type Preferences = {
  enabled?: boolean;
  top_n?: number;
  alert_move_percent?: number;
  alert_before_minutes?: number;
  last_completed_at?: string | null;
  last_status?: string | null;
  last_error?: string | null;
};

type AutoWatchPayload = {
  ok: boolean;
  available?: boolean;
  autoManagedCount?: number | null;
  preferences?: Preferences;
  warning?: string | null;
  sync?: {
    inserted?: number;
    removed?: number;
    retainedAuto?: number;
    coveredByManual?: number;
    requested?: number;
  };
};

type RecommendationPayload = {
  ok: boolean;
  recommendations?: Recommendation[];
  hasPlayablePick?: boolean;
  generatedAt?: string;
};

function gateLabel(gate: NextGate | undefined, tr: ReturnType<typeof useLanguage>["tr"]) {
  const code = gate?.code || "safety-recheck";
  if (code === "maintain-play-gates") return tr({ fi: "Kaikki PLAY-portit auki", en: "All PLAY gates open", es: "Todos los filtros PLAY abiertos" });
  if (code === "verified-evidence") return tr({ fi: "Tarvitaan varmennettu evidenssi", en: "Verified evidence required", es: "Se requiere evidencia verificada" });
  if (code === "ev") return tr({ fi: "EV-portti puuttuu", en: "EV gate is missing", es: "Falta el filtro EV" });
  if (code === "edge") return tr({ fi: "Edge-portti puuttuu", en: "Edge gate is missing", es: "Falta el filtro edge" });
  if (code === "confidence") return tr({ fi: "Confidence liian matala", en: "Confidence is too low", es: "Confianza demasiado baja" });
  if (code === "bookmaker-coverage") return tr({ fi: "Markkinapeitto liian ohut", en: "Market coverage too thin", es: "Cobertura de mercado insuficiente" });
  if (code === "fresh-data") return tr({ fi: "Tarvitaan tuoreempi data", en: "Fresher data required", es: "Se necesitan datos más recientes" });
  return tr({ fi: "Safety-uudelleentarkistus", en: "Safety re-check", es: "Nueva comprobación de seguridad" });
}

function RecommendationCard({ item }: { item: Recommendation }) {
  const { tr } = useLanguage();
  const decision = item.decision || "CAUTION";
  return (
    <View style={local.card}>
      <View style={styles.rowBetween}>
        <Text style={local.rank}>#{item.rank || "–"} · {item.league || ""}</Text>
        <View style={[styles.badge, decision === "CAUTION" && styles.warningBadge]}><Text style={styles.badgeText}>{decision}</Text></View>
      </View>
      <Text style={styles.value}>{item.match || "–"}</Text>
      <Text style={styles.cardTitle}>{item.selection || "–"} · {Number(item.odds || 0).toFixed(2)}</Text>
      <View style={local.metrics}>
        <Text style={local.metric}>Score {Number(item.score || 0).toFixed(1)}</Text>
        <Text style={local.metric}>Edge {percent(item.edge)}</Text>
        <Text style={local.metric}>EV {percent(item.ev)}</Text>
      </View>
      <Text style={styles.muted}>{tr({ fi: "Evidenssi", en: "Evidence", es: "Evidencia" })}: {item.readiness || "market-only"} · {item.bookmakerCount || 0} bookmakers</Text>
      <Text style={local.gate}>{gateLabel(item.nextGate, tr)}</Text>
    </View>
  );
}

export default function AutoWatchScreen() {
  const { tr, locale } = useLanguage();
  const [preferences, setPreferences] = useState<Preferences>({ enabled: false, top_n: 3, alert_move_percent: 0.03, alert_before_minutes: 120 });
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [managedCount, setManagedCount] = useState(0);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const [autoWatch, feed] = await Promise.all([
        apiRequest<AutoWatchPayload>("/api/cloud/auto-watch-recommendations"),
        apiRequest<RecommendationPayload>("/api/recommendations?limit=3", { authenticated: false, timeoutMs: 30000 })
      ]);
      setAvailable(autoWatch.available !== false);
      setPreferences({ enabled: false, top_n: 3, alert_move_percent: 0.03, alert_before_minutes: 120, ...(autoWatch.preferences || {}) });
      setManagedCount(Number(autoWatch.autoManagedCount || 0));
      setRecommendations(feed.recommendations || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tr({ fi: "Auto-Watchin lataus epäonnistui", en: "Auto-Watch could not be loaded", es: "No se pudo cargar Auto-Watch" }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [tr]);

  async function save(nextEnabled = preferences.enabled === true, nextTopN = Number(preferences.top_n || 3)) {
    if (saving || !available) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = await apiRequest<AutoWatchPayload>("/api/cloud/auto-watch-recommendations", {
        method: "PATCH",
        body: {
          enabled: nextEnabled,
          topN: nextTopN,
          alertMovePercent: Number(preferences.alert_move_percent || 0.03),
          alertBeforeMinutes: Number(preferences.alert_before_minutes || 120)
        }
      });
      const sync = payload.sync || {};
      setPreferences({ ...preferences, ...(payload.preferences || {}), enabled: nextEnabled, top_n: nextTopN });
      setManagedCount(nextEnabled ? Number(sync.retainedAuto || 0) + Number(sync.inserted || 0) : 0);
      setMessage(payload.warning || (nextEnabled
        ? tr({ fi: `Top ${nextTopN} Auto-Watch synkattu.`, en: `Top ${nextTopN} Auto-Watch synchronized.`, es: `Auto-Watch Top ${nextTopN} sincronizado.` })
        : tr({ fi: "Auto-Watch poistettu käytöstä.", en: "Auto-Watch disabled.", es: "Auto-Watch desactivado." })));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tr({ fi: "Tallennus epäonnistui", en: "Save failed", es: "No se pudo guardar" }));
    } finally {
      setSaving(false);
    }
  }

  const lastRun = preferences.last_completed_at
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(preferences.last_completed_at))
    : "–";

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.mobileHero}>
        <Text style={styles.kicker}>AUTO-WATCH RECOMMENDATIONS V1</Text>
        <Text style={styles.title}>{tr({ fi: "Scorecaster valvoo Top 3:a puolestasi", en: "Scorecaster monitors the Top 3 for you", es: "Scorecaster supervisa el Top 3 por ti" })}</Text>
        <Text style={styles.subtitle}>{tr({ fi: "Automaattinen seuranta vaihtaa vain omia auto-managed-rivejään. Käsin lisättyihin seurantoihin ei kosketa, eikä mitään oikean rahan vetoa aseteta.", en: "Automatic monitoring rotates only its own auto-managed rows. Manual watch items are untouched and no real-money bet is ever placed.", es: "La supervisión automática solo rota sus propias filas. No toca seguimientos manuales ni realiza apuestas con dinero real." })}</Text>
      </View>

      {loading ? <ActivityIndicator color="#34d399" size="large" /> : (
        <>
          <Card>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{preferences.enabled ? tr({ fi: "Auto-Watch aktiivinen", en: "Auto-Watch active", es: "Auto-Watch activo" }) : tr({ fi: "Auto-Watch pois käytöstä", en: "Auto-Watch off", es: "Auto-Watch desactivado" })}</Text>
                <Text style={styles.muted}>{managedCount} auto-managed · {tr({ fi: "viimeisin ajo", en: "last run", es: "última ejecución" })} {lastRun} · {String(preferences.last_status || "idle").toUpperCase()}</Text>
              </View>
              <View style={[styles.badge, preferences.enabled && local.activeBadge]}><Text style={styles.badgeText}>{preferences.enabled ? "ON" : "OFF"}</Text></View>
            </View>
            <Text style={local.sectionLabel}>{tr({ fi: "Valvottavien määrä", en: "Number monitored", es: "Cantidad supervisada" })}</Text>
            <View style={local.actions}>
              {[1, 2, 3].map((value) => <ActionButton key={value} label={`Top ${value}`} onPress={() => void save(preferences.enabled === true, value)} tone={Number(preferences.top_n || 3) === value ? "primary" : "secondary"} compact disabled={saving} />)}
            </View>
            <View style={local.actions}>
              <ActionButton label={saving ? tr({ fi: "Synkataan…", en: "Syncing…", es: "Sincronizando…" }) : preferences.enabled ? tr({ fi: "Poista Auto-Watch", en: "Disable Auto-Watch", es: "Desactivar Auto-Watch" }) : tr({ fi: "Ota Auto-Watch käyttöön", en: "Enable Auto-Watch", es: "Activar Auto-Watch" })} onPress={() => void save(!preferences.enabled, Number(preferences.top_n || 3))} tone={preferences.enabled ? "secondary" : "primary"} disabled={saving || !available} />
              <ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={load} tone="secondary" disabled={saving} />
            </View>
            {message ? <Text style={local.message}>{message}</Text> : null}
            {preferences.last_error ? <Text style={local.warning}>{preferences.last_error}</Text> : null}
          </Card>

          <Card>
            <Text style={styles.cardTitle}>{tr({ fi: "Nykyinen Recommendation Top 3", en: "Current Recommendation Top 3", es: "Top 3 actual de recomendaciones" })}</Text>
            <Text style={styles.muted}>{tr({ fi: "SKIP-kohteita ei lisätä Auto-Watchiin. CAUTION ei muutu PLAYksi ilman oikean palvelinpäätöksen ja evidenssiporttien täyttymistä.", en: "SKIP items are not added to Auto-Watch. CAUTION never becomes PLAY without the real server decision and evidence gates passing.", es: "Los elementos SKIP no se añaden. CAUTION nunca se convierte en PLAY sin superar la decisión y los filtros del servidor." })}</Text>
            {recommendations.length ? recommendations.map((item, index) => <RecommendationCard key={`${item.eventId || index}-${item.selection || index}`} item={{ ...item, rank: item.rank || index + 1 }} />) : <Text style={styles.muted}>{tr({ fi: "Suosituksia ei juuri nyt ole saatavilla.", en: "Recommendations are not available right now.", es: "No hay recomendaciones disponibles ahora." })}</Text>}
          </Card>

          <Card><Text style={styles.cardTitle}>{tr({ fi: "Turvaraja", en: "Safety boundary", es: "Límite de seguridad" })}</Text><Text style={styles.muted}>{tr({ fi: "Auto-Watch lisää ja poistaa vain seurantarivejä. Se ei luo paperipanosta, muuta todennäköisyyttä eikä voi suorittaa oikean rahan vetoa.", en: "Auto-Watch only adds and removes watchlist rows. It creates no paper stake, changes no probability and cannot execute a real-money bet.", es: "Auto-Watch solo gestiona filas de seguimiento. No crea importe, no cambia probabilidades y no puede ejecutar apuestas reales." })}</Text></Card>
        </>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  card: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#334155", paddingTop: 14, gap: 7 },
  rank: { color: "#67e8f9", fontSize: 12, fontWeight: "800" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: { color: "#e2e8f0", fontSize: 12, fontWeight: "700" },
  gate: { color: "#fbbf24", fontSize: 12, fontWeight: "800" },
  sectionLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "800", marginTop: 14, textTransform: "uppercase" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  activeBadge: { borderColor: "#34d399" },
  message: { color: "#6ee7b7", fontWeight: "700", marginTop: 10 },
  warning: { color: "#fbbf24", fontWeight: "700", marginTop: 8 }
});
