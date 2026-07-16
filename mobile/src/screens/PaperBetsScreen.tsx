import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { apiRequest } from "../lib/api";
import { calculatePaperAnalytics } from "../lib/paperAnalytics";
import type { PaperBet } from "../types";
import { ActionButton, Card, Field, money, percent, styles } from "../ui";

const FILTERS = [
  { key: "all", label: "Kaikki" },
  { key: "open", label: "Avoimet" },
  { key: "settled", label: "Ratkaistut" },
  { key: "won", label: "Voitot" },
  { key: "lost", label: "Tappiot" }
] as const;

type BetFilter = (typeof FILTERS)[number]["key"];
type SettlementStatus = "won" | "lost" | "void" | "push";

function parseClosingOdds(value: string) {
  if (!value.trim()) return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) && number > 1 ? number : null;
}

function statusLabel(status: string) {
  if (status === "open") return "AVOIN";
  if (status === "won") return "VOITTO";
  if (status === "lost") return "TAPPIO";
  if (status === "push") return "PALAUTUS";
  if (status === "void") return "MITÄTÖN";
  return status.toUpperCase();
}

export default function PaperBetsScreen() {
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [filter, setFilter] = useState<BetFilter>("all");
  const [newestFirst, setNewestFirst] = useState(true);
  const [closingOdds, setClosingOdds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await apiRequest<{ data: PaperBet[] }>("/api/cloud/bets");
      setBets(response.data || []);
      setClosingOdds((current) => {
        const next = { ...current };
        (response.data || []).forEach((bet) => {
          if (next[bet.id] === undefined && bet.closing_odds) next[bet.id] = String(bet.closing_odds);
        });
        return next;
      });
    } catch (error) {
      Alert.alert("Historiaa ei voitu ladata", error instanceof Error ? error.message : "Tuntematon virhe");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function settle(id: string, status: SettlementStatus) {
    const rawClosing = closingOdds[id] || "";
    const parsedClosing = parseClosingOdds(rawClosing);
    if (rawClosing.trim() && parsedClosing === null) {
      Alert.alert("Tarkista päätöskerroin", "Päätöskertoimen pitää olla suurempi kuin 1,00 tai kentän voi jättää tyhjäksi.");
      return;
    }

    setBusyId(id);
    try {
      await apiRequest("/api/cloud/bets", {
        method: "PATCH",
        body: { id, status, closingOdds: parsedClosing }
      });
      await load();
    } catch (error) {
      Alert.alert("Päivitys epäonnistui", error instanceof Error ? error.message : "Tuntematon virhe");
    } finally {
      setBusyId(null);
    }
  }

  function remove(id: string) {
    Alert.alert(
      "Poistetaanko paperiveto?",
      "Poisto vaikuttaa paperiseurannan historiaan ja tunnuslukuihin.",
      [
        { text: "Peruuta", style: "cancel" },
        {
          text: "Poista",
          style: "destructive",
          onPress: async () => {
            setBusyId(id);
            try {
              await apiRequest("/api/cloud/bets", { method: "DELETE", body: { ids: [id] } });
              setBets((current) => current.filter((bet) => bet.id !== id));
            } catch (error) {
              Alert.alert("Poisto epäonnistui", error instanceof Error ? error.message : "Tuntematon virhe");
            } finally {
              setBusyId(null);
            }
          }
        }
      ]
    );
  }

  const analytics = useMemo(() => calculatePaperAnalytics(bets), [bets]);

  const visibleBets = useMemo(() => {
    const filtered = bets.filter((bet) => {
      if (filter === "all") return true;
      if (filter === "settled") return bet.status !== "open";
      return bet.status === filter;
    });

    return filtered.slice().sort((a, b) => {
      const difference = Date.parse(b.created_at) - Date.parse(a.created_at);
      return newestFirst ? difference : -difference;
    });
  }, [bets, filter, newestFirst]);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Paperiseuranta</Text>
          <Text style={styles.subtitle}>Tulos, ROI ja closing line value ilman oikeaa rahaa.</Text>
        </View>
        <ActionButton label="Päivitä" onPress={load} tone="secondary" compact disabled={loading} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>Yhteenveto</Text>
        <Text style={styles.metric}>{money(analytics.totalProfit)}</Text>
        <Text style={styles.muted}>
          Ratkaistu {analytics.settledBets} · paperipanokset {money(analytics.totalStake)} · ROI {percent(analytics.roi)} · CLV {analytics.averageClv.toFixed(2)} %
        </Text>
        <Text style={styles.muted}>
          Avoimia {analytics.openBets} · avoin altistus {money(analytics.openExposure)} · osumat {percent(analytics.winRate)}
        </Text>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={() => setNewestFirst((value) => !value)}
          style={styles.filterChip}
        >
          <Text style={styles.filterText}>{newestFirst ? "Uusin ensin" : "Vanhin ensin"}</Text>
        </Pressable>
      </ScrollView>

      {loading && <ActivityIndicator color="#34d399" size="large" />}
      {!loading && visibleBets.length === 0 && <Text style={styles.muted}>Tällä suodattimella ei ole paperivetoja.</Text>}

      {visibleBets.map((bet) => (
        <Card key={bet.id}>
          <View style={styles.rowBetween}>
            <View style={[styles.badge, bet.status === "lost" && styles.dangerBadge, bet.status === "open" && styles.warningBadge]}>
              <Text style={styles.badgeText}>{statusLabel(bet.status)}</Text>
            </View>
            <Text style={styles.muted}>{new Date(bet.created_at).toLocaleDateString("fi-FI")}</Text>
          </View>
          <Text style={styles.cardTitle}>{bet.match}</Text>
          <Text style={styles.value}>{bet.label} · {Number(bet.odds).toFixed(2)}</Text>
          <Text style={styles.muted}>
            {bet.league || bet.sport || "Muu"}{bet.bookmaker ? ` · ${bet.bookmaker}` : ""}
          </Text>
          <Text style={styles.muted}>
            Paperipanos {money(bet.stake)} · tulos {money(bet.profit)}{bet.clv !== null ? ` · CLV ${Number(bet.clv).toFixed(2)} %` : ""}
          </Text>
          {(bet.edge !== null || bet.confidence !== null) && (
            <Text style={styles.muted}>Tallennushetken edge {percent(bet.edge)} · confidence {percent(bet.confidence)}</Text>
          )}

          {bet.status === "open" && (
            <>
              <Field
                label="Päätöskerroin CLV-laskentaan (valinnainen)"
                value={closingOdds[bet.id] || ""}
                onChangeText={(value) => setClosingOdds((current) => ({ ...current, [bet.id]: value }))}
                placeholder="esim. 1,95"
                keyboardType="decimal-pad"
              />
              <View style={styles.actionRow}>
                <ActionButton label="Voitto" onPress={() => settle(bet.id, "won")} disabled={busyId !== null} compact />
                <ActionButton label="Tappio" onPress={() => settle(bet.id, "lost")} disabled={busyId !== null} tone="danger" compact />
                <ActionButton label="Palautus" onPress={() => settle(bet.id, "push")} disabled={busyId !== null} tone="secondary" compact />
                <ActionButton label="Mitätön" onPress={() => settle(bet.id, "void")} disabled={busyId !== null} tone="secondary" compact />
              </View>
            </>
          )}

          <ActionButton label={busyId === bet.id ? "Odota…" : "Poista"} onPress={() => remove(bet.id)} disabled={busyId !== null} tone="secondary" compact />
        </Card>
      ))}
    </ScrollView>
  );
}
