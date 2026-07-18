import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import { localizedAlertCopy, type AlertDetails } from "../lib/alert-inbox-copy";
import { ActionButton, Card, percent, styles } from "../ui";

type WatchItem = {
  id: string;
  event_id: string;
  match: string;
  selection: string;
  commence_time: string;
  added_odds: number;
  added_decision: string;
  active: boolean;
  oddsMove?: number | null;
  current?: { odds?: number; decision?: string; minimumPlayOdds?: number | null } | null;
};

type WatchPayload = {
  items?: WatchItem[];
  summary?: { watched?: number; active?: number; alerts?: number; high?: number };
};

type InboxAlert = {
  id: string;
  fingerprint?: string;
  alert_type: string;
  severity: "high" | "medium" | "info";
  title?: string;
  message?: string;
  match?: string;
  selection?: string;
  details?: AlertDetails;
  active: boolean;
  read_at?: string | null;
  resolved_at?: string | null;
  dismissed_at?: string | null;
  last_seen_at?: string;
};

type InboxSettings = {
  enabled: boolean;
  minimum_severity: "info" | "medium" | "high";
  kickoff_enabled: boolean;
  price_enabled: boolean;
  decision_enabled: boolean;
  availability_enabled: boolean;
};

type InboxPayload = {
  available?: boolean;
  v2Available?: boolean;
  settingsAvailable?: boolean;
  warning?: string | null;
  items?: InboxAlert[];
  summary?: { total?: number; unread?: number; active?: number; high?: number; resolved?: number; dismissed?: number };
  settings?: InboxSettings;
};

const DEFAULT_SETTINGS: InboxSettings = {
  enabled: true,
  minimum_severity: "info",
  kickoff_enabled: true,
  price_enabled: true,
  decision_enabled: true,
  availability_enabled: true
};
const FILTERS = ["all", "unread", "active", "resolved"] as const;
type Filter = (typeof FILTERS)[number];

