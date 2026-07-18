import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import { ActionButton, Card, percent, styles } from "../ui";

type WatchAlert = {
  id: string;
  severity: "high" | "medium" | "info";
  title: string;
  message: string;
  match?: string;
  selection?: string;
};

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
  alerts?: WatchAlert[];
  summary?: { watched?: number; active?: number; alerts?: number; high?: number };
};

type NotificationItem = {
  id: string;
  notification_type: string;
  severity: "high" | "medium" | "info";
  match?: string | null;
  selection: string;
  payload?: Record<string, unknown>;
  last_seen_at: string;
  read_at?: string | null;
};

type NotificationSettings = {
  in_app_enabled: boolean;
  minimum_severity: "info" | "medium" | "high";
  kickoff_enabled: boolean;
  price_enabled: boolean;
  decision_enabled: boolean;
  availability_enabled: boolean;
};

type NotificationPayload = {
  items?: NotificationItem[];
  summary?: { total?: number; unread?: number; high?: number; unreadHigh?: number };
  settings?: NotificationSettings;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  in_app_enabled: true,
  minimum_severity: "info",
  kickoff_enabled: true,
  price_enabled: true,
  decision_enabled: true,
  availability_enabled: true
};

export default function WatchlistScreen() {
  const { tr, locale } = useLanguage();
  const [data, setData] = useState<WatchPayload>({});
  const [notifications, setNotifications] = useState<NotificationPayload>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load(sync = false) {
    setLoading(true);
    try {
      const [watchPayload, notificationPayload] = await Promise.all([
        apiRequest<WatchPayload>("/api/cloud/watchlist"),
        apiRequest<NotificationPayload>("/api/cloud/notifications", sync ? { method: "POST", body: { action: "sync" } } : undefined)
      ]);
      setData(watchPayload);
      setNotifications(notificationPayload);
    } catch (error) {
      setData({});
      setNotifications({});
      Alert.alert(tr({ fi: "Seurantaa ei voitu ladata", en: "Tracking could not be loaded", es: "No se pudo cargar el seguimiento" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(false); }, []);

  async function notificationAction(key: string, method: "PATCH" | "DELETE" | "PUT", body: Record<string, unknown>) {
    setBusy(key);
    try {
      setNotifications(await apiRequest<NotificationPayload>("/api/cloud/notifications", { method, body }));
    } catch (error) {
      Alert.alert(tr({ fi: "Ilmoitusta ei voitu päivittää", en: "Notification could not be updated", es: "No se pudo actualizar la notificación" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setBusy(null); }
  }

  async function toggle(item: WatchItem) {
    setBusy(item.id);
    try {
      await apiRequest("/api/cloud/watchlist", { method: "PATCH", body: { id: item.id, active: !item.active } });
      await load(true);
    } catch (error) {
      Alert.alert(tr({ fi: "Päivitys epäonnistui", en: "Update failed", es: "La actualización falló" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setBusy(null); }
  }

  async function remove(item: WatchItem) {
    setBusy(item.id);
    try {
      await apiRequest("/api/cloud/watchlist", { method: "DELETE", body: { id: item.id } });
      await load(true);
    } catch (error) {
      Alert.alert(tr({ fi: "Poistaminen epäonnistui", en: "Removal failed", es: "No se pudo eliminar" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setBusy(null); }
  }

  async function updateSetting(changes: Partial<NotificationSettings>) {
    const settings = { ...DEFAULT_SETTINGS, ...(notifications.settings || {}), ...changes };
    await notificationAction("settings", "PUT", {
      inAppEnabled: settings.in_app_enabled,
      minimumSeverity: settings.minimum_severity,
      kickoffEnabled: settings.kickoff_enabled,
      priceEnabled: settings.price_enabled,
      decisionEnabled: settings.decision_enabled,
      availabilityEnabled: settings.availability_enabled
    });
  }

  const date = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };
  const watchSummary = data.summary || {};
  const notificationSummary = notifications.summary || {};
  const settings = { ...DEFAULT_SETTINGS, ...(notifications.settings || {}) };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.title}>{tr({ fi: "Vahti ja ilmoitukset", en: "Watch and notifications", es: "Lista y notificaciones" })}</Text><Text style={styles.subtitle}>{tr({ fi: "Käyttäjäkohtaiset ilmoitukset syntyvät vain todennetuista Watchlist-muutoksista. Taustapush ei ole käytössä.", en: "User-specific notifications are generated only from verified Watchlist changes. Background push is not enabled.", es: "Las notificaciones personales se generan solo a partir de cambios verificados. Las notificaciones push no están activadas." })}</Text></View><ActionButton label={tr({ fi: "Synkronoi", en: "Sync", es: "Sincronizar" })} onPress={() => load(true)} tone="secondary" compact disabled={loading || busy !== null} /></View>
      {loading && <ActivityIndicator color="#34d399" size="large" />}
      {!loading && <>
        <Card><Text style={styles.cardTitle}>{tr({ fi: "Ilmoituskeskus", en: "Notification Center", es: "Centro de notificaciones" })}</Text><Text style={styles.metric}>{notificationSummary.unread || 0}</Text><Text style={styles.muted}>{tr({ fi: "lukematta", en: "unread", es: "sin leer" })} · {notificationSummary.total || 0} {tr({ fi: "yhteensä", en: "total", es: "en total" })} · {notificationSummary.unreadHigh || 0} {tr({ fi: "korkeaa lukematta", en: "unread high", es: "altas sin leer" })}</Text><View style={styles.actionRow}><ActionButton label={tr({ fi: "Kaikki luetuiksi", en: "Mark all read", es: "Marcar todo leído" })} onPress={() => notificationAction("all-read", "PATCH", { markAllRead: true })} tone="secondary" compact disabled={busy !== null || !notificationSummary.unread} /><ActionButton label={settings.in_app_enabled ? tr({ fi: "Poista ilmoitukset käytöstä", en: "Disable notifications", es: "Desactivar notificaciones" }) : tr({ fi: "Ota ilmoitukset käyttöön", en: "Enable notifications", es: "Activar notificaciones" })} onPress={() => updateSetting({ in_app_enabled: !settings.in_app_enabled })} tone="secondary" compact disabled={busy !== null} /></View><Text style={styles.muted}>{tr({ fi: "Vähimmäistaso", en: "Minimum severity", es: "Severidad mínima" })}: {settings.minimum_severity.toUpperCase()}</Text><View style={styles.actionRow}>{(["info", "medium", "high"] as const).map((level) => <ActionButton key={level} label={level.toUpperCase()} onPress={() => updateSetting({ minimum_severity: level })} tone={settings.minimum_severity === level ? "primary" : "secondary"} compact disabled={busy !== null} />)}</View></Card>

        {(notifications.items || []).slice(0, 20).map((item) => {
          const copy = notificationCopy(item, tr);
          const read = Boolean(item.read_at);
          return <Card key={item.id}><View style={styles.rowBetween}><View style={[styles.badge, item.severity === "high" ? styles.dangerBadge : item.severity === "medium" ? styles.warningBadge : null]}><Text style={styles.badgeText}>{item.severity.toUpperCase()} · {read ? tr({ fi: "LUETTU", en: "READ", es: "LEÍDA" }) : tr({ fi: "UUSI", en: "NEW", es: "NUEVA" })}</Text></View><Text style={styles.muted}>{date(item.last_seen_at)}</Text></View><Text style={styles.cardTitle}>{copy.title}</Text><Text style={styles.muted}>{copy.message}</Text><Text style={styles.muted}>{item.match || tr({ fi: "Ottelu", en: "Fixture", es: "Partido" })} · {item.selection}</Text><View style={styles.actionRow}><ActionButton label={read ? tr({ fi: "Lukemattomaksi", en: "Mark unread", es: "Marcar sin leer" }) : tr({ fi: "Luetuksi", en: "Mark read", es: "Marcar leída" })} onPress={() => notificationAction(`read-${item.id}`, "PATCH", { id: item.id, read: !read })} tone="secondary" compact disabled={busy !== null} /><ActionButton label={tr({ fi: "Poista", en: "Remove", es: "Eliminar" })} onPress={() => notificationAction(`dismiss-${item.id}`, "DELETE", { id: item.id })} tone="danger" compact disabled={busy !== null} /></View></Card>;
        })}
        {(notifications.items || []).length === 0 && <Card><Text style={styles.cardTitle}>{tr({ fi: "Ei tallennettuja ilmoituksia", en: "No stored notifications", es: "No hay notificaciones guardadas" })}</Text><Text style={styles.muted}>{tr({ fi: "Synkronoi aktiivinen Watchlist. Ilmoituksia ei keksitä, jos varmennettua muutosta ei löydy.", en: "Synchronize an active Watchlist. No notification is invented when no verified change exists.", es: "Sincroniza una lista activa. No se inventan notificaciones si no existe un cambio verificado." })}</Text></Card>}

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Seurantalistan yhteenveto", en: "Watchlist summary", es: "Resumen de la lista" })}</Text><Text style={styles.metric}>{watchSummary.watched || 0}</Text><Text style={styles.muted}>{tr({ fi: "aktiivisia", en: "active", es: "activos" })} {watchSummary.active || 0} · {tr({ fi: "nykyisiä hälytyksiä", en: "current alerts", es: "alertas actuales" })} {watchSummary.alerts || 0} · {tr({ fi: "korkeita", en: "high", es: "altas" })} {watchSummary.high || 0}</Text></Card>
        {(data.items || []).map((item) => <Card key={item.id}><View style={styles.rowBetween}><View style={[styles.badge, !item.active && styles.warningBadge]}><Text style={styles.badgeText}>{item.active ? tr({ fi: "AKTIIVINEN", en: "ACTIVE", es: "ACTIVO" }) : tr({ fi: "TAUKO", en: "PAUSED", es: "PAUSADO" })}</Text></View><Text style={styles.muted}>{date(item.commence_time)}</Text></View><Text style={styles.cardTitle}>{item.match}</Text><Text style={styles.value}>{item.selection} · {Number(item.added_odds || 0).toFixed(2)} → {item.current?.odds ? Number(item.current.odds).toFixed(2) : "–"}</Text><Text style={styles.muted}>{tr({ fi: "Päätös", en: "Decision", es: "Decisión" })} {item.added_decision} → {item.current?.decision || "–"} · {tr({ fi: "hintamuutos", en: "price move", es: "cambio" })} {item.oddsMove === null || item.oddsMove === undefined ? "–" : percent(item.oddsMove)}</Text><Text style={styles.muted}>PLAY {item.current?.minimumPlayOdds ? Number(item.current.minimumPlayOdds).toFixed(2) : "–"}</Text><View style={styles.actionRow}><ActionButton label={item.active ? tr({ fi: "Keskeytä", en: "Pause", es: "Pausar" }) : tr({ fi: "Aktivoi", en: "Activate", es: "Activar" })} onPress={() => toggle(item)} tone="secondary" compact disabled={busy !== null} /><ActionButton label={tr({ fi: "Poista", en: "Remove", es: "Eliminar" })} onPress={() => remove(item)} tone="danger" compact disabled={busy !== null} /></View></Card>)}
        {(data.items || []).length === 0 && <Card><Text style={styles.cardTitle}>{tr({ fi: "Seurantalista on tyhjä", en: "Watchlist is empty", es: "La lista está vacía" })}</Text><Text style={styles.muted}>{tr({ fi: "Lisää varmennettu kohde Kohteet-välilehdeltä.", en: "Add a verified selection from the Picks tab.", es: "Añade una selección verificada desde Pronósticos." })}</Text></Card>}
      </>}
    </ScrollView>
  );
}

function notificationCopy(item: NotificationItem, tr: ReturnType<typeof useLanguage>["tr"]) {
  const details = item.payload || {};
  const odds = (value: unknown) => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "–";
  const movement = Number.isFinite(Number(details.oddsMove)) ? `${(Number(details.oddsMove) * 100).toFixed(1)} %` : "–";
  if (item.notification_type === "kickoff_soon") return { title: tr({ fi: "Ottelu alkaa pian", en: "Kickoff is approaching", es: "El partido comienza pronto" }), message: tr({ fi: `Ottelu alkaa noin ${details.minutesToKickoff ?? "–"} minuutin kuluttua.`, en: `The fixture starts in about ${details.minutesToKickoff ?? "–"} minutes.`, es: `El partido comienza en unos ${details.minutesToKickoff ?? "–"} minutos.` }) };
  if (item.notification_type === "decision_changed") return { title: tr({ fi: "Päätös muuttui", en: "Decision changed", es: "Cambió la decisión" }), message: `${details.addedDecision || "–"} → ${details.currentDecision || "–"}` };
  if (item.notification_type === "price_moved") return { title: tr({ fi: "Kerroin muuttui", en: "Price moved", es: "Cambió la cuota" }), message: `${odds(details.addedOdds)} → ${odds(details.currentOdds)} · ${movement}` };
  if (item.notification_type === "below_play_price") return { title: tr({ fi: "Hinta alittaa PLAY-rajan", en: "Price is below the PLAY floor", es: "La cuota está bajo el límite PLAY" }), message: `${odds(details.currentOdds)} < ${odds(details.minimumPlayOdds)}` };
  if (item.notification_type === "market_unavailable") return { title: tr({ fi: "Markkina ei ole saatavilla", en: "Market unavailable", es: "Mercado no disponible" }), message: tr({ fi: "Vastaavaa live-markkinaa ei löytynyt. Korvaavaa tietoa ei keksitty.", en: "No matching live market was found. No replacement data was invented.", es: "No se encontró un mercado en vivo equivalente. No se inventaron datos." }) };
  return { title: tr({ fi: "Seuranta-aika päättyi", en: "Watch window ended", es: "Terminó la ventana de seguimiento" }), message: tr({ fi: "Alkamisaika on ohitettu. Tulosseuranta on erillinen.", en: "Kickoff has passed. Result tracking is separate.", es: "La hora de inicio pasó. El seguimiento de resultados es independiente." }) };
}
