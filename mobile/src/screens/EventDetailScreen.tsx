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
function initials(name?: string) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts.map((part) => part.charAt(0)).slice(-2).join("") : (parts[0] || "?").slice(0, 2)).toUpperCase();
}
function TinyMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <View style={{ flex: 1, minWidth: 76, borderWidth: 1, borderColor: "#273241", backgroundColor: "#151c28", borderRadius: 14, padding: 11 }}><Text style={styles.muted}>{label}</Text><Text style={[styles.value, accent && { color: "#bef264" }]}>{value}</Text></View>;
}

export default function EventDetailScreen({ pick, onBack }: Props) {
  const { tr, locale } = useLanguage();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [selectedName, setSelectedName] = useState(String(pick.selection || pick.label || ""));
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [timeline, setTimeline] = useState<MarketTimeline | null>(null);
  const [timelineAvailable, setTimelineAvailable] = useState(true);
  const [stake, setStake] = useState("5.00");
  const [showPaper, setShowPaper] = useState(false);
  const [showIntelligence, setShowIntelligence] = useState(false);
  const [showFormRest, setShowFormRest] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
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
    setShowPaper(false);
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
      setShowPaper(false);
    } catch (error) {
      Alert.alert(tr({ fi: "Tallennus epäonnistui", en: "Save failed", es: "No se pudo guardar" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setBusy(null); }
  }

  const summary = timeline?.summary || {};
  const timelinePoints = timeline?.points || [];
  const home = detail?.homeTeam || String(detail?.match || pick.match || "").split(/\s+[–—-]\s+/)[0] || "Home";
  const away = detail?.awayTeam || String(detail?.match || pick.match || "").split(/\s+[–—-]\s+/)[1] || "Away";

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.rowBetween}><ActionButton label={`← ${tr({ fi: "Takaisin", en: "Back", es: "Volver" })}`} onPress={onBack} tone="secondary" compact /><ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={load} tone="secondary" compact disabled={loading} /></View>
      {loading && <ActivityIndicator color="#bef264" size="large" />}
      {!loading && detail && <>
        <View style={styles.mobileHero}>
          <Text style={styles.kicker}>EVENT DETAIL V3 · VERIFIED</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
            <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: "#263b17", borderWidth: 1, borderColor: "#405b25", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#bef264", fontWeight: "900" }}>{initials(home)}</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.title}>{home} – {away}</Text><Text style={styles.subtitle}>{detail.commenceTime ? new Date(detail.commenceTime).toLocaleString(locale) : tr({ fi: "Alkamisaika puuttuu", en: "Kickoff unavailable", es: "Hora no disponible" })}</Text></View>
          </View>
          <Text style={styles.muted}>{detail.league} · {detail.fixtureSource}</Text>
          <Text style={styles.muted}>{tr({ fi: "Palvelin varmisti ottelun nykyisestä live-analyysistä. Ei oikean rahan vetoa.", en: "The server verified the event from current live analysis. No real-money bet.", es: "El servidor verificó el evento desde el análisis actual. Sin apuesta real." })}</Text>
        </View>

        <Card>
          <Text style={styles.kicker}>{tr({ fi: "VAIHE 1 · VALITSE HINTA", en: "STEP 1 · CHOOSE PRICE", es: "PASO 1 · ELIGE CUOTA" })}</Text>
          <Text style={styles.cardTitle}>{tr({ fi: "Markkinavalinnat", en: "Market selections", es: "Selecciones de mercado" })}</Text>
          {detail.selections.map((item) => {
            const active = selected?.selection === item.selection;
            return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={item.id} onPress={() => void chooseSelection(item.selection)} style={({ pressed }) => [{ borderWidth: 1, borderColor: active ? "#bef264" : "#273241", backgroundColor: active ? "#263b17" : "#151c28", borderRadius: 17, padding: 14, opacity: pressed ? 0.75 : 1 }]}><View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.selection}</Text><Text style={styles.metric}>{optional(item.odds)}</Text><Text style={styles.muted}>{item.bookmaker || tr({ fi: "Paras hinta", en: "Best price", es: "Mejor cuota" })}</Text></View><View style={[styles.badge, decisionTone(item.decision)]}><Text style={styles.badgeText}>{item.decision}</Text></View></View><View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}><TinyMetric label="Edge" value={percent(item.edge)} accent={Number(item.edge || 0) > 0} /><TinyMetric label="EV" value={percent(item.ev)} accent={Number(item.ev || 0) > 0} /></View></Pressable>;
          })}
        </Card>

        {selected && <Card>
          <View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.kicker}>{tr({ fi: "VAIHE 2 · PÄÄTÖS", en: "STEP 2 · DECISION", es: "PASO 2 · DECISIÓN" })}</Text><Text style={styles.cardTitle}>{selected.selection}</Text></View><View style={[styles.badge, decisionTone(selected.decision)]}><Text style={styles.badgeText}>{selected.decision}</Text></View></View>
          <Text style={styles.metric}>{optional(selected.odds)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><TinyMetric label={tr({ fi: "Reilu", en: "Fair", es: "Justa" })} value={optional(selected.fairOdds)} /><TinyMetric label="PLAY" value={optional(selected.priceGuard?.minimumPlayOdds)} accent /><TinyMetric label={tr({ fi: "Puskuri", en: "Buffer", es: "Margen" })} value={optional(selected.priceGuard?.buffer)} /></View>
          <Text style={styles.muted}>{tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} {percent(selected.consensusProbability)} · edge {percent(selected.edge)} · EV {percent(selected.ev)} · confidence {percent(selected.confidence)}</Text>
          <View style={{ borderWidth: 1, borderColor: "#273241", backgroundColor: "#151c28", borderRadius: 15, padding: 13 }}><Text style={styles.kicker}>{tr({ fi: "MIKSI TÄMÄ PÄÄTÖS?", en: "WHY THIS DECISION?", es: "¿POR QUÉ ESTA DECISIÓN?" })}</Text><Text style={styles.muted}>{selected.decisionReason || tr({ fi: "Päätös perustuu markkinakonsensukseen ja turvaportteihin.", en: "The decision is based on market consensus and safety gates.", es: "La decisión se basa en consenso y filtros de seguridad." })}</Text></View>
        </Card>}

        <Card>
          <Text style={styles.kicker}>{tr({ fi: "VAIHE 3 · TOIMINTO", en: "STEP 3 · ACTION", es: "PASO 3 · ACCIÓN" })}</Text>
          <Text style={styles.cardTitle}>{tr({ fi: "Seuraa tai tallenna paperille", en: "Watch or save to paper", es: "Sigue o guarda en simulación" })}</Text>
          <Text style={styles.muted}>{tr({ fi: "Seuranta ei luo panosta. Paperitallennus on vain simuloitu valinta.", en: "Watchlist creates no stake. Paper saving is only a simulated selection.", es: "El seguimiento no crea importe. El guardado es solo una selección simulada." })}</Text>
          <ActionButton label={busy === "watch" ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Seuraa hintaa ja päätöstä", en: "Watch price and decision", es: "Seguir cuota y decisión" })} onPress={watch} tone="secondary" disabled={busy !== null || !selected} />
          <ActionButton label={showPaper ? tr({ fi: "Sulje paperitoiminnot", en: "Close paper actions", es: "Cerrar acciones" }) : tr({ fi: "Avaa paperitoiminnot", en: "Open paper actions", es: "Abrir acciones simuladas" })} onPress={() => setShowPaper((value) => !value)} tone="secondary" disabled={!selected} />
          {showPaper && <View style={{ borderTopWidth: 1, borderTopColor: "#273241", paddingTop: 12, gap: 10 }}><Field label={tr({ fi: "Paperipanos (€)", en: "Paper stake (€)", es: "Importe simulado (€)" })} value={stake} onChangeText={setStake} keyboardType="decimal-pad" /><Text style={styles.muted}>{tr({ fi: "Enimmäispanos", en: "Maximum stake", es: "Importe máximo" })} {money(maximumStake)}</Text><ActionButton label={busy === "paper" ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Tallenna paperiseurantaan", en: "Save to paper tracking", es: "Guardar en seguimiento simulado" })} onPress={savePaper} disabled={busy !== null || !selected || selected.decision === "SKIP"} />{selected?.decision === "SKIP" && <Text style={styles.muted}>{tr({ fi: "SKIP-valintaa ei voi tallentaa paperiseurantaan.", en: "A SKIP selection cannot be saved to paper tracking.", es: "Una selección SKIP no puede guardarse." })}</Text>}</View>}
          <Text style={styles.muted}>{tr({ fi: "Ei maksua, vedonvälittäjälinkkiä tai oikean rahan vetoa.", en: "No payment, bookmaker link or real-money bet.", es: "Sin pago, enlace de apuestas ni apuesta real." })}</Text>
        </Card>

        <Card>
          <Text style={styles.kicker}>AUDIT</Text>
          <Text style={styles.cardTitle}>{tr({ fi: "Avaa lisätiedot tarvittaessa", en: "Open supporting detail when needed", es: "Abre los detalles cuando hagan falta" })}</Text>
          <ActionButton label={showIntelligence ? tr({ fi: "Sulje Sports Intelligence", en: "Close Sports Intelligence", es: "Cerrar Sports Intelligence" }) : tr({ fi: "Sports Intelligence", en: "Sports Intelligence", es: "Sports Intelligence" })} onPress={() => setShowIntelligence((value) => !value)} tone="secondary" />
          {showIntelligence && <View style={{ gap: 10 }}><Text style={styles.value}>{detail.sportsIntelligence?.readiness?.level || "market-only"} · {detail.sportsIntelligence?.sourceCount || 0} {tr({ fi: "lähdettä", en: "sources", es: "fuentes" })} · {detail.sportsIntelligence?.conflicts?.length || 0} {tr({ fi: "ristiriitaa", en: "conflicts", es: "conflictos" })}</Text>{(detail.sportsIntelligence?.evidence || []).slice(0, 6).map((item, index) => <View key={`${item.category}-${item.subject}-${index}`} style={{ borderWidth: 1, borderColor: "#273241", borderRadius: 14, padding: 12 }}><Text style={styles.value}>{item.subject || item.category} · {item.status}</Text><Text style={styles.muted}>{item.detail}</Text><Text style={styles.muted}>{item.source} · {item.freshness}</Text></View>)}{(detail.sportsIntelligence?.readiness?.missing || []).map((item) => <Text key={item} style={styles.muted}>• {item}</Text>)}</View>}

          <ActionButton label={showFormRest ? tr({ fi: "Sulje vire ja lepo", en: "Close form and rest", es: "Cerrar forma y descanso" }) : tr({ fi: "Vire ja lepo · varjomalli", en: "Form and rest · shadow model", es: "Forma y descanso · modelo sombra" })} onPress={() => setShowFormRest((value) => !value)} tone="secondary" />
          {showFormRest && <View style={{ gap: 8 }}><Text style={styles.value}>{detail.formRestShadow?.status || "unavailable"}</Text><Text style={styles.muted}>{tr({ fi: "Markkina", en: "Market", es: "Mercado" })} {percent(detail.formRestShadow?.marketProbability)} · shadow {percent(detail.formRestShadow?.shadowProbability)} · Δ {percent(detail.formRestShadow?.probabilityDelta)}</Text><Text style={styles.muted}>{detail.homeTeam}: {detail.formRestShadow?.home?.sampleSize || 0} · {optional(detail.formRestShadow?.home?.restDays, 1)} d · 7d {detail.formRestShadow?.home?.gamesLast7Days || 0}</Text><Text style={styles.muted}>{detail.awayTeam}: {detail.formRestShadow?.away?.sampleSize || 0} · {optional(detail.formRestShadow?.away?.restDays, 1)} d · 7d {detail.formRestShadow?.away?.gamesLast7Days || 0}</Text><Text style={styles.muted}>{tr({ fi: "Varjomalli ei muuta päätöstä, edgeä, EV:tä tai panosta.", en: "The shadow model does not change decision, edge, EV or stake.", es: "El modelo sombra no cambia decisión, ventaja, EV ni importe." })}</Text></View>}

          <ActionButton label={showTimeline ? tr({ fi: "Sulje hintahistoria", en: "Close price history", es: "Cerrar historial" }) : tr({ fi: "Varmennettu hintahistoria", en: "Verified price history", es: "Historial verificado" })} onPress={() => setShowTimeline((value) => !value)} tone="secondary" />
          {showTimeline && <View style={{ gap: 8 }}><Text style={styles.value}>{timeline?.status || tr({ fi: "ei vielä pisteitä", en: "no points yet", es: "sin puntos" })}</Text><Text style={styles.muted}>{tr({ fi: "Avaus", en: "Initial", es: "Inicial" })} {optional(summary.initialOdds)} → {tr({ fi: "nykyinen", en: "current", es: "actual" })} {optional(summary.currentOdds)} · {tr({ fi: "muutos", en: "change", es: "cambio" })} {percent(summary.oddsChange)} · {tr({ fi: "päätösmuutoksia", en: "decision changes", es: "cambios de decisión" })} {summary.decisionChanges || 0}</Text>{timeline?.interpretation && <Text style={styles.muted}>{timeline.interpretation}</Text>}{timelinePoints.slice().reverse().slice(0, 6).map((point) => <Text key={point.id || `${point.capturedAt}-${point.odds}`} style={styles.muted}>{new Date(point.capturedAt).toLocaleString(locale)} · {optional(point.odds)} · {point.decision || "WATCH"} · {point.bookmaker || point.source}</Text>)}{!timelineAvailable && <Text style={styles.muted}>{tr({ fi: "Tietokantamigraatio ei ole vielä aktiivinen.", en: "The database migration is not active yet.", es: "La migración aún no está activa." })}</Text>}<ActionButton label={busy === "timeline" ? tr({ fi: "Varmennetaan…", en: "Verifying…", es: "Verificando…" }) : tr({ fi: "Tallenna nykyinen hintapiste", en: "Capture current price point", es: "Guardar punto actual" })} onPress={captureTimeline} tone="secondary" disabled={busy !== null || !selected || !timelineAvailable} /><Text style={styles.muted}>{tr({ fi: "Hintaliike on kuvailevaa historiaa, ei lopputulosennuste.", en: "Price movement is descriptive history, not an outcome prediction.", es: "El movimiento es historial descriptivo, no predicción." })}</Text></View>}
        </Card>
      </>}
    </ScrollView>
  );
}
