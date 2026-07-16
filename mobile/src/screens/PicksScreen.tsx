import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { apiRequest } from "../lib/api";
import type { Bankroll, Pick } from "../types";
import { ActionButton, Card, Field, money, percent, styles } from "../ui";

const FILTERS = [
  { key: "all", label: "Kaikki", sports: null },
  { key: "nhl", label: "NHL", sports: "icehockey_nhl" },
  { key: "nba", label: "NBA", sports: "basketball_nba" },
  { key: "epl", label: "EPL", sports: "soccer_epl" },
  { key: "laliga", label: "La Liga", sports: "soccer_spain_la_liga" },
  { key: "liiga", label: "Liiga", sports: "icehockey_finland_liiga" },
  { key: "shl", label: "SHL", sports: "icehockey_sweden_hockey_league" }
] as const;

const DECISIONS = [
  { key: "all", label: "Kaikki päätökset" },
  { key: "PLAY", label: "PLAY" },
  { key: "CAUTION", label: "CAUTION" }
] as const;

const SORTS = [
  { key: "rank", label: "Paras ensin" },
  { key: "edge", label: "Edge" },
  { key: "confidence", label: "Confidence" },
  { key: "time", label: "Alkamisaika" }
] as const;

type DecisionFilter = (typeof DECISIONS)[number]["key"];
type SortMode = (typeof SORTS)[number]["key"];

function pickKey(pick: Pick, index: number) {
  return String(pick.id || pick.eventId || pick.gameId || `${pick.match || "pick"}-${pick.selection || pick.label || index}`);
}

