import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { apiRequest } from "../lib/api";
import type { PaperBet } from "../types";
import { ActionButton, Card, Field, money, percent, styles } from "../ui";

function parseClosingOdds(value: string) {
  if (!value.trim()) return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) && number > 1 ? number : null;
}

export default function PaperBetsScreen() {
  const [bets, setBets] = useState<PaperBet[]>([]);
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

  async function settle(id: string, status: "won" | "lost" | "void") {
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

  const metrics = useMemo(() => {
    const settled = bets.filter((bet) => bet.status !== "open");
    const totalProfit = settled.reduce((sum, bet) => sum + Number(bet.profit || 0), 0);
    const totalStake = settled.reduce((sum, bet) => sum + Number(bet.stake || 0), 0);
    const roi = totalStake > 0 ? totalProfit / totalStake : 0;
    const clvValues = settled.map((bet) => Number(bet.clv)).filter(Number.isFinite);
    const averageClv = clvValues.length
      ? clvValues.reduce((sum, value) => sum + value, 0) / clvValues.length
      : 0;

    return { settled: settled.length, totalProfit, totalStake, roi, averageClv };
  }, [bets]);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.title}>Paperiseuranta</Text>
          <Text style={styles.subtitle}>Tulos, ROI ja closing line value ilman oikeaa rahaa.</Text>
        </View>
        <ActionButton label="Päivitä" onPress={load} tone="secondary" compact disabled={loading} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>Yhteenveto</Text>
        <Text style={styles.metric}>{money(metrics.totalProfit)}</Text>
        <Text style={styles.muted}>
          Ratkaistu {metrics.settled} · Paperipanokset {money(metrics.totalStake)} · ROI {percent(metrics.roi)} · CLV keskimäärin {metrics.averageClv.toFixed(2)} %
        </Text>
      </Card>

      {loading && <ActivityIndicator color="#34d399" size="large" />}
      {!loading && bets.length === 0 && <Text style={styles.muted}>Paperiseuranta on vielä tyhjä.</Text>}

      {bets.map((bet) => (
        <Card key={bet.id}>
          <View style={styles.rowBetween}>
            <View style={[styles.badge, bet.status === "lost" && styles.dangerBadge, bet.status === "open" && styles.warningBadge]}>
              <Text style={styles.badgeText}>{bet.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.muted}>{new Date(bet.created_at).toLocaleDateString("fi-FI")}</Text>
          </View>
          <Text style={styles.cardTitle}>{bet.match}</Text>
          <Text style={styles.value}>{bet.label} · {Number(bet.odds).toFixed(2)}</Text>
          <Text style={styles.muted}>
            Paperipanos {money(bet.stake)} · tulos {money(bet.profit)}{bet.clv !== null ? ` · CLV ${Number(bet.clv).toFixed(2)} %` : ""}
          </Text>

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
