import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import type { Bankroll, Pick } from "../types";
import { ActionButton, Card, Field, percent, styles } from "../ui";

const FILTERS = [
  { key: "all", sports: null },
  { key: "nhl", sports: "icehockey_nhl" },
  { key: "nba", sports: "basketball_nba" },
  { key: "epl", sports: "soccer_epl" },
  { key: "laliga", sports: "soccer_spain_la_liga" },
  { key: "liiga", sports: "icehockey_finland_liiga" },
  { key: "shl", sports: "icehockey_sweden_hockey_league" }
] as const;

type Filter = (typeof FILTERS)[number];
type DecisionFilter = "all" | "PLAY" | "CAUTION";
type SortMode = "rank" | "edge" | "confidence" | "time";

function pickKey(pick: Pick, index: number) {
  return String(pick.id || pick.eventId || pick.gameId || `${pick.match || "pick"}-${pick.selection || pick.label || index}`);
}
function eventId(pick: Pick) { return String(pick.gameId || pick.eventId || pick.id || ""); }
function watchKey(pick: Pick) { return `${eventId(pick)}::${String(pick.selection || pick.label || "").toLowerCase()}`; }
function parsePaperStake(value: string) { const number = Number(value.replace(",", ".")); return Number.isFinite(number) ? number : null; }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function initialStake(pick: Pick, maximum: number) {
  const decision = pick.productDecision || pick.decision || "CAUTION";
  if (decision === "SKIP") return 0;
  const confidence = clamp(Number(pick.confidence || 0.35), 0.15, 0.9);
  return Number((maximum * (decision === "PLAY" ? 0.5 : 0.25) * confidence).toFixed(2));
}
function rankValue(pick: Pick) {
  const decision = pick.productDecision || pick.decision;
  const decisionScore = decision === "PLAY" ? 2 : decision === "CAUTION" ? 1 : 0;
  return decisionScore + Number(pick.trustScore || 0) / 100 + Number(pick.edge || 0) * 4 + Number(pick.confidence || 0);
}
function personalLimitStatus(pick: Pick, bankroll: Bankroll | null) {
  const minEdge = Number(bankroll?.min_edge ?? 0.025);
  const minConfidence = Number(bankroll?.min_confidence ?? 0.58);
  const edgeOk = Number(pick.edge || 0) >= minEdge;
  const confidenceOk = Number(pick.confidence || 0) >= minConfidence;
  return { minEdge, minConfidence, edgeOk, confidenceOk, allowed: edgeOk && confidenceOk };
}

