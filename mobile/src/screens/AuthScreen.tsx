import { useState } from "react";
import { Alert, Linking, SafeAreaView, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLanguage } from "../i18n";
import { apiBaseUrl } from "../lib/api";
import { authRedirectUrl } from "../lib/auth-deep-link";
import { supabase } from "../lib/supabase";
import { ActionButton, Card, Field, styles } from "../ui";

export default function AuthScreen() {
  const { tr } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(mode: "signin" | "signup") {
    if (!email.trim() || password.length < 8) {
      Alert.alert(
        tr({ fi: "Tarkista tiedot", en: "Check your details", es: "Revisa los datos" }),
        tr({ fi: "Anna sähköposti ja vähintään 8 merkin salasana.", en: "Enter an email and a password with at least 8 characters.", es: "Introduce un correo y una contraseña de al menos 8 caracteres." })
      );
      return;
    }

    setBusy(true);
    const credentials = { email: email.trim(), password };
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp({
          ...credentials,
          options: { emailRedirectTo: authRedirectUrl }
        });
    setBusy(false);

    if (result.error) {
      Alert.alert(tr({ fi: "Kirjautuminen epäonnistui", en: "Authentication failed", es: "La autenticación falló" }), result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      Alert.alert(
        tr({ fi: "Vahvista sähköposti", en: "Confirm your email", es: "Confirma tu correo" }),
        tr({ fi: "Avaa vahvistuslinkki sähköpostistasi. Linkki palaa automaattisesti Scorecasteriin.", en: "Open the confirmation link in your email. The link returns automatically to Scorecaster.", es: "Abre el enlace de confirmación del correo. El enlace vuelve automáticamente a Scorecaster." })
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>S</Text>
        <Text style={styles.title}>Scorecaster</Text>
        <Text style={styles.subtitle}>{tr({ fi: "Urheiluanalyysi, paperikohteet ja riskinhallinta. Ei talletuksia eikä oikean rahan vedonlyöntiä.", en: "Sports analysis, paper picks and risk control. No deposits or real-money betting.", es: "Análisis deportivo, pronósticos simulados y control de riesgo. Sin depósitos ni apuestas con dinero real." })}</Text>

        <Card>
          <Field label={tr({ fi: "Sähköposti", en: "Email", es: "Correo electrónico" })} value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <Field label={tr({ fi: "Salasana", en: "Password", es: "Contraseña" })} value={password} onChangeText={setPassword} placeholder={tr({ fi: "Vähintään 8 merkkiä", en: "At least 8 characters", es: "Al menos 8 caracteres" })} secureTextEntry />
          <ActionButton label={busy ? tr({ fi: "Odota…", en: "Please wait…", es: "Espera…" }) : tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })} onPress={() => submit("signin")} disabled={busy} />
          <ActionButton label={tr({ fi: "Luo tili", en: "Create account", es: "Crear cuenta" })} onPress={() => submit("signup")} disabled={busy} tone="secondary" />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>{tr({ fi: "Tietosuoja ennen käyttöä", en: "Privacy before use", es: "Privacidad antes de usar" })}</Text>
          <Text style={styles.muted}>{tr({ fi: "Scorecaster tallentaa vain tilin, virtuaalisen pelikassan ja paperiseurannan tietoja. Se ei pyydä pankki-, maksukortti- tai vedonlyöntitilien tunnuksia.", en: "Scorecaster stores only account, virtual-bankroll and paper-tracking data. It does not request bank, card or bookmaker credentials.", es: "Scorecaster guarda solo datos de cuenta, banca virtual y seguimiento simulado. No solicita datos bancarios, de tarjeta ni credenciales de casas de apuestas." })}</Text>
          <View style={styles.actionRow}>
            <ActionButton label={tr({ fi: "Tietosuoja", en: "Privacy", es: "Privacidad" })} onPress={() => Linking.openURL(`${apiBaseUrl}/privacy`)} tone="secondary" compact />
            <ActionButton label={tr({ fi: "Käyttöehdot", en: "Terms", es: "Términos" })} onPress={() => Linking.openURL(`${apiBaseUrl}/terms`)} tone="secondary" compact />
            <ActionButton label={tr({ fi: "Vastuullinen käyttö", en: "Responsible use", es: "Uso responsable" })} onPress={() => Linking.openURL(`${apiBaseUrl}/responsible-use`)} tone="secondary" compact />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