export default function WatchlistScreen() {
  const { tr, locale } = useLanguage();
  const [watchlist, setWatchlist] = useState<WatchPayload>({});
  const [inbox, setInbox] = useState<InboxPayload>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load(selectedFilter: Filter = filter) {
    setLoading(true);
    try {
      const watchPayload = await apiRequest<WatchPayload>("/api/cloud/watchlist");
      const inboxPayload = await apiRequest<InboxPayload>(`/api/cloud/alerts?status=${selectedFilter}&limit=100`);
      setWatchlist(watchPayload);
      setInbox(inboxPayload);
    } catch (error) {
      setWatchlist({});
      setInbox({});
      Alert.alert(tr({ fi: "Seurantaa ei voitu ladata", en: "Tracking could not be loaded", es: "No se pudo cargar el seguimiento" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load("all"); }, []);

  async function watchAction(item: WatchItem, method: "PATCH" | "DELETE", body: Record<string, unknown>) {
    setBusy(item.id);
    try {
      await apiRequest("/api/cloud/watchlist", { method, body: { id: item.id, ...body } });
      await load(filter);
    } catch (error) {
      Alert.alert(tr({ fi: "Toiminto epäonnistui", en: "Action failed", es: "La acción falló" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setBusy(null); }
  }

  async function inboxAction(key: string, method: "PUT" | "PATCH" | "DELETE", body: Record<string, unknown>) {
    setBusy(key);
    try {
      await apiRequest("/api/cloud/alerts", { method, body });
      setInbox(await apiRequest<InboxPayload>(`/api/cloud/alerts?status=${filter}&limit=100`));
    } catch (error) {
      Alert.alert(tr({ fi: "Inboxia ei voitu päivittää", en: "The inbox could not be updated", es: "No se pudo actualizar el buzón" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setBusy(null); }
  }

  async function saveSettings(changes: Partial<InboxSettings>) {
    const settings = { ...DEFAULT_SETTINGS, ...(inbox.settings || {}), ...changes };
    await inboxAction("settings", "PUT", {
      enabled: settings.enabled,
      minimumSeverity: settings.minimum_severity,
      kickoffEnabled: settings.kickoff_enabled,
      priceEnabled: settings.price_enabled,
      decisionEnabled: settings.decision_enabled,
      availabilityEnabled: settings.availability_enabled
    });
    await load(filter);
  }

  async function chooseFilter(value: Filter) {
    setFilter(value);
    setLoading(true);
    try { setInbox(await apiRequest<InboxPayload>(`/api/cloud/alerts?status=${value}&limit=100`)); }
    catch (error) { Alert.alert("Alert Inbox", error instanceof Error ? error.message : "Unknown error"); }
    finally { setLoading(false); }
  }

  const date = (value?: string) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };
  const summary = watchlist.summary || {};
  const inboxSummary = inbox.summary || {};
  const settings = { ...DEFAULT_SETTINGS, ...(inbox.settings || {}) };
  const filterLabel = (value: Filter) => ({
    all: tr({ fi: "Kaikki", en: "All", es: "Todas" }),
    unread: tr({ fi: "Uudet", en: "Unread", es: "Nuevas" }),
    active: tr({ fi: "Aktiiviset", en: "Active", es: "Activas" }),
    resolved: tr({ fi: "Ratkaistut", en: "Resolved", es: "Resueltas" })
  }[value]);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.title}>{tr({ fi: "Vahti ja Alert Inbox", en: "Watch and Alert Inbox", es: "Lista y buzón de alertas" })}</Text><Text style={styles.subtitle}>{tr({ fi: "Todennetut muutokset säilytetään ilman kaksoiskappaleita ja lokalisoidaan valitulle kielelle. Panoksia ei luoda.", en: "Verified changes are stored without duplicates and localized to the selected language. No stakes are created.", es: "Los cambios verificados se guardan sin duplicados y se localizan al idioma elegido. No se crean importes." })}</Text></View><ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={() => load(filter)} tone="secondary" compact disabled={loading || busy !== null} /></View>
      {loading && <ActivityIndicator color="#34d399" size="large" />}

      {!loading && <>
        <Card><Text style={styles.cardTitle}>Alert Inbox V2</Text><Text style={styles.metric}>{inboxSummary.unread || 0}</Text><Text style={styles.muted}>{tr({ fi: "lukematta", en: "unread", es: "sin leer" })} · {inboxSummary.active || 0} {tr({ fi: "aktiivista", en: "active", es: "activas" })} · {inboxSummary.resolved || 0} {tr({ fi: "ratkaistua", en: "resolved", es: "resueltas" })}</Text>{inbox.warning ? <Text style={styles.muted}>{inbox.warning}</Text> : null}<View style={styles.actionRow}>{FILTERS.map((value) => <ActionButton key={value} label={filterLabel(value)} onPress={() => chooseFilter(value)} tone={filter === value ? "primary" : "secondary"} compact disabled={busy !== null} />)}</View>{Number(inboxSummary.unread || 0) > 0 ? <ActionButton label={tr({ fi: "Kaikki luetuiksi", en: "Mark all read", es: "Marcar todo leído" })} onPress={() => inboxAction("all-read", "PATCH", { markAllRead: true })} tone="secondary" compact disabled={busy !== null} /> : null}</Card>

        {(inbox.items || []).map((item) => {
          const unread = !item.read_at;
          const copy = localizedAlertCopy(item, tr);
          return <Card key={item.id}><View style={styles.rowBetween}><View style={[styles.badge, item.severity === "high" ? styles.dangerBadge : item.severity === "medium" ? styles.warningBadge : null]}><Text style={styles.badgeText}>{item.severity.toUpperCase()}</Text></View><Text style={styles.muted}>{item.active ? tr({ fi: "aktiivinen", en: "active", es: "activa" }) : tr({ fi: "ratkaistu", en: "resolved", es: "resuelta" })}{unread ? ` · ${tr({ fi: "uusi", en: "new", es: "nueva" })}` : ""}</Text></View><Text style={styles.cardTitle}>{copy.title}</Text><Text style={styles.muted}>{copy.message}</Text><Text style={styles.muted}>{item.match || ""} · {item.selection || ""}</Text>{item.last_seen_at ? <Text style={styles.muted}>{date(item.last_seen_at)}</Text> : null}<View style={styles.actionRow}><ActionButton label={unread ? tr({ fi: "Luetuksi", en: "Mark read", es: "Marcar leída" }) : tr({ fi: "Lukemattomaksi", en: "Mark unread", es: "Marcar no leída" })} onPress={() => inboxAction(`read-${item.id}`, "PATCH", { id: item.id, read: unread })} tone="secondary" compact disabled={busy !== null} />{inbox.v2Available ? <ActionButton label={tr({ fi: "Poista inboxista", en: "Remove", es: "Eliminar" })} onPress={() => inboxAction(`dismiss-${item.id}`, "DELETE", { id: item.id })} tone="danger" compact disabled={busy !== null} /> : null}</View></Card>;
        })}
        {(inbox.items || []).length === 0 && <Card><Text style={styles.cardTitle}>{tr({ fi: "Ei hälytyksiä", en: "No alerts", es: "No hay alertas" })}</Text><Text style={styles.muted}>{tr({ fi: "Tällä suodattimella ei ole todennettuja muutoksia.", en: "There are no verified changes for this filter.", es: "No hay cambios verificados para este filtro." })}</Text></Card>}

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Inbox-asetukset", en: "Inbox settings", es: "Configuración del buzón" })}</Text><Text style={styles.muted}>{tr({ fi: "Vaikuttaa seuraavaan Watchlist-synkronointiin.", en: "Applies to the next Watchlist synchronization.", es: "Se aplica a la próxima sincronización." })}</Text><View style={styles.actionRow}><ActionButton label={settings.enabled ? tr({ fi: "Poista käytöstä", en: "Disable", es: "Desactivar" }) : tr({ fi: "Ota käyttöön", en: "Enable", es: "Activar" })} onPress={() => saveSettings({ enabled: !settings.enabled })} tone="secondary" compact disabled={!inbox.settingsAvailable || busy !== null} />{(["info", "medium", "high"] as const).map((level) => <ActionButton key={level} label={level.toUpperCase()} onPress={() => saveSettings({ minimum_severity: level })} tone={settings.minimum_severity === level ? "primary" : "secondary"} compact disabled={!inbox.settingsAvailable || busy !== null} />)}</View><SettingToggle label={tr({ fi: "Alkamisaika", en: "Kickoff", es: "Inicio" })} value={settings.kickoff_enabled} onPress={() => saveSettings({ kickoff_enabled: !settings.kickoff_enabled })} disabled={!inbox.settingsAvailable || busy !== null} /><SettingToggle label={tr({ fi: "Hintamuutokset", en: "Price changes", es: "Cambios de cuota" })} value={settings.price_enabled} onPress={() => saveSettings({ price_enabled: !settings.price_enabled })} disabled={!inbox.settingsAvailable || busy !== null} /><SettingToggle label={tr({ fi: "Päätösmuutokset", en: "Decision changes", es: "Cambios de decisión" })} value={settings.decision_enabled} onPress={() => saveSettings({ decision_enabled: !settings.decision_enabled })} disabled={!inbox.settingsAvailable || busy !== null} /><SettingToggle label={tr({ fi: "Saatavuus", en: "Availability", es: "Disponibilidad" })} value={settings.availability_enabled} onPress={() => saveSettings({ availability_enabled: !settings.availability_enabled })} disabled={!inbox.settingsAvailable || busy !== null} /><Text style={styles.muted}>{tr({ fi: "V2 on sovelluksen sisäinen ja käyttäjän päivittämä. Se ei pyydä laitteen ilmoituslupaa.", en: "V2 is in-app and user-refreshed. It does not request device notification permission.", es: "V2 es interno y se actualiza por el usuario. No solicita permiso de notificaciones." })}</Text></Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Seurantalistan yhteenveto", en: "Watchlist summary", es: "Resumen de la lista" })}</Text><Text style={styles.metric}>{summary.watched || 0}</Text><Text style={styles.muted}>{tr({ fi: "aktiivisia kohteita", en: "active picks", es: "pronósticos activos" })} {summary.active || 0}</Text></Card>
        {(watchlist.items || []).map((item) => <Card key={item.id}><View style={styles.rowBetween}><View style={[styles.badge, !item.active && styles.warningBadge]}><Text style={styles.badgeText}>{item.active ? tr({ fi: "AKTIIVINEN", en: "ACTIVE", es: "ACTIVO" }) : tr({ fi: "TAUKO", en: "PAUSED", es: "PAUSADO" })}</Text></View><Text style={styles.muted}>{date(item.commence_time)}</Text></View><Text style={styles.cardTitle}>{item.match}</Text><Text style={styles.value}>{item.selection} · {Number(item.added_odds || 0).toFixed(2)} → {item.current?.odds ? Number(item.current.odds).toFixed(2) : "–"}</Text><Text style={styles.muted}>{tr({ fi: "Päätös", en: "Decision", es: "Decisión" })} {item.added_decision} → {item.current?.decision || "–"} · {tr({ fi: "hintamuutos", en: "price move", es: "cambio" })} {item.oddsMove === null || item.oddsMove === undefined ? "–" : percent(item.oddsMove)}</Text><Text style={styles.muted}>PLAY {item.current?.minimumPlayOdds ? Number(item.current.minimumPlayOdds).toFixed(2) : "–"}</Text><View style={styles.actionRow}><ActionButton label={item.active ? tr({ fi: "Keskeytä", en: "Pause", es: "Pausar" }) : tr({ fi: "Aktivoi", en: "Activate", es: "Activar" })} onPress={() => watchAction(item, "PATCH", { active: !item.active })} tone="secondary" compact disabled={busy !== null} /><ActionButton label={tr({ fi: "Poista", en: "Remove", es: "Eliminar" })} onPress={() => watchAction(item, "DELETE", {})} tone="danger" compact disabled={busy !== null} /></View></Card>)}
        {(watchlist.items || []).length === 0 && <Card><Text style={styles.cardTitle}>{tr({ fi: "Seurantalista on tyhjä", en: "Watchlist is empty", es: "La lista está vacía" })}</Text><Text style={styles.muted}>{tr({ fi: "Lisää varmennettu kohde Kohteet-välilehdeltä.", en: "Add a verified selection from the Picks tab.", es: "Añade una selección verificada desde Pronósticos." })}</Text></Card>}
      </>}
    </ScrollView>
  );
}

function SettingToggle({ label, value, onPress, disabled }: { label: string; value: boolean; onPress: () => void; disabled: boolean }) {
  return <View style={styles.rowBetween}><Text style={styles.muted}>{label}: {value ? "ON" : "OFF"}</Text><ActionButton label={value ? "ON" : "OFF"} onPress={onPress} tone="secondary" compact disabled={disabled} /></View>;
}
