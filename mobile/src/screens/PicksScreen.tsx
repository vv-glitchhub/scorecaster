import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import type { Bankroll, Pick } from "../types";
import { ActionButton, Card, Field, percent, styles } from "../ui";

const LEAGUE_TITLES: Record<string, string> = {
  icehockey_nhl: "NHL",
  icehockey_finland_liiga: "Liiga",
  icehockey_sweden_hockey_league: "SHL",
  basketball_nba: "NBA",
  basketball_wnba: "WNBA",
  baseball_mlb: "MLB",
  soccer_epl: "Premier League",
  soccer_spain_la_liga: "La Liga",
  soccer_usa_mls: "MLS",
  soccer_finland_veikkausliiga: "Veikkausliiga",
  soccer_sweden_allsvenskan: "Allsvenskan",
  soccer_norway_eliteserien: "Eliteserien"
};
const CORE_SEASON_LEAGUES = ["icehockey_nhl", "icehockey_finland_liiga", "icehockey_sweden_hockey_league", "basketball_nba", "soccer_epl", "soccer_spain_la_liga"];
const SUMMER_LEAGUES = ["baseball_mlb", "basketball_wnba", "soccer_usa_mls", "soccer_finland_veikkausliiga", "soccer_sweden_allsvenskan", "soccer_norway_eliteserien"];

type Filter = { key: string; sports: string | null };
type DecisionFilter = "all" | "PLAY" | "CAUTION" | "SKIP";
type SortMode = "rank" | "edge" | "confidence" | "time";
type Props = { onOpenEvent?: (pick: Pick) => void };
const ALL_FILTER: Filter = { key: "all", sports: null };

function pickKey(pick: Pick, index: number) { return String(pick.id || pick.eventId || pick.gameId || `${pick.match || "pick"}-${pick.selection || pick.label || index}`); }
function eventId(pick: Pick) { return String(pick.gameId || pick.eventId || pick.id || ""); }
function watchKey(pick: Pick) { return `${eventId(pick)}::${String(pick.selection || pick.label || "").toLowerCase()}`; }
function seasonFilters(leagues?: string[]) {
  const month = new Date().getUTCMonth();
  const keys = leagues?.length ? leagues : month >= 4 && month <= 7 ? SUMMER_LEAGUES : CORE_SEASON_LEAGUES;
  return [ALL_FILTER, ...keys.map((sports) => ({ key: sports, sports }))];
}
function parsePaperStake(value: string) { const number = Number(value.replace(",", ".")); return Number.isFinite(number) ? number : null; }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function initials(name?: string) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts.map((part) => part.charAt(0)).slice(-2).join("") : (parts[0] || "?").slice(0, 2)).toUpperCase();
}
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
function decisionStyle(decision: string, allowed: boolean) {
  if (!allowed || decision === "SKIP") return styles.dangerBadge;
  if (decision === "CAUTION") return styles.warningBadge;
  return null;
}
function TinyMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <View style={{ flex: 1, minWidth: 82, borderWidth: 1, borderColor: "#273241", backgroundColor: "#151c28", borderRadius: 14, padding: 11 }}><Text style={styles.muted}>{label}</Text><Text style={[styles.value, accent && { color: "#bef264" }]}>{value}</Text></View>;
}

