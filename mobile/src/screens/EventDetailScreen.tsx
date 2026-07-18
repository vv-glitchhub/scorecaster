import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import type { Bankroll, Pick } from "../types";
import { ActionButton, Card, Field, percent, styles } from "../ui";

type DetailSelection = {
  id: string;
  selection: string;
  odds: number;
  bookmaker?: string;
  consensusProbability?: number | null;
  marketProbability?: number | null;
  fairOdds?: number | null;
  edge?: number;
  ev?: number;
  confidence?: number;
  trustScore?: number;
  decision: "PLAY" | "CAUTION" | "SKIP";
  decisionReason?: string;
  qualityGrade?: string | null;
  priceGuard?: { minimumPlayOdds?: number | null; buffer?: number | null };
};

type EventDetail = {
  eventId: string;
  sportKey: string;
  league?: string;
  match: string;
  homeTeam?: string;
  awayTeam?: string;
  commenceTime?: string | null;
  fixtureSource?: string;
  selectedSelection?: string;
  selections: DetailSelection[];
  sportsIntelligence?: {
    readiness?: { level?: string; score?: number; missing?: string[] };
    sourceCount?: number;
    conflicts?: string[];
    evidence?: Array<{ category?: string; subject?: string; status?: string; detail?: string; source?: string; freshness?: string }>;
  };
  formRestShadow?: {
    status?: string;
    marketProbability?: number | null;
    shadowProbability?: number | null;
    probabilityDelta?: number | null;
    home?: { sampleSize?: number; restDays?: number | null; gamesLast7Days?: number };
    away?: { sampleSize?: number; restDays?: number | null; gamesLast7Days?: number };
  };
};

type TimelinePoint = { id?: string; odds: number; decision?: string; bookmaker?: string; source?: string; capturedAt: string };
type MarketTimeline = {
  status?: string;
  points?: TimelinePoint[];
  summary?: { initialOdds?: number | null; currentOdds?: number | null; oddsChange?: number | null; decisionChanges?: number; movement?: string };
  interpretation?: string;
  limitation?: string;
};

type Props = { pick: Pick; onBack: () => void };

function eventId(pick: Pick) { return String(pick.gameId || pick.eventId || pick.id || ""); }
function decisionTone(decision?: string) {
  if (decision === "PLAY") return null;
  if (decision === "SKIP") return styles.dangerBadge;
  return styles.warningBadge;
}
function optional(value: unknown, digits = 2) {
  if (value === null || value === undefined || value === "") return "–";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "–";
}