function parsePaperStake(value: string) {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function initialStake(pick: Pick, maximum: number) {
  const decision = pick.productDecision || pick.decision || "CAUTION";
  if (decision === "SKIP") return 0;
  const confidence = clamp(Number(pick.confidence || 0.35), 0.15, 0.9);
  const decisionMultiplier = decision === "PLAY" ? 0.5 : 0.25;
  return Number((maximum * decisionMultiplier * confidence).toFixed(2));
}

function formatKickoff(value?: string) {
  if (!value) return "Alkamisaika ei tiedossa";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Alkamisaika ei tiedossa";
  return date.toLocaleString("fi-FI", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function dataFreshness(pick: Pick) {
  const label = pick.freshnessLabel || pick.dataQuality?.freshness || "unknown";
  const hours = pick.dataAgeHours ?? pick.dataQuality?.ageHours;
  if (typeof hours === "number" && Number.isFinite(hours)) {
    return `${label} · ${hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min` : `${hours.toFixed(1)} h`}`;
  }
  return label;
}

function rankValue(pick: Pick) {
  const decision = pick.productDecision || pick.decision;
  const decisionScore = decision === "PLAY" ? 2 : decision === "CAUTION" ? 1 : 0;
  return decisionScore + Number(pick.trustScore || 0) / 100 + Number(pick.edge || 0) * 4 + Number(pick.confidence || 0);
}

export default function PicksScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(FILTERS[0]);
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("rank");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [featuredKeys, setFeaturedKeys] = useState<Set<string>>(new Set());
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const maximumStake = useMemo(() => {
    if (!bankroll) return 10;
    return Number(Math.max(0, bankroll.bankroll * bankroll.max_stake_percent / 100).toFixed(2));
  }, [bankroll]);

  const visiblePicks = useMemo(() => {
    const filtered = picks.filter((pick) => {
      const decision = pick.productDecision || pick.decision || "CAUTION";
      return decisionFilter === "all" || decision === decisionFilter;
    });

    return filtered.slice().sort((a, b) => {
      if (sortMode === "edge") return Number(b.edge || 0) - Number(a.edge || 0);
      if (sortMode === "confidence") return Number(b.confidence || 0) - Number(a.confidence || 0);
      if (sortMode === "time") {
        const aTime = a.commenceTime ? Date.parse(a.commenceTime) : Number.MAX_SAFE_INTEGER;
        const bTime = b.commenceTime ? Date.parse(b.commenceTime) : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      }
      return rankValue(b) - rankValue(a);
    });
  }, [decisionFilter, picks, sortMode]);

  async function load(selected = filter) {
    setLoading(true);
    try {
      const query = selected.sports
        ? `?sports=${encodeURIComponent(selected.sports)}`
        : "";
      const [pickResponse, bankrollResponse] = await Promise.all([
        apiRequest<{ data?: Pick[]; featured?: Pick[]; generatedAt?: string }>(`/api/top-picks${query}`, {
          authenticated: false,
          timeoutMs: 30000
        }),
        apiRequest<{ data: Bankroll }>("/api/cloud/bankroll")
      ]);

      const nextPicks = (pickResponse.data || []).slice(0, 20);
      const nextFeatured = new Set(
        (pickResponse.featured || nextPicks.slice(0, 3)).map((pick, index) => pickKey(pick, index))
      );
      const nextMaximum = Math.max(
        0,
        bankrollResponse.data.bankroll * bankrollResponse.data.max_stake_percent / 100
      );

      setPicks(nextPicks);
      setFeaturedKeys(nextFeatured);
      setBankroll(bankrollResponse.data);
      setGeneratedAt(pickResponse.generatedAt || new Date().toISOString());
      setStakes((current) => {
        const next = { ...current };
        nextPicks.forEach((pick, index) => {
          const id = pickKey(pick, index);
          if (next[id] === undefined) next[id] = initialStake(pick, nextMaximum).toFixed(2);
        });
        return next;
      });
    } catch (error) {
      Alert.alert("Kohteita ei voitu ladata", error instanceof Error ? error.message : "Tuntematon virhe");
      setPicks([]);
      setFeaturedKeys(new Set());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(filter); }, [filter]);

  async function savePick(pick: Pick, index: number) {
    const odds = Number(pick.odds || 0);
    const selection = String(pick.selection || pick.label || "").trim();
    const match = String(
      pick.match || [pick.homeTeam, pick.awayTeam].filter(Boolean).join(" – ")
    ).trim();
    const id = pickKey(pick, index);
    const stake = parsePaperStake(stakes[id] || "0");
    const maximum = bankroll
      ? bankroll.bankroll * bankroll.max_stake_percent / 100
      : maximumStake;

    if (!match || !selection || odds <= 1) {
      Alert.alert("Kohde puutteellinen", "Kohteen tietoja ei voida tallentaa turvallisesti.");
      return;
    }

    if (stake === null || stake <= 0 || stake > maximum + 0.001) {
      Alert.alert(
        "Tarkista paperipanos",
        `Anna panos väliltä 0,01–${money(maximum)}. Muuta rajaa Etusivu-välilehdellä tarvittaessa.`
      );
      return;
    }

    setSavingId(id);
    try {
      await apiRequest("/api/cloud/bets", {
        method: "POST",
        body: {
          bets: [{
            id,
            match,
            selection,
            odds,
            stake,
            edge: pick.edge,
            ev: pick.ev,
            confidence: pick.confidence,
            league: pick.league || pick.leagueTitle,
            sport: pick.sportKey,
            bookmaker: pick.bookmaker,
            decision: pick.productDecision || pick.decision,
            qualityGrade: pick.qualityGrade,
            qualityScore: pick.trustScore,
            modelProbability: pick.modelProbability || pick.consensusProbability,
            impliedProbability: pick.marketProbability,
            source: "scorecaster-mobile-consensus"
          }]
        }
      });
      Alert.alert(
        "Tallennettu paperiseurantaan",
        `${selection} · ${money(stake)}. Oikeaa vetoa ei asetettu.`
      );
    } catch (error) {
      Alert.alert("Tallennus epäonnistui", error instanceof Error ? error.message : "Tuntematon virhe");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Päivän kohteet</Text>
          <Text style={styles.subtitle}>Paras hinta verrataan vedonvälittäjien marginaalista puhdistettuun konsensukseen.</Text>
        </View>
        <ActionButton label="Päivitä" onPress={() => load()} tone="secondary" compact disabled={loading} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = item.key === filter.key;
          return (
            <Pressable
              accessibilityLabel={`Valitse liiga ${item.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={item.key}
              onPress={() => setFilter(item)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {DECISIONS.map((item) => {
          const active = item.key === decisionFilter;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={item.key}
              onPress={() => setDecisionFilter(item.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {SORTS.map((item) => {
          const active = item.key === sortMode;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={item.key}
              onPress={() => setSortMode(item.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card>
        <Text style={styles.cardTitle}>Paperiraja ja aineisto</Text>
        <Text style={styles.value}>Enimmäispanos {money(maximumStake)}</Text>
        <Text style={styles.muted}>
          Näytetään {visiblePicks.length}/{picks.length} kohdetta{generatedAt ? ` · analyysi ${new Date(generatedAt).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}` : ""}.
        </Text>
      </Card>

      {loading && <ActivityIndicator color="#34d399" size="large" />}
      {!loading && visiblePicks.length === 0 && (
        <Text style={styles.muted}>Tällä suodattimella ei löytynyt riittävän laadukasta markkina-aineistoa.</Text>
      )}

      {visiblePicks.map((pick, index) => {
        const id = pickKey(pick, index);
        const match = pick.match || [pick.homeTeam, pick.awayTeam].filter(Boolean).join(" – ") || "Ottelu";
        const decision = pick.productDecision || pick.decision || "CAUTION";
        const featured = featuredKeys.has(id);
        const consensusProbability = Number(pick.consensusProbability || pick.modelProbability || 0);
        const marketProbability = Number(pick.marketProbability || (pick.odds ? 1 / pick.odds : 0));
        const notes = (pick.qualityNotes || []).slice(0, 2);

        return (
          <Card key={`${id}-${index}`}>
            <View style={styles.rowBetween}>
              <View style={[styles.badge, decision === "SKIP" && styles.dangerBadge, decision === "CAUTION" && styles.warningBadge]}>
                <Text style={styles.badgeText}>{featured ? "TOP · " : ""}{decision}</Text>
              </View>
              <Text style={styles.muted}>{pick.leagueTitle || pick.league || filter.label}</Text>
            </View>

            <Text style={styles.cardTitle}>{match}</Text>
            <Text style={styles.value}>{pick.selection || pick.label || "Valinta"} · {Number(pick.odds || 0).toFixed(2)}</Text>
            <Text style={styles.muted}>{formatKickoff(pick.commenceTime)} · {pick.bookmaker || "Paras saatavilla oleva hinta"}</Text>

            <View style={styles.divider} />
            <Text style={styles.muted}>
              Konsensus {percent(consensusProbability)} · tarjouskerroin {percent(marketProbability)} · edge {percent(pick.edge)} · EV {percent(pick.ev)}
            </Text>
            <Text style={styles.muted}>
              Reilu kerroin {pick.fairOdds ? Number(pick.fairOdds).toFixed(2) : "–"} · confidence {percent(pick.confidence)} ({pick.confidenceLabel || "–"}) · trust {Number(pick.trustScore || 0).toFixed(0)}/100
            </Text>
            <Text style={styles.muted}>
              Vedonvälittäjiä {Number(pick.bookmakerCount || pick.dataQuality?.bookmakerCount || 0)} · data {dataFreshness(pick)}
            </Text>

            {notes.map((note) => <Text key={note} style={styles.muted}>• {note}</Text>)}

            <Field
              label="Paperipanos (€)"
              value={stakes[id] || initialStake(pick, maximumStake).toFixed(2)}
              onChangeText={(value) => setStakes((current) => ({ ...current, [id]: value }))}
              keyboardType="decimal-pad"
            />
            <ActionButton
              label={savingId === id ? "Tallennetaan…" : "Lisää paperiseurantaan"}
              onPress={() => savePick(pick, index)}
              disabled={savingId !== null || decision === "SKIP"}
            />
            {decision === "SKIP" && (
              <Text style={styles.muted}>SKIP tarkoittaa, että hinta tai aineiston laatu ei täytä Scorecasterin rajaa.</Text>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}