export default function PicksScreen({ onOpenEvent }: Props) {
  const { tr, locale } = useLanguage();
  const [filters, setFilters] = useState<Filter[]>(() => seasonFilters());
  const [filter, setFilter] = useState<Filter>(ALL_FILTER);
  const [search, setSearch] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("rank");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [featuredKeys, setFeaturedKeys] = useState<Set<string>>(new Set());
  const [watchedKeys, setWatchedKeys] = useState<Set<string>>(new Set());
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [watchingId, setWatchingId] = useState<string | null>(null);
  const money = (value: unknown) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));
  const filterLabel = (item: Filter) => item.key === "all" ? tr({ fi: "Kauden sarjat", en: "Season leagues", es: "Ligas actuales" }) : LEAGUE_TITLES[item.key] || item.key;
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
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const filtered = picks.filter((pick) => {
      if (decisionFilter !== "all" && (pick.productDecision || pick.decision || "CAUTION") !== decisionFilter) return false;
      if (!normalizedSearch) return true;
      return [pick.match, pick.homeTeam, pick.awayTeam, pick.selection, pick.label, pick.league, pick.leagueTitle]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedSearch);
    });
    return filtered.slice().sort((a, b) => {
      if (sortMode === "edge") return Number(b.edge || 0) - Number(a.edge || 0);
      if (sortMode === "confidence") return Number(b.confidence || 0) - Number(a.confidence || 0);
      if (sortMode === "time") return (a.commenceTime ? Date.parse(a.commenceTime) : Number.MAX_SAFE_INTEGER) - (b.commenceTime ? Date.parse(b.commenceTime) : Number.MAX_SAFE_INTEGER);
      return rankValue(b) - rankValue(a);
    });
  }, [decisionFilter, picks, search, sortMode]);

  async function load(selected = filter) {
    setLoading(true);
    try {
      const query = selected.sports ? `?sports=${encodeURIComponent(selected.sports)}` : "";
      const [pickResponse, bankrollResponse] = await Promise.all([
        apiRequest<{ data?: Pick[]; featured?: Pick[]; generatedAt?: string; leagues?: string[] }>(`/api/top-picks${query}`, { authenticated: false, timeoutMs: 30000 }),
        apiRequest<{ data: Bankroll }>("/api/cloud/bankroll")
      ]);
      const nextPicks = (pickResponse.data || []).slice(0, 20);
      const nextFeatured = new Set((pickResponse.featured || nextPicks.slice(0, 3)).map((pick, index) => pickKey(pick, index)));
      const nextMaximum = Math.max(0, bankrollResponse.data.bankroll * bankrollResponse.data.max_stake_percent / 100);
      setPicks(nextPicks);
      setFeaturedKeys(nextFeatured);
      setBankroll(bankrollResponse.data);
      setGeneratedAt(pickResponse.generatedAt || new Date().toISOString());
      if (!selected.sports && pickResponse.leagues?.length) setFilters(seasonFilters(pickResponse.leagues));
      setStakes((current) => {
        const next = { ...current };
        nextPicks.forEach((pick, index) => { const id = pickKey(pick, index); if (next[id] === undefined) next[id] = initialStake(pick, nextMaximum).toFixed(2); });
        return next;
      });
      try {
        const watch = await apiRequest<{ items?: Array<{ event_id?: string; selection?: string }> }>("/api/cloud/watchlist");
        setWatchedKeys(new Set((watch.items || []).map((item) => `${item.event_id || ""}::${String(item.selection || "").toLowerCase()}`)));
      } catch { setWatchedKeys(new Set()); }
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
      await apiRequest("/api/cloud/bets/audited", { method: "POST", body: { bets: [{ id, eventId: pick.gameId || pick.eventId, match, homeTeam: pick.homeTeam, awayTeam: pick.awayTeam, selection, odds, stake, edge: pick.edge, ev: pick.ev, confidence: pick.confidence, league: pick.league || pick.leagueTitle, sport: pick.sportKey, bookmaker: pick.bookmaker, decision: pick.productDecision || pick.decision, qualityGrade: pick.qualityGrade, qualityScore: pick.trustScore, modelProbability: null, impliedProbability: pick.consensusProbability ?? pick.marketProbability, source: "scorecaster-mobile-picks-v4" }] } });
      Alert.alert(tr({ fi: "Tallennettu paperiseurantaan", en: "Saved to paper tracking", es: "Guardado en seguimiento simulado" }), tr({ fi: `${selection} · ${money(stake)}. Oikeaa vetoa ei asetettu.`, en: `${selection} · ${money(stake)}. No real bet was placed.`, es: `${selection} · ${money(stake)}. No se realizó ninguna apuesta real.` }));
      setExpandedId(null);
    } catch (error) {
      Alert.alert(tr({ fi: "Tallennus epäonnistui", en: "Save failed", es: "No se pudo guardar" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setSavingId(null); }
  }

  const decisionItems: { key: DecisionFilter; label: string }[] = [{ key: "all", label: tr({ fi: "Kaikki päätökset", en: "All decisions", es: "Todas las decisiones" }) }, { key: "PLAY", label: "PLAY" }, { key: "CAUTION", label: "CAUTION" }, { key: "SKIP", label: "SKIP" }];
  const sortItems: { key: SortMode; label: string }[] = [{ key: "rank", label: tr({ fi: "Paras ensin", en: "Best first", es: "Mejores primero" }) }, { key: "edge", label: "Edge" }, { key: "confidence", label: tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" }) }, { key: "time", label: tr({ fi: "Alkamisaika", en: "Kickoff", es: "Inicio" }) }];

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.mobileHero}>
        <Text style={styles.kicker}>GAME CENTER V1 · PICKS V4</Text>
        <Text style={styles.title}>{tr({ fi: "Lähiajan varmennetut pelit", en: "Verified near-term games", es: "Partidos próximos verificados" })}</Text>
        <Text style={styles.subtitle}>{tr({ fi: "Kauden sarjat vaihtuvat automaattisesti. Hae joukkuetta, rajaa päätös ja avaa kaikki tiedot; jokainen paperitallennus varmennetaan vielä palvelimella.", en: "Season leagues update automatically. Search a team, filter the decision and open full detail; every paper save is re-verified by the server.", es: "Las ligas cambian automáticamente. Busca un equipo y abre el detalle; cada guardado se verifica de nuevo en el servidor." })}</Text>
        <ActionButton label={tr({ fi: "Päivitä kohteet", en: "Refresh picks", es: "Actualizar pronósticos" })} onPress={() => load()} tone="secondary" compact disabled={loading} />
      </View>

      <Card><Field label={tr({ fi: "Hae peliä, joukkuetta tai valintaa", en: "Search game, team or selection", es: "Buscar partido, equipo o selección" })} value={search} onChangeText={setSearch} placeholder={tr({ fi: "esim. Ilves tai Aces", en: "e.g. Ilves or Aces", es: "p. ej. Ilves o Aces" })} autoCapitalize="words" /><Text style={styles.muted}>{visiblePicks.length}/{picks.length} {tr({ fi: "kohdetta näkyvissä", en: "picks visible", es: "pronósticos visibles" })}</Text></Card>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{filters.map((item) => { const active = item.key === filter.key; return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={item.key} onPress={() => setFilter(item)} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{filterLabel(item)}</Text></Pressable>; })}</ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{decisionItems.map((item) => { const active = item.key === decisionFilter; return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={item.key} onPress={() => setDecisionFilter(item.key)} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text></Pressable>; })}</ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{sortItems.map((item) => { const active = item.key === sortMode; return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={item.key} onPress={() => setSortMode(item.key)} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text></Pressable>; })}</ScrollView>

      <Card><Text style={styles.cardTitle}>{tr({ fi: "Omat paperirajat", en: "Your paper limits", es: "Tus límites simulados" })}</Text><Text style={styles.value}>{tr({ fi: "Enimmäispanos", en: "Maximum stake", es: "Importe máximo" })} {money(maximumStake)}</Text><Text style={styles.muted}>{tr({ fi: "Minimiedge", en: "Minimum edge", es: "Ventaja mínima" })} {percent(bankroll?.min_edge ?? 0.025)} · confidence {percent(bankroll?.min_confidence ?? 0.58)}</Text><Text style={styles.muted}>{visiblePicks.length}/{picks.length} {tr({ fi: "kohdetta", en: "picks", es: "pronósticos" })}{generatedAt ? ` · ${new Date(generatedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}` : ""}</Text></Card>
      {loading && <ActivityIndicator color="#bef264" size="large" />}
      {!loading && visiblePicks.length === 0 && <Card><Text style={styles.cardTitle}>{tr({ fi: "Ei sopivia kohteita", en: "No matching picks", es: "No hay pronósticos" })}</Text><Text style={styles.muted}>{tr({ fi: "Poista haku tai vaihda sarjaa ja päätösrajausta. Tyhjää näkymää ei täytetä esimerkkidatalla.", en: "Clear the search or change the league and decision filter. Empty views are never filled with example data.", es: "Limpia la búsqueda o cambia la liga y la decisión. La vista no se rellena con datos de ejemplo." })}</Text></Card>}

      {visiblePicks.map((pick, index) => {
        const id = pickKey(pick, index);
        const watched = watchedKeys.has(watchKey(pick));
        const decision = String(pick.productDecision || pick.decision || "CAUTION");
        const featured = featuredKeys.has(id);
        const limits = personalLimitStatus(pick, bankroll);
        const canSave = decision !== "SKIP" && limits.allowed;
        const expanded = expandedId === id;
        const home = pick.homeTeam || String(pick.match || "").split(/\s+[–—-]\s+/)[0] || "Home";
        const away = pick.awayTeam || String(pick.match || "").split(/\s+[–—-]\s+/)[1] || "Away";
        return (
          <Card key={`${id}-${index}`}>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: "#263b17", borderWidth: 1, borderColor: "#405b25", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#bef264", fontWeight: "900", fontSize: 12 }}>{initials(home)}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{home} – {away}</Text><Text style={styles.muted}>{pick.leagueTitle || pick.league || filterLabel(filter)} · {formatKickoff(pick.commenceTime)}</Text></View>
              </View>
              <View style={[styles.badge, decisionStyle(decision, canSave)]}><Text style={styles.badgeText}>{featured ? "TOP · " : ""}{canSave ? decision : tr({ fi: "OMA RAJA", en: "YOUR LIMIT", es: "TU LÍMITE" })}</Text></View>
            </View>

            <View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.muted}>{pick.selection || pick.label || tr({ fi: "Valinta", en: "Selection", es: "Selección" })}</Text><Text style={styles.metric}>{Number(pick.odds || 0).toFixed(2)}</Text><Text style={styles.muted}>{pick.bookmaker || tr({ fi: "Paras saatavilla oleva hinta", en: "Best available price", es: "Mejor cuota disponible" })}</Text></View></View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <TinyMetric label="Edge" value={percent(pick.edge)} accent={Number(pick.edge || 0) > 0} />
              <TinyMetric label="EV" value={percent(pick.ev)} accent={Number(pick.ev || 0) > 0} />
              <TinyMetric label={tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" })} value={percent(pick.confidence)} />
            </View>
            <Text style={styles.muted}>{Number(pick.bookmakerCount || pick.dataQuality?.bookmakerCount || 0)} {tr({ fi: "lähdettä", en: "sources", es: "fuentes" })} · {dataFreshness(pick)} · trust {Number(pick.trustScore || 0).toFixed(0)}/100</Text>
            {!limits.allowed && <Text style={styles.muted}>{tr({ fi: `Oma raja estää paperitallennuksen: edge ${limits.edgeOk ? "OK" : "liian pieni"}, confidence ${limits.confidenceOk ? "OK" : "liian pieni"}.`, en: `Your limit blocks paper saving: edge ${limits.edgeOk ? "OK" : "too low"}, confidence ${limits.confidenceOk ? "OK" : "too low"}.`, es: `Tu límite impide guardar: ventaja ${limits.edgeOk ? "OK" : "demasiado baja"}, confianza ${limits.confidenceOk ? "OK" : "demasiado baja"}.` })}</Text>}

            <ActionButton label={tr({ fi: "Avaa kaikki tiedot", en: "Open event detail", es: "Abrir detalle" })} onPress={() => onOpenEvent?.(pick)} disabled={!onOpenEvent || !eventId(pick) || !String(pick.sportKey || pick.league || "")} />
            <View style={styles.actionRow}>
              <View style={{ flex: 1, minWidth: 150 }}><ActionButton label={watched ? tr({ fi: "Seurannassa", en: "Watched", es: "En seguimiento" }) : watchingId === watchKey(pick) ? tr({ fi: "Lisätään…", en: "Adding…", es: "Añadiendo…" }) : tr({ fi: "Seuraa", en: "Watch", es: "Seguir" })} onPress={() => watchPick(pick)} disabled={watched || watchingId !== null} tone="secondary" /></View>
              <View style={{ flex: 1, minWidth: 150 }}><ActionButton label={expanded ? tr({ fi: "Sulje toiminnot", en: "Close actions", es: "Cerrar acciones" }) : tr({ fi: "Paperitoiminnot", en: "Paper actions", es: "Acciones simuladas" })} onPress={() => setExpandedId(expanded ? null : id)} tone="secondary" /></View>
            </View>

            {expanded && <View style={{ borderTopWidth: 1, borderTopColor: "#273241", paddingTop: 12, gap: 10 }}><Field label={tr({ fi: "Paperipanos (€)", en: "Paper stake (€)", es: "Importe simulado (€)" })} value={stakes[id] || initialStake(pick, maximumStake).toFixed(2)} onChangeText={(value) => setStakes((current) => ({ ...current, [id]: value }))} keyboardType="decimal-pad" /><Text style={styles.muted}>{tr({ fi: "Enintään", en: "Maximum", es: "Máximo" })} {money(maximumStake)}. {tr({ fi: "Oikeaa vetoa ei aseteta.", en: "No real bet is placed.", es: "No se realiza ninguna apuesta real." })}</Text><ActionButton label={savingId === id ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Lisää paperiseurantaan", en: "Add to paper tracking", es: "Añadir al seguimiento simulado" })} onPress={() => savePick(pick, index)} disabled={savingId !== null || !canSave} />{decision === "SKIP" && <Text style={styles.muted}>{tr({ fi: "SKIP-valintaa ei voi tallentaa paperiseurantaan.", en: "A SKIP selection cannot be saved to paper tracking.", es: "Una selección SKIP no puede guardarse." })}</Text>}</View>}
          </Card>
        );
      })}
    </ScrollView>
  );
}
