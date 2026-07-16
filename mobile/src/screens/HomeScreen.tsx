import { useEffect, useMemo, useState } from "react";
import { Alert, ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { apiRequest } from "../lib/api";
import { calculatePaperAnalytics } from "../lib/paperAnalytics";
import type { Bankroll, PaperBet, Pick } from "../types";
import { ActionButton, Card, Field, money, percent, styles } from "../ui";

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={localStyles.metricBox}>
      <Text style={localStyles.metricLabel}>{label}</Text>
      <Text style={localStyles.metricValue}>{value}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [topPick, setTopPick] = useState<Pick | null>(null);
  const [bankrollInput, setBankrollInput] = useState("1000");
  const [maxStakeInput, setMaxStakeInput] = useState("2");
  const [dailyExposureInput, setDailyExposureInput] = useState("8");
  const [leagueExposureInput, setLeagueExposureInput] = useState("4");
  const [minEdgeInput, setMinEdgeInput] = useState("2.5");
  const [minConfidenceInput, setMinConfidenceInput] = useState("58");
  const [status, setStatus] = useState("Tarkistetaan palvelua…");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [healthResult, bankrollResult, betsResult, picksResult] = await Promise.allSettled([
        apiRequest<{ status?: string; mode?: string }>("/api/health", { authenticated: false }),
        apiRequest<{ data: Bankroll }>("/api/cloud/bankroll"),
        apiRequest<{ data: PaperBet[] }>("/api/cloud/bets"),
        apiRequest<{ featured?: Pick[]; data?: Pick[] }>("/api/top-picks", {
          authenticated: false,
          timeoutMs: 30000
        })
      ]);

      if (healthResult.status === "fulfilled") {
        setStatus(`${healthResult.value.status || "unknown"} · ${healthResult.value.mode || "unknown"}`);
      } else {
        setStatus("Palvelun tilaa ei voitu tarkistaa");
      }

      if (bankrollResult.status === "fulfilled") {
        const next = bankrollResult.value.data;
        setBankroll(next);
        setBankrollInput(String(next.bankroll));
        setMaxStakeInput(String(next.max_stake_percent));
        setDailyExposureInput(String(next.max_daily_exposure_percent));
        setLeagueExposureInput(String(next.max_single_league_exposure_percent || 4));
        setMinEdgeInput(String(Number(next.min_edge || 0.025) * 100));
        setMinConfidenceInput(String(Number(next.min_confidence || 0.58) * 100));
      }

      if (betsResult.status === "fulfilled") setBets(betsResult.value.data || []);
      if (picksResult.status === "fulfilled") {
        setTopPick(picksResult.value.featured?.[0] || picksResult.value.data?.[0] || null);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Palveluvirhe");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    const bankrollNumber = numberValue(bankrollInput);
    const maxStake = numberValue(maxStakeInput);
    const dailyExposure = numberValue(dailyExposureInput);
    const leagueExposure = numberValue(leagueExposureInput);
    const minEdgePercent = numberValue(minEdgeInput);
    const minConfidencePercent = numberValue(minConfidenceInput);

    if (
      bankrollNumber === null || bankrollNumber < 0 || bankrollNumber > 10000000 ||
      maxStake === null || maxStake < 0.1 || maxStake > 10 ||
      dailyExposure === null || dailyExposure < 0.5 || dailyExposure > 50 ||
      leagueExposure === null || leagueExposure < 0.5 || leagueExposure > 25 ||
      minEdgePercent === null || minEdgePercent < 0 || minEdgePercent > 20 ||
      minConfidencePercent === null || minConfidencePercent < 0 || minConfidencePercent > 100
    ) {
      Alert.alert(
        "Tarkista rajat",
        "Virtuaalikassa 0–10 000 000 €, panos 0,1–10 %, päiväaltistus 0,5–50 %, liiga-altistus 0,5–25 %, minimiedge 0–20 % ja confidence 0–100 %."
      );
      return;
    }

    setSaving(true);
    try {
      const response = await apiRequest<{ data: Bankroll }>("/api/cloud/bankroll", {
        method: "PUT",
        body: {
          bankroll: bankrollNumber,
          maxStakePercent: maxStake,
          maxDailyExposurePercent: dailyExposure,
          maxSingleLeagueExposurePercent: leagueExposure,
          minEdge: minEdgePercent / 100,
          minConfidence: minConfidencePercent / 100
        }
      });
      setBankroll(response.data);
      Alert.alert("Tallennettu", "Virtuaalinen pelikassa ja papeririskin rajat päivitettiin.");
    } catch (error) {
      Alert.alert("Tallennus epäonnistui", error instanceof Error ? error.message : "Tuntematon virhe");
    } finally {
      setSaving(false);
    }
  }

  const analytics = useMemo(() => calculatePaperAnalytics(bets), [bets]);
  const suggestedMaximum = bankroll
    ? bankroll.bankroll * bankroll.max_stake_percent / 100
    : 0;
  const exposurePercent = bankroll?.bankroll
    ? analytics.openExposure / bankroll.bankroll
    : 0;
  const exposureLimit = Number(bankroll?.max_daily_exposure_percent || 0) / 100;
  const closeToLimit = exposureLimit > 0 && exposurePercent >= exposureLimit * 0.8;

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Tänään</Text>
          <Text style={styles.subtitle}>Näe päivän tilanne ennen uuden paperipäätöksen tekemistä.</Text>
        </View>
        <ActionButton label="Päivitä" onPress={load} tone="secondary" compact disabled={loading} />
      </View>

      {loading ? (
        <ActivityIndicator color="#34d399" size="large" />
      ) : (
        <>
          <View style={localStyles.metricGrid}>
            <Metric label="Paperipelikassa" value={money(bankroll?.bankroll)} />
            <Metric label="Avoin altistus" value={money(analytics.openExposure)} />
            <Metric label="Paperitulos" value={money(analytics.totalProfit)} />
            <Metric label="ROI" value={percent(analytics.roi)} />
          </View>

          {closeToLimit && (
            <Card>
              <Text style={localStyles.warningTitle}>Riskiraja lähestyy</Text>
              <Text style={styles.muted}>Avoin altistus on {percent(exposurePercent)} virtuaalikassasta. Päiväraja on {percent(exposureLimit)}. SKIP on tässä tilanteessa hyvä päätös.</Text>
            </Card>
          )}

          <Card>
            <Text style={styles.cardTitle}>Päivän paras markkina-arvo</Text>
            {topPick ? (
              <>
                <View style={styles.rowBetween}>
                  <View style={[styles.badge, topPick.productDecision === "CAUTION" && styles.warningBadge]}>
                    <Text style={styles.badgeText}>{topPick.productDecision || "CAUTION"}</Text>
                  </View>
                  <Text style={styles.muted}>{topPick.leagueTitle || topPick.league || ""}</Text>
                </View>
                <Text style={styles.value}>{topPick.match}</Text>
                <Text style={styles.cardTitle}>{topPick.selection} · {Number(topPick.odds || 0).toFixed(2)}</Text>
                <Text style={styles.muted}>Edge {percent(topPick.edge)} · confidence {percent(topPick.confidence)} · {Number(topPick.bookmakerCount || 0)} vedonvälittäjää.</Text>
              </>
            ) : (
              <Text style={styles.muted}>Riittävän laadukasta kohdetta ei löytynyt. Tämä on hyväksytty lopputulos.</Text>
            )}
          </Card>

          <Card>
            <Text style={styles.cardTitle}>Paperirajat</Text>
            <Text style={styles.value}>Laskennallinen enimmäispanos {money(suggestedMaximum)}</Text>
            <Text style={styles.muted}>Rajat suojaavat paperiseurannan prosessia. Ne eivät ole kehotus käyttää enimmäispanosta.</Text>
            <Field label="Virtuaalikassa (€)" value={bankrollInput} onChangeText={setBankrollInput} keyboardType="decimal-pad" />
            <Field label="Yksittäisen panoksen yläraja (%)" value={maxStakeInput} onChangeText={setMaxStakeInput} keyboardType="decimal-pad" />
            <Field label="Päivän enimmäisaltistus (%)" value={dailyExposureInput} onChangeText={setDailyExposureInput} keyboardType="decimal-pad" />
            <Field label="Yhden liigan enimmäisaltistus (%)" value={leagueExposureInput} onChangeText={setLeagueExposureInput} keyboardType="decimal-pad" />
            <Field label="Minimiedge (%)" value={minEdgeInput} onChangeText={setMinEdgeInput} keyboardType="decimal-pad" />
            <Field label="Minimi-confidence (%)" value={minConfidenceInput} onChangeText={setMinConfidenceInput} keyboardType="decimal-pad" />
            <ActionButton label={saving ? "Tallennetaan…" : "Tallenna paperirajat"} onPress={save} disabled={saving} />
          </Card>
        </>
      )}

      <Card>
        <Text style={styles.cardTitle}>Palvelun tila</Text>
        <Text style={styles.value}>{status}</Text>
        <Text style={styles.muted}>Todennäköisyys perustuu markkinan marginaalista puhdistettuun konsensukseen. Käyttäjäkohtaiset tiedot kulkevat suojattujen pilvireittien kautta.</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Tuotteen raja</Text>
        <Text style={styles.value}>Analyysi + paperiseuranta</Text>
        <Text style={styles.muted}>Ei talletuksia, kotiutuksia, maksutietoja, vedonlyöntitilejä tai oikean rahan vedonvälitystä.</Text>
      </Card>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricBox: {
    width: "48%",
    minHeight: 86,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 13,
    justifyContent: "space-between"
  },
  metricLabel: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  metricValue: { color: "#f8fafc", fontSize: 21, fontWeight: "900" },
  warningTitle: { color: "#fbbf24", fontSize: 17, fontWeight: "900" }
});
