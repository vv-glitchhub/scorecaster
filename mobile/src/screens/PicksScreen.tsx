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

function pickKey(pick: Pick, index: number) {
  return String(pick.id || pick.eventId || `${pick.match || "pick"}-${pick.selection || pick.label || index}`);
}

function parsePaperStake(value: string) {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export default function PicksScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(FILTERS[0]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [featuredKeys, setFeaturedKeys] = useState<Set<string>>(new Set());
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const suggestedStake = useMemo(() => {
    if (!bankroll) return 10;
    return Number(Math.max(0, bankroll.bankroll * bankroll.max_stake_percent / 100).toFixed(2));
  }, [bankroll]);

  async function load(selected = filter) {
    setLoading(true);
    try {
      const query = selected.sports
        ? `?sports=${encodeURIComponent(selected.sports)}`
        : "";
      const [pickResponse, bankrollResponse] = await Promise.all([
        apiRequest<{ data?: Pick[]; featured?: Pick[] }>(`/api/top-picks${query}`, {
          authenticated: false,
          timeoutMs: 30000
        }),
        apiRequest<{ data: Bankroll }>("/api/cloud/bankroll")
      ]);

      const nextPicks = (pickResponse.data || []).slice(0, 20);
      const nextFeatured = new Set(
        (pickResponse.featured || nextPicks.slice(0, 3)).map((pick, index) => pickKey(pick, index))
      );
      const defaultStake = Math.max(
        0,
        bankrollResponse.data.bankroll * bankrollResponse.data.max_stake_percent / 100
      );

      setPicks(nextPicks);
      setFeaturedKeys(nextFeatured);
      setBankroll(bankrollResponse.data);
      setStakes((current) => {
        const next = { ...current };
        nextPicks.forEach((pick, index) => {
          const id = pickKey(pick, index);
          if (next[id] === undefined) next[id] = defaultStake.toFixed(2);
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
      : suggestedStake;

    if (!match || !selection || odds <= 1) {
      Alert.alert("Kohde puutteellinen", "Kohteen tietoja ei voida tallentaa turvallisesti.");
      return;
    }

    if (stake === null || stake < 0 || stake > maximum + 0.001) {
      Alert.alert(
        "Paperipanos ylittää rajan",
        `Anna panos väliltä 0–${money(maximum)}. Muuta rajaa Etusivu-välilehdellä tarvittaessa.`
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
            source: "scorecaster-mobile"
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
        <View>
          <Text style={styles.title}>Päivän kohteet</Text>
          <Text style={styles.subtitle}>Top 3, luottamus ja paperipanos. SKIP on hyväksytty tulos.</Text>
        </View>
        <ActionButton label="Päivitä" onPress={() => load()} tone="secondary" compact disabled={loading} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = item.key === filter.key;
          return (
            <Pressable
              accessibilityRole="button"
              key={item.key}
              onPress={() => setFilter(item)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card>
        <Text style={styles.cardTitle}>Paperiraja</Text>
        <Text style={styles.value}>Suositeltu enimmäispanos {money(suggestedStake)}</Text>
        <Text style={styles.muted}>Raja perustuu virtuaalikassaan ja omaan enimmäispanosprosenttiin.</Text>
      </Card>

      {loading && <ActivityIndicator color="#34d399" size="large" />}
      {!loading && picks.length === 0 && (
        <Text style={styles.muted}>Tällä hetkellä ei löytynyt laadun läpäiseviä kohteita tästä liigasta.</Text>
      )}

      {picks.map((pick, index) => {
        const id = pickKey(pick, index);
        const match = pick.match || [pick.homeTeam, pick.awayTeam].filter(Boolean).join(" – ") || "Ottelu";
        const decision = pick.productDecision || pick.decision || "CAUTION";
        const featured = featuredKeys.has(id) || index < 3;

        return (
          <Card key={`${id}-${index}`}>
            <View style={styles.rowBetween}>
              <View style={[styles.badge, decision === "SKIP" && styles.dangerBadge, decision === "CAUTION" && styles.warningBadge]}>
                <Text style={styles.badgeText}>{featured ? `TOP ${index + 1} · ` : ""}{decision}</Text>
              </View>
              <Text style={styles.muted}>{pick.leagueTitle || pick.league || filter.label}</Text>
            </View>
            <Text style={styles.cardTitle}>{match}</Text>
            <Text style={styles.value}>{pick.selection || pick.label || "Valinta"} · {Number(pick.odds || 0).toFixed(2)}</Text>
            <Text style={styles.muted}>
              Edge {percent(pick.edge)} · Confidence {percent(pick.confidence)} · Trust {Number(pick.trustScore || 0).toFixed(0)}/100
            </Text>
            <Field
              label="Paperipanos (€)"
              value={stakes[id] || suggestedStake.toFixed(2)}
              onChangeText={(value) => setStakes((current) => ({ ...current, [id]: value }))}
              keyboardType="decimal-pad"
            />
            <ActionButton
              label={savingId === id ? "Tallennetaan…" : "Lisää paperiseurantaan"}
              onPress={() => savePick(pick, index)}
              disabled={savingId !== null || decision === "SKIP"}
            />
            {decision === "SKIP" && (
              <Text style={styles.muted}>SKIP-kohdetta ei voi lisätä mobiilisovelluksen paperiseurantaan.</Text>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}
