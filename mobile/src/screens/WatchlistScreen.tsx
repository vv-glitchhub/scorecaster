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

type InboxAlert = WatchAlert & {
  fingerprint?: string;
  active: boolean;
  read_at?: string | null;
  resolved_at?: string | null;
  last_seen_at?: string;
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

type InboxSummary = {
  total?: number;
  unread?: number;
  active?: number;
  high?: number;
  medium?: number;
  resolved?: number;
};

type WatchPayload = {
  items?: WatchItem[];
  alerts?: WatchAlert[];
  summary?: { watched?: number; active?: number; alerts?: number; high?: number };
  inbox?: {
    available?: boolean;
    items?: InboxAlert[];
    summary?: InboxSummary;
    warning?: string | null;
  };
};

export default function WatchlistScreen() {
  const { tr, locale } = useLanguage();
  const [data, setData] = useState<WatchPayload>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setData(await apiRequest<WatchPayload>("/api/cloud/watchlist"));
    } catch (error) {
      setData({});
      Alert.alert(tr({ fi: "Seurantalistaa ei voitu ladata", en: "Watchlist could not be loaded", es: "No se pudo cargar la lista" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggle(item: WatchItem) {
    setBusy(item.id);
    try {
      await apiRequest("/api/cloud/watchlist", { method: "PATCH", body: { id: item.id, active: !item.active } });
      await load();
    } catch (error) {
      Alert.alert(tr({ fi: "Päivitys epäonnistui", en: "Update failed", es: "La actualización falló" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setBusy(null); }
  }

  async function remove(item: WatchItem) {
    setBusy(item.id);
    try {
      await apiRequest("/api/cloud/watchlist", { method: "DELETE", body: { id: item.id } });
      await load();
    } catch (error) {
      Alert.alert(tr({ fi: "Poistaminen epäonnistui", en: "Removal failed", es: "No se pudo eliminar" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setBusy(null); }
  }

  async function markRead(id?: string) {
    setBusy(id || "all-alerts");
    try {
      await apiRequest("/api/cloud/alerts", {
        method: "PATCH",
        body: id ? { id } : { markAllRead: true }
      });
      await load();
    } catch (error) {
      Alert.alert(tr({ fi: "Hälytystä ei voitu kuitata", en: "Alert could not be marked read", es: "No se pudo marcar la alerta" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setBusy(null); }
  }

  const date = (value?: string) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };
  const summary = data.summary || {};
  const inboxSummary = data.inbox?.summary || {};
  const inboxItems: Array<InboxAlert | WatchAlert> = data.inbox?.available ? data.inbox.items || [] : data.alerts || [];

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.title}>{tr({ fi: "Seurantalista", en: "Watchlist", es: "Lista de seguimiento" })}</Text><Text style={styles.subtitle}>{tr({ fi: "Todennetut muutokset tallennetaan deduplikoituun inboxiin. Panoksia ei luoda.", en: "Verified changes are stored in a deduplicated inbox. No stakes are created.", es: "Los cambios verificados se guardan sin duplicados. No se crean importes." })}</Text></View><ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={load} tone="secondary" compact disabled={loading || busy !== null} /></View>
      {loading && <ActivityIndicator color="#34d399" size="large" />}

      {!loading && <>
        <Card><Text style={styles.cardTitle}>{tr({ fi: "Yhteenveto", en: "Summary", es: "Resumen" })}</Text><Text style={styles.metric}>{summary.watched || 0}</Text><Text style={styles.muted}>{tr({ fi: "aktiivisia kohteita", en: "active picks", es: "pronósticos activos" })} {summary.active || 0} · {tr({ fi: "lukemattomia", en: "unread", es: "no leídas" })} {inboxSummary.unread ?? summary.alerts ?? 0} · {tr({ fi: "aktiivisia hälytyksiä", en: "active alerts", es: "alertas activas" })} {inboxSummary.active ?? summary.alerts ?? 0}</Text>{data.inbox?.warning ? <Text style={styles.muted}>{data.inbox.warning}</Text> : null}{data.inbox?.available && Number(inboxSummary.unread || 0) > 0 ? <ActionButton label={tr({ fi: "Merkitse kaikki luetuiksi", en: "Mark all read", es: "Marcar todas leídas" })} onPress={() => markRead()} tone="secondary" compact disabled={busy !== null} /> : null}</Card>

        {inboxItems.map((item) => {
          const persisted = "active" in item;
          const unread = persisted ? !item.read_at : false;
          const active = persisted ? item.active : true;
          return <Card key={item.id || (persisted ? item.fingerprint : item.title)}><View style={styles.rowBetween}><View style={[styles.badge, item.severity === "high" ? styles.dangerBadge : item.severity === "medium" ? styles.warningBadge : null]}><Text style={styles.badgeText}>{item.severity.toUpperCase()}</Text></View><Text style={styles.muted}>{active ? tr({ fi: "aktiivinen", en: "active", es: "activa" }) : tr({ fi: "ratkaistu", en: "resolved", es: "resuelta" })}{unread ? ` · ${tr({ fi: "uusi", en: "new", es: "nueva" })}` : ""}</Text></View><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.muted}>{item.message}</Text><Text style={styles.muted}>{item.match || ""} · {item.selection || ""}</Text>{persisted && item.last_seen_at ? <Text style={styles.muted}>{date(item.last_seen_at)}</Text> : null}{persisted && unread ? <ActionButton label={tr({ fi: "Merkitse luetuksi", en: "Mark read", es: "Marcar leída" })} onPress={() => markRead(item.id)} tone="secondary" compact disabled={busy !== null} /> : null}</Card>;
        })}

        {(data.items || []).map((item) => <Card key={item.id}><View style={styles.rowBetween}><View style={[styles.badge, !item.active && styles.warningBadge]}><Text style={styles.badgeText}>{item.active ? tr({ fi: "AKTIIVINEN", en: "ACTIVE", es: "ACTIVO" }) : tr({ fi: "TAUKO", en: "PAUSED", es: "PAUSADO" })}</Text></View><Text style={styles.muted}>{date(item.commence_time)}</Text></View><Text style={styles.cardTitle}>{item.match}</Text><Text style={styles.value}>{item.selection} · {Number(item.added_odds || 0).toFixed(2)} → {item.current?.odds ? Number(item.current.odds).toFixed(2) : "–"}</Text><Text style={styles.muted}>{tr({ fi: "Päätös", en: "Decision", es: "Decisión" })} {item.added_decision} → {item.current?.decision || "–"} · {tr({ fi: "hintamuutos", en: "price move", es: "cambio" })} {item.oddsMove === null || item.oddsMove === undefined ? "–" : percent(item.oddsMove)}</Text><Text style={styles.muted}>PLAY {item.current?.minimumPlayOdds ? Number(item.current.minimumPlayOdds).toFixed(2) : "–"}</Text><View style={styles.actionRow}><ActionButton label={item.active ? tr({ fi: "Keskeytä", en: "Pause", es: "Pausar" }) : tr({ fi: "Aktivoi", en: "Activate", es: "Activar" })} onPress={() => toggle(item)} tone="secondary" compact disabled={busy !== null} /><ActionButton label={tr({ fi: "Poista", en: "Remove", es: "Eliminar" })} onPress={() => remove(item)} tone="danger" compact disabled={busy !== null} /></View></Card>)}
        {(data.items || []).length === 0 && <Card><Text style={styles.cardTitle}>{tr({ fi: "Seurantalista on tyhjä", en: "Watchlist is empty", es: "La lista está vacía" })}</Text><Text style={styles.muted}>{tr({ fi: "Lisää varmennettu kohde Kohteet-välilehdeltä.", en: "Add a verified selection from the Picks tab.", es: "Añade una selección verificada desde Pronósticos." })}</Text></Card>}
      </>}
    </ScrollView>
  );
}
