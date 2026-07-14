import { useState } from "react";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { apiBaseUrl, apiRequest } from "../lib/api";
import { supabase } from "../lib/supabase";
import { ActionButton, Card, Field, styles } from "../ui";

const DELETE_CONFIRMATION = "DELETE MY SCORECASTER ACCOUNT";

export default function SettingsScreen({ session }: { session: Session }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true);
    try {
      const response = await apiRequest<Record<string, unknown>>("/api/account/export");
      if (!FileSystem.cacheDirectory) throw new Error("Laitteen väliaikaishakemisto ei ole käytettävissä");

      const date = new Date().toISOString().slice(0, 10);
      const path = `${FileSystem.cacheDirectory}scorecaster-export-${date}.json`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(response, null, 2), {
        encoding: FileSystem.EncodingType.UTF8
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Vienti luotiin", "Laitteen jakotoiminto ei ole käytettävissä tässä ympäristössä.");
        return;
      }

      await Sharing.shareAsync(path, {
        dialogTitle: "Vie Scorecaster-tiedot",
        mimeType: "application/json",
        UTI: "public.json"
      });
    } catch (error) {
      Alert.alert("Vienti epäonnistui", error instanceof Error ? error.message : "Tuntematon virhe");
    } finally {
      setBusy(false);
    }
  }

  function deleteAccount() {
    const email = session.user.email || "";
    if (confirmation !== DELETE_CONFIRMATION) {
      Alert.alert("Vahvistus puuttuu", "Kirjoita vahvistuslause täsmälleen oikein.");
      return;
    }

    Alert.alert(
      "Poistetaanko tili pysyvästi?",
      "Profiili, paperivedot ja paperipelikassa poistetaan. Tätä ei voi perua.",
      [
        { text: "Peruuta", style: "cancel" },
        {
          text: "Poista tili",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await apiRequest("/api/account", {
                method: "DELETE",
                body: { confirmation, email }
              });
              await supabase.auth.signOut({ scope: "local" });
            } catch (error) {
              Alert.alert("Tilin poisto epäonnistui", error instanceof Error ? error.message : "Tuntematon virhe");
            } finally {
              setBusy(false);
            }
          }
        }
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Profiili ja tietosuoja</Text>

      <Card>
        <Text style={styles.cardTitle}>Kirjautunut käyttäjä</Text>
        <Text style={styles.value}>{session.user.email}</Text>
        <Text style={styles.muted}>Session tunnus säilytetään laitteen suojatussa avainsäilössä.</Text>
        <ActionButton label="Kirjaudu ulos" onPress={() => supabase.auth.signOut()} tone="secondary" />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Omat tiedot</Text>
        <Text style={styles.muted}>Lataa profiili, paperipelikassa ja paperivetohistoria JSON-tiedostona laitteen jakovalikon kautta.</Text>
        <ActionButton label={busy ? "Valmistellaan…" : "Vie omat tiedot"} onPress={exportData} disabled={busy} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Säännöt ja turvallisuus</Text>
        <Text style={styles.muted}>Scorecaster ei käsittele oikeaa rahaa, maksukortteja, pankkitilejä tai vedonlyöntitilien tunnuksia.</Text>
        <View style={styles.actionRow}>
          <ActionButton label="Tietosuoja" onPress={() => Linking.openURL(`${apiBaseUrl}/privacy`)} tone="secondary" compact />
          <ActionButton label="Käyttöehdot" onPress={() => Linking.openURL(`${apiBaseUrl}/terms`)} tone="secondary" compact />
          <ActionButton label="Vastuullinen käyttö" onPress={() => Linking.openURL(`${apiBaseUrl}/responsible-use`)} tone="secondary" compact />
          <ActionButton label="Turvallisuus" onPress={() => Linking.openURL(`${apiBaseUrl}/security`)} tone="secondary" compact />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Poista tili</Text>
        <Text style={styles.muted}>Kirjoita {DELETE_CONFIRMATION}. Poisto hävittää käyttäjätilin ja paperiseurannan pysyvästi.</Text>
        <Field
          label="Vahvistuslause"
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder={DELETE_CONFIRMATION}
          autoCapitalize="characters"
        />
        <ActionButton label="Poista tili pysyvästi" onPress={deleteAccount} disabled={busy} tone="danger" />
      </Card>
    </ScrollView>
  );
}
