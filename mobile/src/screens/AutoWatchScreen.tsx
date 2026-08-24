import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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

type SelectionMode = "play-only" | "play-and-caution";

type Preferences = {
  enabled?: boolean;
  top_n?: number;
  alert_move_percent?: number;
  alert_before_minutes?: number;
  selection_mode?: SelectionMode;
  min_score?: number;
  min_edge?: number;
  min_ev?: number;
  sport_keys?: string[];
  last_completed_at?: string | null;
  last_status?: string | null;
  last_error?: string | null;
};

type AutoWatchPayload = {
  ok: boolean;
  available?: boolean;
  version?: number;
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

const DEFAULTS: Preferences = {
  enabled: false,
  top_n: 3,
  alert_move_percent: 0.03,
  alert_before_minutes: 120,
  selection_mode: "play-and-caution",
  min_score: 0,
  min_edge: 0,
  min_ev: 0,
  sport_keys: []
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

function numeric(value: string, fallback = 0) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [sportFilterText, setSportFilterText] = useState("");
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
        apiRequest<RecommendationPayload>("/api/recommendations?limit=10", { authenticated: false, timeoutMs: 30000 })
      ]);
      const next = { ...DEFAULTS, ...(autoWatch.preferences || {}) };
      setAvailable(autoWatch.available !== false);
      setPreferences(next);
      setSportFilterText((next.sport_keys || []).join(", "));
      setManagedCount(Number(autoWatch.autoManagedCount || 0));
      setRecommendations(feed.recommendations || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tr({ fi: "Auto-Watchin lataus epäonnistui", en: "Auto-Watch could not be loaded", es: "No se pudo cargar Auto-Watch" }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [tr]);

  async function save(nextEnabled = preferences.enabled === true) {
    if (saving || !available) return;
    setSaving(true);
    setMessage("");
    const sportKeys = [...new Set(sportFilterText.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
    const nextTopN = Number(preferences.top_n || 3);
    try {
      const payload = await apiRequest<AutoWatchPayload>("/api/cloud/auto-watch-recommendations", {
        method: "PATCH",
        body: {
          enabled: nextEnabled,
          topN: nextTopN,
          alertMovePercent: Number(preferences.alert_move_percent || 0.03),
          alertBeforeMinutes: Number(preferences.alert_before_minutes || 120),
          selectionMode: preferences.selection_mode || "play-and-caution",
          minScore: Number(preferences.min_score || 0),
          minEdge: Number(preferences.min_edge || 0),
          minEv: Number(preferences.min_ev || 0),
          sportKeys
        }
      });
      const sync = payload.sync || {};
      const next = { ...preferences, ...(payload.preferences || {}), enabled: nextEnabled, top_n: nextTopN };
      setPreferences(next);
      setSportFilterText((next.sport_keys || sportKeys).join(", "));
      setManagedCount(nextEnabled ? Number(sync.retainedAuto || 0) + Number(sync.inserted || 0) : 0);
      setMessage(payload.warning || (nextEnabled
        ? tr({ fi: `Top ${nextTopN} Auto-Watch V2 synkattu valituilla suodattimilla.`, en: `Top ${nextTopN} Auto-Watch V2 synchronized with your filters.`, es: `Auto-Watch V2 Top ${nextTopN} sincronizado con tus filtros.` })
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
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.mobileHero}>
        <Text style={styles.kicker}>AUTO-WATCH RECOMMENDATIONS V2</Text>
        <Text style={styles.title}>{tr({ fi: `Scorecaster valvoo valitsemaasi Top ${preferences.top_n || 3}:a`, en: `Scorecaster monitors your selected Top ${preferences.top_n || 3}`, es: `Scorecaster supervisa tu Top ${preferences.top_n || 3}` })}</Text>
        <Text style={styles.subtitle}>{tr({ fi: "Rajaa automaattiseuranta päätöksellä, pisteillä, edgellä, EV:llä ja lajeilla. Vain auto-managed-rivejä kierrätetään; käsin lisättyihin seurantoihin ei kosketa eikä oikean rahan vetoja suoriteta.", en: "Filter automatic monitoring by decision, score, edge, EV and sports. Only auto-managed rows rotate; manual watches stay untouched and no real-money bet is executed.", es: "Filtra la supervisión por decisión, puntuación, edge, EV y deportes. Solo rotan las filas automáticas y nunca se ejecutan apuestas reales." })}</Text>
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
              {[1, 3, 5, 10].map((value) => <ActionButton key={value} label={`Top ${value}`} onPress={() => setPreferences((current) => ({ ...current, top_n: value }))} tone={Number(preferences.top_n || 3) === value ? "primary" : "secondary"} compact disabled={saving} />)}
            </View>

            <Text style={local.sectionLabel}>{tr({ fi: "Päätössuodatin", en: "Decision filter", es: "Filtro de decisión" })}</Text>
            <View style={local.actions}>
              <ActionButton label="PLAY only" onPress={() => setPreferences((current) => ({ ...current, selection_mode: "play-only" }))} tone={preferences.selection_mode === "play-only" ? "primary" : "secondary"} compact disabled={saving} />
              <ActionButton label="PLAY + CAUTION" onPress={() => setPreferences((current) => ({ ...current, selection_mode: "play-and-caution" }))} tone={preferences.selection_mode !== "play-only" ? "primary" : "secondary"} compact disabled={saving} />
            </View>

            <View style={local.inputGrid}>
              <View style={local.inputGroup}>
                <Text style={local.inputLabel}>Min score</Text>
                <TextInput style={local.input} keyboardType="decimal-pad" value={String(preferences.min_score ?? 0)} onChangeText={(value) => setPreferences((current) => ({ ...current, min_score: numeric(value) }))} editable={!saving} />
              </View>
              <View style={local.inputGroup}>
                <Text style={local.inputLabel}>Min edge %</Text>
                <TextInput style={local.input} keyboardType="decimal-pad" value={String(Number(preferences.min_edge || 0) * 100)} onChangeText={(value) => setPreferences((current) => ({ ...current, min_edge: numeric(value) / 100 }))} editable={!saving} />
              </View>
              <View style={local.inputGroup}>
                <Text style={local.inputLabel}>Min EV %</Text>
                <TextInput style={local.input} keyboardType="decimal-pad" value={String(Number(preferences.min_ev || 0) * 100)} onChangeText={(value) => setPreferences((current) => ({ ...current, min_ev: numeric(value) / 100 }))} editable={!saving} />
              </View>
            </View>

            <Text style={local.sectionLabel}>{tr({ fi: "Lajit / liigat (sport key, pilkulla)", en: "Sports / leagues (sport key, comma-separated)", es: "Deportes / ligas (sport key, separados por coma)" })}</Text>
            <TextInput
              style={local.input}
              value={sportFilterText}
              onChangeText={setSportFilterText}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="soccer_norway_eliteserien, basketball_wnba"
              placeholderTextColor="#64748b"
              editable={!saving}
            />
            <Text style={styles.muted}>{tr({ fi: "Tyhjä = kaikki Recommendation Feedin lajit. Enintään 20 suodatinta.", en: "Empty = all sports in the Recommendation Feed. Maximum 20 filters.", es: "Vacío = todos los deportes del feed. Máximo 20 filtros." })}</Text>

            <View style={local.actions}>
              <ActionButton label={saving ? tr({ fi: "Synkataan…", en: "Syncing…", es: "Sincronizando…" }) : preferences.enabled ? tr({ fi: "Poista Auto-Watch", en: "Disable Auto-Watch", es: "Desactivar Auto-Watch" }) : tr({ fi: "Ota Auto-Watch käyttöön", en: "Enable Auto-Watch", es: "Activar Auto-Watch" })} onPress={() => void save(!preferences.enabled)} tone={preferences.enabled ? "secondary" : "primary"} disabled={saving || !available} />
              <ActionButton label={tr({ fi: "Tallenna ja synkkaa", en: "Save & sync", es: "Guardar y sincronizar" })} onPress={() => void save(preferences.enabled === true)} tone="primary" disabled={saving || !available} />
              <ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={load} tone="secondary" disabled={saving} />
            </View>
            {message ? <Text style={local.message}>{message}</Text> : null}
            {preferences.last_error ? <Text style={local.warning}>{preferences.last_error}</Text> : null}
          </Card>

          <Card>
            <Text style={styles.cardTitle}>{tr({ fi: "Nykyinen Recommendation Top 10", en: "Current Recommendation Top 10", es: "Top 10 actual de recomendaciones" })}</Text>
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
  inputGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  inputGroup: { minWidth: 96, flexGrow: 1 },
  inputLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "800", marginBottom: 6 },
  input: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderColor: "#475569", borderRadius: 12, backgroundColor: "#0f172a", color: "#f8fafc", paddingHorizontal: 12, paddingVertical: 10, fontWeight: "700" },
  activeBadge: { borderColor: "#34d399" },
  message: { color: "#6ee7b7", fontWeight: "700", marginTop: 10 },
  warning: { color: "#fbbf24", fontWeight: "700", marginTop: 8 }
});