export default function EventDetailScreen({ pick, onBack }: Props) {
  const { tr, locale } = useLanguage();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [selectedName, setSelectedName] = useState(String(pick.selection || pick.label || ""));
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [timeline, setTimeline] = useState<MarketTimeline | null>(null);
  const [timelineAvailable, setTimelineAvailable] = useState(true);
  const [stake, setStake] = useState("5.00");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const money = (value: unknown) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));

  async function readTimeline(currentDetail: EventDetail, selection: string) {
    const query = new URLSearchParams({ eventId: currentDetail.eventId, selection });
    try {
      const response = await apiRequest<{ available?: boolean; timeline?: MarketTimeline }>(`/api/cloud/market-timeline?${query}`);
      setTimelineAvailable(response.available !== false);
      setTimeline(response.timeline || null);
    } catch {
      setTimeline(null);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const id = eventId(pick);
      const sport = String(pick.sportKey || pick.league || "");
      const query = new URLSearchParams({ eventId: id, sport, selection: selectedName });
      const [eventResponse, bankResponse] = await Promise.all([
        apiRequest<{ detail: EventDetail }>(`/api/event-detail?${query}`, { authenticated: false, timeoutMs: 30000 }),
        apiRequest<{ data: Bankroll }>("/api/cloud/bankroll")
      ]);
      setDetail(eventResponse.detail);
      setBankroll(bankResponse.data);
      const preferred = selectedName || eventResponse.detail.selectedSelection || eventResponse.detail.selections[0]?.selection || "";
      setSelectedName(preferred);
      if (preferred) await readTimeline(eventResponse.detail, preferred);
    } catch (error) {
      setDetail(null);
      setTimeline(null);
      Alert.alert(tr({ fi: "Ottelua ei voitu avata", en: "Event could not be opened", es: "No se pudo abrir el evento" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [pick]);

  const selected = useMemo(() => detail?.selections.find((item) => item.selection === selectedName) || detail?.selections[0] || null, [detail, selectedName]);
  const maximumStake = bankroll ? bankroll.bankroll * bankroll.max_stake_percent / 100 : 0;

  async function chooseSelection(name: string) {
    setSelectedName(name);
    if (detail) await readTimeline(detail, name);
  }

  async function captureTimeline() {
    if (!detail || !selected) return;
    setBusy("timeline");
    try {
      const response = await apiRequest<{ available?: boolean; captured?: number; duplicateSuppressed?: boolean; timeline?: MarketTimeline }>("/api/cloud/market-timeline", {
        method: "POST",
        body: { eventId: detail.eventId, selection: selected.selection, sport: detail.sportKey }
      });
      setTimelineAvailable(response.available !== false);
      setTimeline(response.timeline || null);
      Alert.alert(
        tr({ fi: "Hintahistoria päivitetty", en: "Price history updated", es: "Historial actualizado" }),
        response.duplicateSuppressed
          ? tr({ fi: "Nykyinen hinta vastasi viimeisintä pistettä, joten kaksoiskappaletta ei tallennettu.", en: "The current price matched the latest point, so a duplicate was not stored.", es: "La cuota coincidía con el último punto, por lo que no se guardó un duplicado." })
          : tr({ fi: `${response.captured || 0} varmennettua pistettä tallennettiin.`, en: `${response.captured || 0} verified point(s) were stored.`, es: `Se guardaron ${response.captured || 0} puntos verificados.` })
      );
    } catch (error) {
      Alert.alert(tr({ fi: "Hintapistettä ei voitu tallentaa", en: "Price point could not be stored", es: "No se pudo guardar el punto" }), error instanceof Error ? error.message : tr({ fi: "Lisää kohde ensin seurantaan.", en: "Add the selection to the watchlist first.", es: "Añade primero la selección a la lista." }));
    } finally { setBusy(null); }
  }

  async function watch() {
    if (!detail || !selected) return;
    setBusy("watch");
    try {
      await apiRequest("/api/cloud/watchlist", { method: "POST", body: { eventId: detail.eventId, selection: selected.selection, sport: detail.sportKey } });
      Alert.alert(tr({ fi: "Lisätty seurantaan", en: "Added to watchlist", es: "Añadido a la lista" }), tr({ fi: "Hintaa, päätöstä ja alkamisaikaa seurataan. Panosta ei luotu.", en: "Price, decision and kickoff are tracked. No stake was created.", es: "Se siguen cuota, decisión e inicio. No se creó ningún importe." }));
      await readTimeline(detail, selected.selection);
    } catch (error) {
      Alert.alert(tr({ fi: "Seuranta epäonnistui", en: "Watchlist save failed", es: "Falló el seguimiento" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setBusy(null); }
  }

  async function savePaper() {
    if (!detail || !selected) return;
    const paperStake = Number(stake.replace(",", "."));
    if (!Number.isFinite(paperStake) || paperStake <= 0 || paperStake > maximumStake + 0.001) {
      Alert.alert(tr({ fi: "Tarkista paperipanos", en: "Check paper stake", es: "Revisa el importe" }), tr({ fi: `Enimmäispanos on ${money(maximumStake)}.`, en: `Maximum stake is ${money(maximumStake)}.`, es: `El importe máximo es ${money(maximumStake)}.` }));
      return;
    }
    setBusy("paper");
    try {
      await apiRequest("/api/cloud/bets", { method: "POST", body: { bets: [{
        id: `${detail.eventId}-${selected.selection}`,
        eventId: detail.eventId,
        match: detail.match,
        homeTeam: detail.homeTeam,
        awayTeam: detail.awayTeam,
        selection: selected.selection,
        odds: selected.odds,
        stake: paperStake,
        edge: selected.edge,
        ev: selected.ev,
        confidence: selected.confidence,
        league: detail.league,
        sport: detail.sportKey,
        bookmaker: selected.bookmaker,
        decision: selected.decision,
        qualityGrade: selected.qualityGrade,
        qualityScore: selected.trustScore,
        modelProbability: selected.consensusProbability,
        impliedProbability: selected.marketProbability,
        source: "scorecaster-mobile-event-detail-v1"
      }] } });
      Alert.alert(tr({ fi: "Tallennettu paperiseurantaan", en: "Saved to paper tracking", es: "Guardado en seguimiento simulado" }), tr({ fi: `${selected.selection} · ${money(paperStake)}. Oikeaa vetoa ei asetettu.`, en: `${selected.selection} · ${money(paperStake)}. No real bet was placed.`, es: `${selected.selection} · ${money(paperStake)}. No se realizó ninguna apuesta real.` }));
    } catch (error) {
      Alert.alert(tr({ fi: "Tallennus epäonnistui", en: "Save failed", es: "No se pudo guardar" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setBusy(null); }
  }

  const summary = timeline?.summary || {};
  const timelinePoints = timeline?.points || [];

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.rowBetween}><ActionButton label={`← ${tr({ fi: "Takaisin", en: "Back", es: "Volver" })}`} onPress={onBack} tone="secondary" compact /><ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={load} tone="secondary" compact disabled={loading} /></View>
      {loading && <ActivityIndicator color="#34d399" size="large" />}
      {!loading && detail && <>
        <Card><Text style={styles.title}>{detail.match}</Text><Text style={styles.subtitle}>{detail.commenceTime ? new Date(detail.commenceTime).toLocaleString(locale) : tr({ fi: "Alkamisaika puuttuu", en: "Kickoff unavailable", es: "Hora no disponible" })}</Text><Text style={styles.muted}>{detail.league} · {detail.fixtureSource}</Text><Text style={styles.muted}>{tr({ fi: "Palvelin varmisti ottelun nykyisestä live-analyysistä. Ei oikean rahan vetoa.", en: "The server verified the event from current live analysis. No real-money bet.", es: "El servidor verificó el evento desde el análisis actual. Sin apuesta real." })}</Text></Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Valitse kohde", en: "Choose selection", es: "Elegir selección" })}</Text>{detail.selections.map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: selected?.selection === item.selection }} key={item.id} onPress={() => void chooseSelection(item.selection)} style={[styles.filterChip, selected?.selection === item.selection && styles.filterChipActive]}><View style={styles.rowBetween}><View><Text style={[styles.filterText, selected?.selection === item.selection && styles.filterTextActive]}>{item.selection} · {optional(item.odds)}</Text><Text style={styles.muted}>{item.bookmaker || tr({ fi: "Paras hinta", en: "Best price", es: "Mejor cuota" })}</Text></View><View style={[styles.badge, decisionTone(item.decision)]}><Text style={styles.badgeText}>{item.decision}</Text></View></View></Pressable>)}</Card>

        {selected && <Card><Text style={styles.cardTitle}>{selected.selection}</Text><Text style={styles.metric}>{optional(selected.odds)}</Text><Text style={styles.muted}>{tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} {percent(selected.consensusProbability)} · edge {percent(selected.edge)} · EV {percent(selected.ev)}</Text><Text style={styles.muted}>{tr({ fi: "Reilu kerroin", en: "Fair odds", es: "Cuota justa" })} {optional(selected.fairOdds)} · PLAY {optional(selected.priceGuard?.minimumPlayOdds)} · {tr({ fi: "puskuri", en: "buffer", es: "margen" })} {optional(selected.priceGuard?.buffer)}</Text><Text style={styles.muted}>{selected.decisionReason || tr({ fi: "Päätös perustuu markkinakonsensukseen ja turvaportteihin.", en: "The decision is based on market consensus and safety gates.", es: "La decisión se basa en consenso y filtros de seguridad." })}</Text></Card>}

        <Card><Text style={styles.cardTitle}>Sports Intelligence</Text><Text style={styles.value}>{detail.sportsIntelligence?.readiness?.level || "market-only"} · {detail.sportsIntelligence?.sourceCount || 0} {tr({ fi: "lähdettä", en: "sources", es: "fuentes" })} · {detail.sportsIntelligence?.conflicts?.length || 0} {tr({ fi: "ristiriitaa", en: "conflicts", es: "conflictos" })}</Text>{(detail.sportsIntelligence?.evidence || []).slice(0, 6).map((item, index) => <View key={`${item.category}-${item.subject}-${index}`}><Text style={styles.value}>{item.subject || item.category} · {item.status}</Text><Text style={styles.muted}>{item.detail}</Text><Text style={styles.muted}>{item.source} · {item.freshness}</Text></View>)}{(detail.sportsIntelligence?.readiness?.missing || []).map((item) => <Text key={item} style={styles.muted}>• {item}</Text>)}</Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Vire ja lepo · varjomalli", en: "Form and rest · shadow model", es: "Forma y descanso · modelo sombra" })}</Text><Text style={styles.value}>{detail.formRestShadow?.status || "unavailable"}</Text><Text style={styles.muted}>{tr({ fi: "Markkina", en: "Market", es: "Mercado" })} {percent(detail.formRestShadow?.marketProbability)} · shadow {percent(detail.formRestShadow?.shadowProbability)} · Δ {percent(detail.formRestShadow?.probabilityDelta)}</Text><Text style={styles.muted}>{detail.homeTeam}: {detail.formRestShadow?.home?.sampleSize || 0} · {optional(detail.formRestShadow?.home?.restDays, 1)} d · 7d {detail.formRestShadow?.home?.gamesLast7Days || 0}</Text><Text style={styles.muted}>{detail.awayTeam}: {detail.formRestShadow?.away?.sampleSize || 0} · {optional(detail.formRestShadow?.away?.restDays, 1)} d · 7d {detail.formRestShadow?.away?.gamesLast7Days || 0}</Text><Text style={styles.muted}>{tr({ fi: "Varjomalli ei muuta päätöstä, edgeä, EV:tä tai panosta.", en: "The shadow model does not change decision, edge, EV or stake.", es: "El modelo sombra no cambia decisión, ventaja, EV ni importe." })}</Text></Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Varmennettu hintahistoria", en: "Verified price history", es: "Historial verificado" })}</Text><Text style={styles.value}>{timeline?.status || tr({ fi: "ei vielä pisteitä", en: "no points yet", es: "sin puntos" })}</Text><Text style={styles.muted}>{tr({ fi: "Avaus", en: "Initial", es: "Inicial" })} {optional(summary.initialOdds)} → {tr({ fi: "nykyinen", en: "current", es: "actual" })} {optional(summary.currentOdds)} · {tr({ fi: "muutos", en: "change", es: "cambio" })} {percent(summary.oddsChange)} · {tr({ fi: "päätösmuutoksia", en: "decision changes", es: "cambios de decisión" })} {summary.decisionChanges || 0}</Text>{timeline?.interpretation && <Text style={styles.muted}>{timeline.interpretation}</Text>}{timelinePoints.slice().reverse().slice(0, 6).map((point) => <Text key={point.id || `${point.capturedAt}-${point.odds}`} style={styles.muted}>{new Date(point.capturedAt).toLocaleString(locale)} · {optional(point.odds)} · {point.decision || "WATCH"} · {point.bookmaker || point.source}</Text>)}{!timelineAvailable && <Text style={styles.muted}>{tr({ fi: "Tietokantamigraatio ei ole vielä aktiivinen.", en: "The database migration is not active yet.", es: "La migración aún no está activa." })}</Text>}<ActionButton label={busy === "timeline" ? tr({ fi: "Varmennetaan…", en: "Verifying…", es: "Verificando…" }) : tr({ fi: "Tallenna nykyinen hintapiste", en: "Capture current price point", es: "Guardar punto actual" })} onPress={captureTimeline} tone="secondary" disabled={busy !== null || !selected || !timelineAvailable} /><Text style={styles.muted}>{tr({ fi: "Hintaliike on kuvailevaa historiaa, ei lopputulosennuste.", en: "Price movement is descriptive history, not an outcome prediction.", es: "El movimiento es historial descriptivo, no predicción." })}</Text></Card>

        <Card><Text style={styles.cardTitle}>{tr({ fi: "Paperitoiminnot", en: "Paper actions", es: "Acciones simuladas" })}</Text><Field label={tr({ fi: "Paperipanos (€)", en: "Paper stake (€)", es: "Importe simulado (€)" })} value={stake} onChangeText={setStake} keyboardType="decimal-pad" /><Text style={styles.muted}>{tr({ fi: "Enimmäispanos", en: "Maximum stake", es: "Importe máximo" })} {money(maximumStake)}</Text><ActionButton label={busy === "watch" ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Lisää seurantaan", en: "Add to watchlist", es: "Añadir a la lista" })} onPress={watch} tone="secondary" disabled={busy !== null || !selected} /><ActionButton label={busy === "paper" ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Tallenna paperiseurantaan", en: "Save to paper tracking", es: "Guardar en seguimiento simulado" })} onPress={savePaper} disabled={busy !== null || !selected || selected.decision === "SKIP"} /><Text style={styles.muted}>{tr({ fi: "Ei maksua, vedonvälittäjälinkkiä tai oikean rahan vetoa.", en: "No payment, bookmaker link or real-money bet.", es: "Sin pago, enlace de apuestas ni apuesta real." })}</Text></Card>
      </>}
    </ScrollView>
  );
}
