import { useEffect, useState } from "react";
import { Alert, ActivityIndicator, ScrollView, Text } from "react-native";
import { apiRequest } from "../lib/api";
import type { Bankroll } from "../types";
import { ActionButton, Card, Field, money, styles } from "../ui";

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export default function HomeScreen() {
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [bankrollInput, setBankrollInput] = useState("1000");
  const [maxStakeInput, setMaxStakeInput] = useState("2");
  const [dailyExposureInput, setDailyExposureInput] = useState("8");
  const [status, setStatus] = useState("Tarkistetaan palvelua…");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [health, bankrollResponse] = await Promise.all([
        apiRequest<{ status?: string; mode?: string }>("/api/health", { authenticated: false }),
        apiRequest<{ data: Bankroll }>("/api/cloud/bankroll")
      ]);
      const next = bankrollResponse.data;
      setStatus(`${health.status || "unknown"} · ${health.mode || "unknown"}`);
      setBankroll(next);
      setBankrollInput(String(next.bankroll));
      setMaxStakeInput(String(next.max_stake_percent));
      setDailyExposureInput(String(next.max_daily_exposure_percent));
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

    if (
      bankrollNumber === null || bankrollNumber < 0 || bankrollNumber > 10000000 ||
      maxStake === null || maxStake < 0.1 || maxStake > 10 ||
      dailyExposure === null || dailyExposure < 0.5 || dailyExposure > 50
    ) {
      Alert.alert(
        "Tarkista rajat",
        "Virtuaalikassa 0–10 000 000, yksittäinen paperipanos 0,1–10 % ja päiväaltistus 0,5–50 %."
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
          maxSingleLeagueExposurePercent: bankroll?.max_single_league_exposure_percent || 4,
          minEdge: bankroll?.min_edge || 0.025,
          minConfidence: bankroll?.min_confidence || 0.58
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

  const suggestedMaximum = bankroll
    ? bankroll.bankroll * bankroll.max_stake_percent / 100
    : 0;

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Tänään</Text>
      <Text style={styles.subtitle}>Tee päätös numeroiden perusteella ja hyväksy myös SKIP.</Text>

      {loading ? (
        <ActivityIndicator color="#34d399" size="large" />
      ) : (
        <>
          <Card>
            <Text style={styles.cardTitle}>Paperipelikassa</Text>
            <Text style={styles.metric}>{money(bankroll?.bankroll)}</Text>
            <Text style={styles.muted}>Laskennallinen enimmäispanos {money(suggestedMaximum)} nykyisellä rajalla.</Text>
          </Card>

          <Card>
            <Text style={styles.cardTitle}>Muokkaa paperirajoja</Text>
            <Field label="Virtuaalikassa (€)" value={bankrollInput} onChangeText={setBankrollInput} keyboardType="decimal-pad" />
            <Field label="Enimmäispanos (%)" value={maxStakeInput} onChangeText={setMaxStakeInput} keyboardType="decimal-pad" />
            <Field label="Päivän enimmäisaltistus (%)" value={dailyExposureInput} onChangeText={setDailyExposureInput} keyboardType="decimal-pad" />
            <ActionButton label={saving ? "Tallennetaan…" : "Tallenna paperirajat"} onPress={save} disabled={saving} />
          </Card>
        </>
      )}

      <Card>
        <Text style={styles.cardTitle}>Palvelun tila</Text>
        <Text style={styles.value}>{status}</Text>
        <Text style={styles.muted}>Mobiilisovellus käyttää suojattuja käyttäjäkohtaisia pilvireittejä ja palvelimen laskemia rajoja.</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Tuotteen raja</Text>
        <Text style={styles.value}>Analyysi + paperiseuranta</Text>
        <Text style={styles.muted}>Ei talletuksia, kotiutuksia, maksutietoja, vedonlyöntitilejä tai oikean rahan vedonvälitystä.</Text>
      </Card>
    </ScrollView>
  );
}
