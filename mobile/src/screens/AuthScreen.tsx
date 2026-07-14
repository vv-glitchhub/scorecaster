import { useState } from "react";
import { Alert, Linking, SafeAreaView, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { apiBaseUrl } from "../lib/api";
import { supabase } from "../lib/supabase";
import { ActionButton, Card, Field, styles } from "../ui";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(mode: "signin" | "signup") {
    if (!email.trim() || password.length < 8) {
      Alert.alert("Tarkista tiedot", "Anna sähköposti ja vähintään 8 merkin salasana.");
      return;
    }

    setBusy(true);
    const credentials = { email: email.trim(), password };
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp(credentials);
    setBusy(false);

    if (result.error) {
      Alert.alert("Kirjautuminen epäonnistui", result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      Alert.alert(
        "Vahvista sähköposti",
        "Avaa vahvistuslinkki sähköpostistasi ja palaa sitten kirjautumaan sovellukseen."
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>S</Text>
        <Text style={styles.title}>Scorecaster</Text>
        <Text style={styles.subtitle}>
          Urheiluanalyysi, paperivedot ja riskinhallinta. Ei talletuksia eikä oikean rahan vedonlyöntiä.
        </Text>

        <Card>
          <Field
            label="Sähköposti"
            value={email}
            onChangeText={setEmail}
            placeholder="sinä@example.com"
            keyboardType="email-address"
          />
          <Field
            label="Salasana"
            value={password}
            onChangeText={setPassword}
            placeholder="Vähintään 8 merkkiä"
            secureTextEntry
          />
          <ActionButton label={busy ? "Odota…" : "Kirjaudu"} onPress={() => submit("signin")} disabled={busy} />
          <ActionButton label="Luo tili" onPress={() => submit("signup")} disabled={busy} tone="secondary" />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Tietosuoja ennen käyttöä</Text>
          <Text style={styles.muted}>
            Scorecaster tallentaa vain tilin, virtuaalisen pelikassan ja paperiseurannan tietoja. Se ei pyydä pankki-, maksukortti- tai vedonlyöntitilien tunnuksia.
          </Text>
          <View style={styles.actionRow}>
            <ActionButton label="Tietosuoja" onPress={() => Linking.openURL(`${apiBaseUrl}/privacy`)} tone="secondary" compact />
            <ActionButton label="Käyttöehdot" onPress={() => Linking.openURL(`${apiBaseUrl}/terms`)} tone="secondary" compact />
            <ActionButton label="Vastuullinen käyttö" onPress={() => Linking.openURL(`${apiBaseUrl}/responsible-use`)} tone="secondary" compact />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
