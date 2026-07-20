import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import { calculatePaperAnalytics } from "../lib/paperAnalytics";
import type { PaperBet } from "../types";
import { ActionButton, Card, Field, percent, styles } from "../ui";

type BetFilter = "all" | "open" | "settled" | "won" | "lost";
type SettlementStatus = "won" | "lost" | "void" | "push";
type AutoSettlementResponse = {
  ok: boolean;
  checked: number;
  settled: number;
  pending: number;
  providerWarnings?: { sport: string; error: string }[];
  updateFailures?: number;
};
type SettlementMonitorState = {
  next_check_at: string | null;
  last_completed_at: string | null;
  last_status: string;
  last_error: string | null;
  last_open_count: number;
  last_settled_count: number;
  last_pending_count: number;
  last_provider_warnings_count: number;
};
type SettlementMonitorResponse = {
  ok: boolean;
  available: boolean;
  warning?: string | null;
  monitorActive: boolean;
  enabledFlag: boolean;
  scoresProviderConfigured: boolean;
  state?: SettlementMonitorState | null;
};

function parseClosingOdds(value: string) {
  if (!value.trim()) return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) && number > 1 ? number : null;
}

export default function PaperBetsScreen() {
  const { tr, locale } = useLanguage();
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [monitor, setMonitor] = useState<SettlementMonitorResponse | null>(null);
  const [filter, setFilter] = useState<BetFilter>("all");
  const [newestFirst, setNewestFirst] = useState(true);
  const [closingOdds, setClosingOdds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [settlingAll, setSettlingAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const money = (value: unknown) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));
  const statusLabel = (status: string) => status === "open" ? tr({ fi: "AVOIN", en: "OPEN", es: "ABIERTO" }) : status === "won" ? tr({ fi: "VOITTO", en: "WIN", es: "VICTORIA" }) : status === "lost" ? tr({ fi: "TAPPIO", en: "LOSS", es: "DERROTA" }) : status === "push" ? tr({ fi: "PALAUTUS", en: "PUSH", es: "NULO" }) : status === "void" ? tr({ fi: "MITÄTÖN", en: "VOID", es: "ANULADO" }) : status.toUpperCase();
  const sourceLabel = (value?: string | null) => value === "odds-api-scores" ? tr({ fi: "automaattinen tulospalvelu", en: "automatic score service", es: "servicio automático de resultados" }) : value ? tr({ fi: "manuaalinen tai muu lähde", en: "manual or other source", es: "fuente manual u otra" }) : null;
  const dateTime = (value?: string | null) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale);
  };

  async function load() {
    setLoading(true);
    try {
      const [betResponse, monitorResponse] = await Promise.all([
        apiRequest<{ data: PaperBet[] }>("/api/cloud/bets"),
        apiRequest<SettlementMonitorResponse>("/api/cloud/settlement-monitor").catch(() => null)
      ]);
      setBets(betResponse.data || []);
      setMonitor(monitorResponse);
      setClosingOdds((current) => {
        const next = { ...current };
        (betResponse.data || []).forEach((bet) => {
          if (next[bet.id] === undefined && bet.closing_odds) next[bet.id] = String(bet.closing_odds);
        });
        return next;
      });
    } catch (error) {
      Alert.alert(
        tr({ fi: "Historiaa ei voitu ladata", en: "History could not be loaded", es: "No se pudo cargar el historial" }),
        error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" })
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function checkResults() {
    setSettlingAll(true);
    try {
      const response = await apiRequest<AutoSettlementResponse>("/api/cloud/bets/settle", { method: "POST", timeoutMs: 45000 });
      await load();
      const warningCount = Number(response.providerWarnings?.length || 0) + Number(response.updateFailures || 0);
      Alert.alert(
        tr({ fi: "Tulostarkistus valmis", en: "Result check complete", es: "Comprobación de resultados completada" }),
        tr({
          fi: `Tarkistettiin ${response.checked}, ratkaistiin ${response.settled} ja avoimeksi jäi ${response.pending}.${warningCount ? ` Varoituksia ${warningCount}.` : ""}`,
          en: `Checked ${response.checked}, settled ${response.settled} and ${response.pending} remain open.${warningCount ? ` Warnings: ${warningCount}.` : ""}`,
          es: `Se comprobaron ${response.checked}, se resolvieron ${response.settled} y quedan abiertos ${response.pending}.${warningCount ? ` Avisos: ${warningCount}.` : ""}`
        })
      );
    } catch (error) {
      Alert.alert(
        tr({ fi: "Tulostarkistus epäonnistui", en: "Result check failed", es: "Falló la comprobación de resultados" }),
        error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" })
      );
    } finally {
      setSettlingAll(false);
    }
  }

  async function settle(id: string, status: SettlementStatus) {
    const rawClosing = closingOdds[id] || "";
    const parsedClosing = parseClosingOdds(rawClosing);
    if (rawClosing.trim() && parsedClosing === null) {
      Alert.alert(
        tr({ fi: "Tarkista päätöskerroin", en: "Check closing odds", es: "Revisa la cuota de cierre" }),
        tr({ fi: "Kertoimen pitää olla suurempi kuin 1,00 tai kentän voi jättää tyhjäksi.", en: "Odds must be greater than 1.00 or the field can be left empty.", es: "La cuota debe ser superior a 1,00 o el campo puede dejarse vacío." })
      );
      return;
    }
    setBusyId(id);
    try {
      await apiRequest("/api/cloud/bets", { method: "PATCH", body: { id, status, closingOdds: parsedClosing } });
      await load();
    } catch (error) {
      Alert.alert(
        tr({ fi: "Päivitys epäonnistui", en: "Update failed", es: "La actualización falló" }),
        error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" })
      );
    } finally {
      setBusyId(null);
    }
  }

  function remove(id: string) {
    Alert.alert(
      tr({ fi: "Poistetaanko paperikohde?", en: "Delete paper pick?", es: "¿Eliminar pronóstico simulado?" }),
      tr({ fi: "Poisto vaikuttaa historiaan, kalibrointiin ja tunnuslukuihin.", en: "Deletion affects history, calibration and metrics.", es: "La eliminación afecta al historial, la calibración y las métricas." }),
      [
        { text: tr({ fi: "Peruuta", en: "Cancel", es: "Cancelar" }), style: "cancel" },
        {
          text: tr({ fi: "Poista", en: "Delete", es: "Eliminar" }),
          style: "destructive",
          onPress: async () => {
            setBusyId(id);
            try {
              await apiRequest("/api/cloud/bets", { method: "DELETE", body: { ids: [id] } });
              setBets((current) => current.filter((bet) => bet.id !== id));
            } catch (error) {
              Alert.alert(
                tr({ fi: "Poisto epäonnistui", en: "Deletion failed", es: "La eliminación falló" }),
                error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" })
              );
            } finally {
              setBusyId(null);
            }
          }
        }
      ]
    );
  }

  const analytics = useMemo(() => calculatePaperAnalytics(bets), [bets]);
  const visibleBets = useMemo(() => bets
    .filter((bet) => filter === "all" ? true : filter === "settled" ? bet.status !== "open" : bet.status === filter)
    .slice()
    .sort((a, b) => {
      const difference = Date.parse(b.created_at) - Date.parse(a.created_at);
      return newestFirst ? difference : -difference;
    }), [bets, filter, newestFirst]);
  const filters: { key: BetFilter; label: string }[] = [
    { key: "all", label: tr({ fi: "Kaikki", en: "All", es: "Todos" }) },
    { key: "open", label: tr({ fi: "Avoimet", en: "Open", es: "Abiertos" }) },
    { key: "settled", label: tr({ fi: "Ratkaistut", en: "Settled", es: "Resueltos" }) },
    { key: "won", label: tr({ fi: "Voitot", en: "Wins", es: "Victorias" }) },
    { key: "lost", label: tr({ fi: "Tappiot", en: "Losses", es: "Derrotas" }) }
  ];
  const monitorState = monitor?.state || null;
  const monitorStatus = monitor?.monitorActive
    ? tr({ fi: "aktiivinen", en: "active", es: "activo" })
    : monitor?.enabledFlag
      ? tr({ fi: "määritetty mutta ei valmis", en: "configured but not ready", es: "configurado pero no listo" })
      : tr({ fi: "ei aktivoitu", en: "not enabled", es: "no activado" });

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{tr({ fi: "Paperiseuranta", en: "Paper tracking", es: "Seguimiento simulado" })}</Text>
          <Text style={styles.subtitle}>{tr({ fi: "Tulos, ROI, CLV ja mallin kalibrointi ilman oikeaa rahaa.", en: "Results, ROI, CLV and model calibration without real money.", es: "Resultados, ROI, CLV y calibración del modelo sin dinero real." })}</Text>
        </View>
        <ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={load} tone="secondary" compact disabled={loading || settlingAll} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Yhteenveto", en: "Summary", es: "Resumen" })}</Text>
        <Text style={styles.metric}>{money(analytics.totalProfit)}</Text>
        <Text style={styles.muted}>{tr({ fi: "Ratkaistu", en: "Settled", es: "Resueltos" })} {analytics.settledBets} · {tr({ fi: "panokset", en: "stakes", es: "importes" })} {money(analytics.totalStake)} · ROI {percent(analytics.roi)} · CLV {analytics.averageClv.toFixed(2)} %</Text>
        <Text style={styles.muted}>{tr({ fi: "Avoimia", en: "Open", es: "Abiertos" })} {analytics.openBets} · {tr({ fi: "avoin altistus", en: "open exposure", es: "exposición abierta" })} {money(analytics.openExposure)} · {tr({ fi: "osumat", en: "hit rate", es: "aciertos" })} {percent(analytics.winRate)}</Text>
        <ActionButton label={settlingAll ? tr({ fi: "Tarkistetaan tuloksia…", en: "Checking results…", es: "Comprobando resultados…" }) : tr({ fi: "Tarkista avoimien tulokset", en: "Check open results", es: "Comprobar resultados abiertos" })} onPress={checkResults} disabled={settlingAll || loading || analytics.openBets === 0} />
        <Text style={styles.muted}>{tr({ fi: "Käsin tehtävä tarkistus säilyy varmistuksena ja ratkaisee vain tuetut H2H-paperikohteet, joille löytyy valmis lopputulos.", en: "Manual checking remains available as a fallback and settles only supported H2H paper picks with a completed result.", es: "La comprobación manual sigue disponible como respaldo y resuelve solo pronósticos H2H compatibles con resultado final." })}</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Automaattinen tulosseuranta", en: "Automatic result monitoring", es: "Seguimiento automático de resultados" })}</Text>
        <Text style={styles.value}>{monitorStatus}</Text>
        {monitor?.warning ? <Text style={styles.muted}>{monitor.warning}</Text> : null}
        <Text style={styles.muted}>{tr({ fi: "Viimeisin tila", en: "Latest status", es: "Último estado" })}: {monitorState?.last_status || "–"} · {tr({ fi: "viimeisin ajo", en: "last run", es: "última ejecución" })}: {dateTime(monitorState?.last_completed_at)}</Text>
        <Text style={styles.muted}>{tr({ fi: "Viime ajossa ratkaistiin", en: "Settled in latest run", es: "Resueltos en la última ejecución" })} {Number(monitorState?.last_settled_count || 0)} · {tr({ fi: "avoimeksi jäi", en: "remaining open", es: "quedan abiertos" })} {Number(monitorState?.last_pending_count || 0)} · {tr({ fi: "palveluvaroituksia", en: "provider warnings", es: "avisos del proveedor" })} {Number(monitorState?.last_provider_warnings_count || 0)}</Text>
        {monitorState?.last_error ? <Text style={styles.muted}>{monitorState.last_error}</Text> : null}
        <Text style={styles.muted}>{tr({ fi: "Taustaseuranta ei aseta vetoja eikä keksi puuttuvaa lopputulosta.", en: "Background monitoring does not place bets or invent missing results.", es: "El seguimiento en segundo plano no realiza apuestas ni inventa resultados." })}</Text>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filters.map((item) => {
          const active = filter === item.key;
          return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={item.key} onPress={() => setFilter(item.key)} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text></Pressable>;
        })}
        <Pressable accessibilityRole="button" onPress={() => setNewestFirst((value) => !value)} style={styles.filterChip}><Text style={styles.filterText}>{newestFirst ? tr({ fi: "Uusin ensin", en: "Newest first", es: "Más recientes primero" }) : tr({ fi: "Vanhin ensin", en: "Oldest first", es: "Más antiguos primero" })}</Text></Pressable>
      </ScrollView>

      {loading && <ActivityIndicator color="#34d399" size="large" />}
      {!loading && visibleBets.length === 0 && <Text style={styles.muted}>{tr({ fi: "Tällä suodattimella ei ole paperikohteita.", en: "No paper picks match this filter.", es: "No hay pronósticos simulados con este filtro." })}</Text>}

      {visibleBets.map((bet) => {
        const modelProbability = Number(bet.raw_pick?.modelProbability);
        const settlementSource = sourceLabel(bet.raw_pick?.settlementSource);
        return <Card key={bet.id}>
          <View style={styles.rowBetween}>
            <View style={[styles.badge, bet.status === "lost" && styles.dangerBadge, bet.status === "open" && styles.warningBadge]}><Text style={styles.badgeText}>{statusLabel(bet.status)}</Text></View>
            <Text style={styles.muted}>{new Date(bet.created_at).toLocaleDateString(locale)}</Text>
          </View>
          <Text style={styles.cardTitle}>{bet.match}</Text>
          <Text style={styles.value}>{bet.label} · {Number(bet.odds).toFixed(2)}</Text>
          <Text style={styles.muted}>{bet.league || bet.sport || tr({ fi: "Muu", en: "Other", es: "Otro" })}{bet.bookmaker ? ` · ${bet.bookmaker}` : ""}</Text>
          <Text style={styles.muted}>{tr({ fi: "Paperipanos", en: "Paper stake", es: "Importe simulado" })} {money(bet.stake)} · {tr({ fi: "tulos", en: "result", es: "resultado" })} {money(bet.profit)}{bet.clv !== null ? ` · CLV ${Number(bet.clv).toFixed(2)} %` : ""}</Text>
          {(bet.edge !== null || bet.confidence !== null) && <Text style={styles.muted}>Edge {percent(bet.edge)} · confidence {percent(bet.confidence)}</Text>}
          {Number.isFinite(modelProbability) && <Text style={styles.muted}>{tr({ fi: "Mallin todennäköisyys", en: "Model probability", es: "Probabilidad del modelo" })} {percent(modelProbability)}</Text>}
          {bet.result && <Text style={styles.muted}>{tr({ fi: "Lopputulos", en: "Final result", es: "Resultado final" })}: {bet.result}</Text>}
          {settlementSource && <Text style={styles.muted}>{tr({ fi: "Ratkaisulähde", en: "Settlement source", es: "Fuente de resolución" })}: {settlementSource}</Text>}
          {bet.status === "open" && <>
            <Field label={tr({ fi: "Päätöskerroin CLV-laskentaan (valinnainen)", en: "Closing odds for CLV (optional)", es: "Cuota de cierre para CLV (opcional)" })} value={closingOdds[bet.id] || ""} onChangeText={(value) => setClosingOdds((current) => ({ ...current, [bet.id]: value }))} placeholder="1.95" keyboardType="decimal-pad" />
            <View style={styles.actionRow}>
              <ActionButton label={tr({ fi: "Voitto", en: "Win", es: "Victoria" })} onPress={() => settle(bet.id, "won")} disabled={busyId !== null || settlingAll} compact />
              <ActionButton label={tr({ fi: "Tappio", en: "Loss", es: "Derrota" })} onPress={() => settle(bet.id, "lost")} disabled={busyId !== null || settlingAll} tone="danger" compact />
              <ActionButton label={tr({ fi: "Palautus", en: "Push", es: "Nulo" })} onPress={() => settle(bet.id, "push")} disabled={busyId !== null || settlingAll} tone="secondary" compact />
              <ActionButton label={tr({ fi: "Mitätön", en: "Void", es: "Anulado" })} onPress={() => settle(bet.id, "void")} disabled={busyId !== null || settlingAll} tone="secondary" compact />
            </View>
          </>}
          <ActionButton label={busyId === bet.id ? tr({ fi: "Odota…", en: "Wait…", es: "Espera…" }) : tr({ fi: "Poista", en: "Delete", es: "Eliminar" })} onPress={() => remove(bet.id)} disabled={busyId !== null || settlingAll} tone="secondary" compact />
        </Card>;
      })}
    </ScrollView>
  );
}