export default function PicksScreen() {
  const { tr, locale } = useLanguage();
  const [filter, setFilter] = useState<Filter>(FILTERS[0]);
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("rank");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [featuredKeys, setFeaturedKeys] = useState<Set<string>>(new Set());
  const [watchedKeys, setWatchedKeys] = useState<Set<string>>(new Set());
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [watchingId, setWatchingId] = useState<string | null>(null);
  const money = (value: unknown) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));
  const filterLabel = (item: Filter) => item.key === "all" ? tr({ fi: "Kaikki", en: "All", es: "Todos" }) : item.key === "laliga" ? "La Liga" : item.key.toUpperCase();
  const formatKickoff = (value?: string) => {
    if (!value) return tr({ fi: "Alkamisaika ei tiedossa", en: "Kickoff unknown", es: "Hora de inicio desconocida" });
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return tr({ fi: "Alkamisaika ei tiedossa", en: "Kickoff unknown", es: "Hora de inicio desconocida" });
    return date.toLocaleString(locale, { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const dataFreshness = (pick: Pick) => {
    const label = pick.freshnessLabel || pick.dataQuality?.freshness || "unknown";
    const hours = pick.dataAgeHours ?? pick.dataQuality?.ageHours;
    if (typeof hours === "number" && Number.isFinite(hours)) return `${label} · ${hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min` : `${hours.toFixed(1)} h`}`;
    return label;
  };

  const maximumStake = useMemo(() => bankroll ? Number(Math.max(0, bankroll.bankroll * bankroll.max_stake_percent / 100).toFixed(2)) : 10, [bankroll]);
  const visiblePicks = useMemo(() => {
    const filtered = picks.filter((pick) => decisionFilter === "all" || (pick.productDecision || pick.decision || "CAUTION") === decisionFilter);
    return filtered.slice().sort((a, b) => {
      if (sortMode === "edge") return Number(b.edge || 0) - Number(a.edge || 0);
      if (sortMode === "confidence") return Number(b.confidence || 0) - Number(a.confidence || 0);
      if (sortMode === "time") return (a.commenceTime ? Date.parse(a.commenceTime) : Number.MAX_SAFE_INTEGER) - (b.commenceTime ? Date.parse(b.commenceTime) : Number.MAX_SAFE_INTEGER);
      return rankValue(b) - rankValue(a);
    });
  }, [decisionFilter, picks, sortMode]);

  async function load(selected = filter) {
    setLoading(true);
    try {
      const query = selected.sports ? `?sports=${encodeURIComponent(selected.sports)}` : "";
      const [pickResponse, bankrollResponse] = await Promise.all([
        apiRequest<{ data?: Pick[]; featured?: Pick[]; generatedAt?: string }>(`/api/top-picks${query}`, { authenticated: false, timeoutMs: 30000 }),
        apiRequest<{ data: Bankroll }>("/api/cloud/bankroll")
      ]);
      const nextPicks = (pickResponse.data || []).slice(0, 20);
      const nextFeatured = new Set((pickResponse.featured || nextPicks.slice(0, 3)).map((pick, index) => pickKey(pick, index)));
      const nextMaximum = Math.max(0, bankrollResponse.data.bankroll * bankrollResponse.data.max_stake_percent / 100);
      setPicks(nextPicks);
      setFeaturedKeys(nextFeatured);
      setBankroll(bankrollResponse.data);
      setGeneratedAt(pickResponse.generatedAt || new Date().toISOString());
      setStakes((current) => {
        const next = { ...current };
        nextPicks.forEach((pick, index) => { const id = pickKey(pick, index); if (next[id] === undefined) next[id] = initialStake(pick, nextMaximum).toFixed(2); });
        return next;
      });
      try {
        const watch = await apiRequest<{ items?: Array<{ event_id?: string; selection?: string }> }>("/api/cloud/watchlist");
        setWatchedKeys(new Set((watch.items || []).map((item) => `${item.event_id || ""}::${String(item.selection || "").toLowerCase()}`)));
      } catch {
        setWatchedKeys(new Set());
      }
    } catch (error) {
      Alert.alert(tr({ fi: "Kohteita ei voitu ladata", en: "Picks could not be loaded", es: "No se pudieron cargar los pronósticos" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
      setPicks([]);
      setFeaturedKeys(new Set());
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(filter); }, [filter]);

  async function watchPick(pick: Pick) {
    const key = watchKey(pick);
    if (watchedKeys.has(key)) return;
    const id = eventId(pick);
    const selection = String(pick.selection || pick.label || "").trim();
    const sport = String(pick.sportKey || pick.league || "").trim();
    if (!id || !selection || !sport) {
      Alert.alert(tr({ fi: "Seuranta ei onnistu", en: "Cannot watch selection", es: "No se puede seguir" }), tr({ fi: "Varmennettu tapahtumatunnus, valinta tai laji puuttuu.", en: "A verified event ID, selection or sport is missing.", es: "Falta un evento, selección o deporte verificado." }));
      return;
    }
    setWatchingId(key);
    try {
      await apiRequest("/api/cloud/watchlist", { method: "POST", body: { eventId: id, selection, sport } });
      setWatchedKeys((current) => new Set([...current, key]));
      Alert.alert(tr({ fi: "Lisätty seurantaan", en: "Added to watchlist", es: "Añadido a la lista" }), tr({ fi: "Hintaa, päätöstä ja alkamisaikaa seurataan. Panosta ei luotu.", en: "Price, decision and kickoff are now tracked. No stake was created.", es: "Se siguen la cuota, la decisión y el inicio. No se creó ningún importe." }));
    } catch (error) {
      Alert.alert(tr({ fi: "Seurantaan lisääminen epäonnistui", en: "Adding to watchlist failed", es: "No se pudo añadir a la lista" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setWatchingId(null); }
  }

  async function savePick(pick: Pick, index: number) {
    const odds = Number(pick.odds || 0);
    const selection = String(pick.selection || pick.label || "").trim();
    const match = String(pick.match || [pick.homeTeam, pick.awayTeam].filter(Boolean).join(" – ")).trim();
    const id = pickKey(pick, index);
    const stake = parsePaperStake(stakes[id] || "0");
    const maximum = bankroll ? bankroll.bankroll * bankroll.max_stake_percent / 100 : maximumStake;
    const limits = personalLimitStatus(pick, bankroll);
    if (!match || !selection || odds <= 1) { Alert.alert(tr({ fi: "Kohde puutteellinen", en: "Incomplete pick", es: "Pronóstico incompleto" }), tr({ fi: "Kohteen tietoja ei voida tallentaa turvallisesti.", en: "The pick cannot be stored safely because data is missing.", es: "El pronóstico no se puede guardar de forma segura porque faltan datos." })); return; }
    if (!limits.allowed) { Alert.alert(tr({ fi: "Oma paperiraja estää tallennuksen", en: "Your paper limit blocks saving", es: "Tu límite simulado impide guardar" }), tr({ fi: `Vaadittu edge on ${percent(limits.minEdge)} ja confidence ${percent(limits.minConfidence)}.`, en: `Required edge is ${percent(limits.minEdge)} and confidence ${percent(limits.minConfidence)}.`, es: `La ventaja requerida es ${percent(limits.minEdge)} y la confianza ${percent(limits.minConfidence)}.` })); return; }
    if (stake === null || stake <= 0 || stake > maximum + 0.001) { Alert.alert(tr({ fi: "Tarkista paperipanos", en: "Check the paper stake", es: "Revisa el importe simulado" }), tr({ fi: `Anna panos väliltä 0,01–${money(maximum)}.`, en: `Enter a stake between 0.01 and ${money(maximum)}.`, es: `Introduce un importe entre 0,01 y ${money(maximum)}.` })); return; }
    setSavingId(id);
    try {
      await apiRequest("/api/cloud/bets", { method: "POST", body: { bets: [{ id, eventId: pick.gameId || pick.eventId, match, homeTeam: pick.homeTeam, awayTeam: pick.awayTeam, selection, odds, stake, edge: pick.edge, ev: pick.ev, confidence: pick.confidence, league: pick.league || pick.leagueTitle, sport: pick.sportKey, bookmaker: pick.bookmaker, decision: pick.productDecision || pick.decision, qualityGrade: pick.qualityGrade, qualityScore: pick.trustScore, modelProbability: pick.modelProbability || pick.consensusProbability, impliedProbability: pick.marketProbability, source: "scorecaster-mobile-consensus" }] } });
      Alert.alert(tr({ fi: "Tallennettu paperiseurantaan", en: "Saved to paper tracking", es: "Guardado en seguimiento simulado" }), tr({ fi: `${selection} · ${money(stake)}. Oikeaa vetoa ei asetettu.`, en: `${selection} · ${money(stake)}. No real bet was placed.`, es: `${selection} · ${money(stake)}. No se realizó ninguna apuesta real.` }));
    } catch (error) {
      Alert.alert(tr({ fi: "Tallennus epäonnistui", en: "Save failed", es: "No se pudo guardar" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setSavingId(null); }
  }

  const decisionItems: { key: DecisionFilter; label: string }[] = [{ key: "all", label: tr({ fi: "Kaikki päätökset", en: "All decisions", es: "Todas las decisiones" }) }, { key: "PLAY", label: "PLAY" }, { key: "CAUTION", label: "CAUTION" }];
  const sortItems: { key: SortMode; label: string }[] = [{ key: "rank", label: tr({ fi: "Paras ensin", en: "Best first", es: "Mejores primero" }) }, { key: "edge", label: "Edge" }, { key: "confidence", label: "Confidence" }, { key: "time", label: tr({ fi: "Alkamisaika", en: "Kickoff", es: "Hora de inicio" }) }];

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.title}>{tr({ fi: "Lähiajan kohteet", en: "Near-term picks", es: "Pronósticos próximos" })}</Text><Text style={styles.subtitle}>{tr({ fi: "Paras hinta verrataan marginaalista puhdistettuun markkinakonsensukseen.", en: "The best price is compared with no-vig market consensus.", es: "La mejor cuota se compara con el consenso de mercado sin margen." })}</Text></View><ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={() => load()} tone="secondary" compact disabled={loading} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{FILTERS.map((item) => { const active = item.key === filter.key; return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={item.key} onPress={() => setFilter(item)} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{filterLabel(item)}</Text></Pressable>; })}</ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{decisionItems.map((item) => { const active = item.key === decisionFilter; return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={item.key} onPress={() => setDecisionFilter(item.key)} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text></Pressable>; })}</ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{sortItems.map((item) => { const active = item.key === sortMode; return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={item.key} onPress={() => setSortMode(item.key)} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text></Pressable>; })}</ScrollView>
      <Card><Text style={styles.cardTitle}>{tr({ fi: "Omat paperirajat ja aineisto", en: "Your paper limits and data", es: "Tus límites simulados y datos" })}</Text><Text style={styles.value}>{tr({ fi: "Enimmäispanos", en: "Maximum stake", es: "Importe máximo" })} {money(maximumStake)}</Text><Text style={styles.muted}>{tr({ fi: "Minimiedge", en: "Minimum edge", es: "Ventaja mínima" })} {percent(bankroll?.min_edge ?? 0.025)} · confidence {percent(bankroll?.min_confidence ?? 0.58)}</Text><Text style={styles.muted}>{visiblePicks.length}/{picks.length} {tr({ fi: "kohdetta", en: "picks", es: "pronósticos" })}{generatedAt ? ` · ${new Date(generatedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}` : ""}</Text></Card>
      {loading && <ActivityIndicator color="#34d399" size="large" />}
      {!loading && visiblePicks.length === 0 && <Text style={styles.muted}>{tr({ fi: "Tällä suodattimella ei löytynyt riittävän laadukasta aineistoa.", en: "No sufficiently high-quality data matched this filter.", es: "No se encontraron datos de calidad suficiente con este filtro." })}</Text>}
      {visiblePicks.map((pick, index) => {
        const id = pickKey(pick, index);
        const watched = watchedKeys.has(watchKey(pick));
        const match = pick.match || [pick.homeTeam, pick.awayTeam].filter(Boolean).join(" – ") || tr({ fi: "Ottelu", en: "Match", es: "Partido" });
        const decision = pick.productDecision || pick.decision || "CAUTION";
        const featured = featuredKeys.has(id);
        const consensusProbability = Number(pick.consensusProbability || pick.modelProbability || 0);
        const marketProbability = Number(pick.marketProbability || (pick.odds ? 1 / pick.odds : 0));
        const notes = (pick.qualityNotes || []).slice(0, 2);
        const limits = personalLimitStatus(pick, bankroll);
        const canSave = decision !== "SKIP" && limits.allowed;
        return <Card key={`${id}-${index}`}><View style={styles.rowBetween}><View style={[styles.badge, (!canSave || decision === "SKIP") && styles.dangerBadge, canSave && decision === "CAUTION" && styles.warningBadge]}><Text style={styles.badgeText}>{featured ? "TOP · " : ""}{canSave ? decision : tr({ fi: "OMA RAJA", en: "YOUR LIMIT", es: "TU LÍMITE" })}</Text></View><Text style={styles.muted}>{pick.leagueTitle || pick.league || filterLabel(filter)}</Text></View><Text style={styles.cardTitle}>{match}</Text><Text style={styles.value}>{pick.selection || pick.label || tr({ fi: "Valinta", en: "Selection", es: "Selección" })} · {Number(pick.odds || 0).toFixed(2)}</Text><Text style={styles.muted}>{formatKickoff(pick.commenceTime)} · {pick.bookmaker || tr({ fi: "Paras saatavilla oleva hinta", en: "Best available price", es: "Mejor cuota disponible" })}</Text><View style={styles.divider} /><Text style={styles.muted}>{tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} {percent(consensusProbability)} · {tr({ fi: "markkina", en: "market", es: "mercado" })} {percent(marketProbability)} · edge {percent(pick.edge)} · EV {percent(pick.ev)}</Text><Text style={styles.muted}>{tr({ fi: "Reilu kerroin", en: "Fair odds", es: "Cuota justa" })} {pick.fairOdds ? Number(pick.fairOdds).toFixed(2) : "–"} · confidence {percent(pick.confidence)} · trust {Number(pick.trustScore || 0).toFixed(0)}/100</Text><Text style={styles.muted}>{Number(pick.bookmakerCount || pick.dataQuality?.bookmakerCount || 0)} {tr({ fi: "lähdettä", en: "sources", es: "fuentes" })} · {dataFreshness(pick)}</Text>{notes.map((note) => <Text key={note} style={styles.muted}>• {note}</Text>)}{!limits.allowed && <Text style={styles.muted}>{tr({ fi: `Kohde ei läpäise omaa rajaa: edge ${limits.edgeOk ? "OK" : "liian pieni"}, confidence ${limits.confidenceOk ? "OK" : "liian pieni"}.`, en: `The pick does not pass your limits: edge ${limits.edgeOk ? "OK" : "too low"}, confidence ${limits.confidenceOk ? "OK" : "too low"}.`, es: `El pronóstico no supera tus límites: ventaja ${limits.edgeOk ? "OK" : "demasiado baja"}, confianza ${limits.confidenceOk ? "OK" : "demasiado baja"}.` })}</Text>}<ActionButton label={watched ? tr({ fi: "Seurannassa", en: "Watched", es: "En seguimiento" }) : watchingId === watchKey(pick) ? tr({ fi: "Lisätään…", en: "Adding…", es: "Añadiendo…" }) : tr({ fi: "Seuraa hintaa ja päätöstä", en: "Watch price and decision", es: "Seguir cuota y decisión" })} onPress={() => watchPick(pick)} disabled={watched || watchingId !== null} tone="secondary" /><Field label={tr({ fi: "Paperipanos (€)", en: "Paper stake (€)", es: "Importe simulado (€)" })} value={stakes[id] || initialStake(pick, maximumStake).toFixed(2)} onChangeText={(value) => setStakes((current) => ({ ...current, [id]: value }))} keyboardType="decimal-pad" /><ActionButton label={savingId === id ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Lisää paperiseurantaan", en: "Add to paper tracking", es: "Añadir al seguimiento simulado" })} onPress={() => savePick(pick, index)} disabled={savingId !== null || !canSave} />{decision === "SKIP" && <Text style={styles.muted}>{tr({ fi: "SKIP tarkoittaa, että hinta tai aineiston laatu ei täytä Scorecasterin rajaa.", en: "SKIP means the price or data quality does not meet the Scorecaster gate.", es: "SKIP significa que la cuota o la calidad de los datos no supera el filtro de Scorecaster." })}</Text>}</Card>;
      })}
    </ScrollView>
  );
}
