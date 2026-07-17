import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { languageOptions, useLanguage } from "../i18n";
import { apiBaseUrl, apiRequest } from "../lib/api";
import { supabase } from "../lib/supabase";
import { ActionButton, Card, Field, styles } from "../ui";

const DELETE_CONFIRMATION = "DELETE MY SCORECASTER ACCOUNT";

export default function SettingsScreen({ session }: { session: Session }) {
  const { language, setLanguage, tr } = useLanguage();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true);
    try {
      const response = await apiRequest<Record<string, unknown>>("/api/account/export");
      if (!FileSystem.cacheDirectory) throw new Error(tr({ fi: "Laitteen väliaikaishakemisto ei ole käytettävissä", en: "The temporary device directory is unavailable", es: "El directorio temporal del dispositivo no está disponible" }));

      const date = new Date().toISOString().slice(0, 10);
      const path = `${FileSystem.cacheDirectory}scorecaster-export-${date}.json`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(response, null, 2), { encoding: FileSystem.EncodingType.UTF8 });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          tr({ fi: "Vienti luotiin", en: "Export created", es: "Exportación creada" }),
          tr({ fi: "Laitteen jakotoiminto ei ole käytettävissä tässä ympäristössä.", en: "Device sharing is unavailable in this environment.", es: "La función de compartir no está disponible en este entorno." })
        );
        return;
      }

      await Sharing.shareAsync(path, {
        dialogTitle: tr({ fi: "Vie Scorecaster-tiedot", en: "Export Scorecaster data", es: "Exportar datos de Scorecaster" }),
        mimeType: "application/json",
        UTI: "public.json"
      });
    } catch (error) {
      Alert.alert(
        tr({ fi: "Vienti epäonnistui", en: "Export failed", es: "La exportación falló" }),
        error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" })
      );
    } finally {
      setBusy(false);
    }
  }

  function deleteAccount() {
    const email = session.user.email || "";
    if (confirmation !== DELETE_CONFIRMATION) {
      Alert.alert(
        tr({ fi: "Vahvistus puuttuu", en: "Confirmation missing", es: "Falta la confirmación" }),
        tr({ fi: "Kirjoita vahvistuslause täsmälleen oikein.", en: "Enter the confirmation phrase exactly.", es: "Escribe exactamente la frase de confirmación." })
      );
      return;
    }

    Alert.alert(
      tr({ fi: "Poistetaanko tili pysyvästi?", en: "Delete the account permanently?", es: "¿Eliminar la cuenta permanentemente?" }),
      tr({ fi: "Profiili, paperikohteet ja virtuaalikassa poistetaan. Tätä ei voi perua.", en: "The profile, paper picks and virtual bankroll will be deleted. This cannot be undone.", es: "Se eliminarán el perfil, los pronósticos simulados y la banca virtual. No se puede deshacer." }),
      [
        { text: tr({ fi: "Peruuta", en: "Cancel", es: "Cancelar" }), style: "cancel" },
        {
          text: tr({ fi: "Poista tili", en: "Delete account", es: "Eliminar cuenta" }),
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await apiRequest("/api/account", { method: "DELETE", body: { confirmation, email } });
              await supabase.auth.signOut({ scope: "local" });
            } catch (error) {
              Alert.alert(
                tr({ fi: "Tilin poisto epäonnistui", en: "Account deletion failed", es: "No se pudo eliminar la cuenta" }),
                error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" })
              );
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
      <Text style={styles.title}>{tr({ fi: "Profiili ja tietosuoja", en: "Profile and privacy", es: "Perfil y privacidad" })}</Text>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Kieli", en: "Language", es: "Idioma" })}</Text>
        <Text style={styles.muted}>{tr({ fi: "Valinta säilyy turvallisesti tällä laitteella.", en: "Your choice is stored safely on this device.", es: "La selección se guarda de forma segura en este dispositivo." })}</Text>
        <View style={styles.actionRow}>
          {languageOptions.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: language === item.code }}
              key={item.code}
              onPress={() => setLanguage(item.code)}
              style={({ pressed }) => [
                {
                  borderWidth: 1,
                  borderColor: language === item.code ? "#34d399" : "#334155",
                  backgroundColor: language === item.code ? "#064e3b" : "#0f172a",
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10
                },
                pressed && { opacity: 0.7 }
              ]}
            >
              <Text style={{ color: language === item.code ? "#a7f3d0" : "#cbd5e1", fontWeight: "900" }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Kirjautunut käyttäjä", en: "Signed-in user", es: "Usuario conectado" })}</Text>
        <Text style={styles.value}>{session.user.email}</Text>
        <Text style={styles.muted}>{tr({ fi: "Istuntotunnus säilytetään laitteen suojatussa avainsäilössä.", en: "The session token is stored in the device's protected key store.", es: "El token de sesión se guarda en el almacén protegido del dispositivo." })}</Text>
        <ActionButton label={tr({ fi: "Kirjaudu ulos", en: "Sign out", es: "Cerrar sesión" })} onPress={() => supabase.auth.signOut()} tone="secondary" />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Omat tiedot", en: "Your data", es: "Tus datos" })}</Text>
        <Text style={styles.muted}>{tr({ fi: "Lataa profiili, virtuaalikassa ja paperihistoria JSON-tiedostona.", en: "Download your profile, virtual bankroll and paper history as a JSON file.", es: "Descarga el perfil, la banca virtual y el historial simulado en un archivo JSON." })}</Text>
        <ActionButton label={busy ? tr({ fi: "Valmistellaan…", en: "Preparing…", es: "Preparando…" }) : tr({ fi: "Vie omat tiedot", en: "Export your data", es: "Exportar tus datos" })} onPress={exportData} disabled={busy} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Säännöt ja turvallisuus", en: "Rules and security", es: "Reglas y seguridad" })}</Text>
        <Text style={styles.muted}>{tr({ fi: "Scorecaster ei käsittele oikeaa rahaa, maksukortteja, pankkitilejä tai vedonlyöntitilien tunnuksia.", en: "Scorecaster does not handle real money, payment cards, bank accounts or bookmaker credentials.", es: "Scorecaster no gestiona dinero real, tarjetas, cuentas bancarias ni credenciales de casas de apuestas." })}</Text>
        <View style={styles.actionRow}>
          <ActionButton label={tr({ fi: "Tietosuoja", en: "Privacy", es: "Privacidad" })} onPress={() => Linking.openURL(`${apiBaseUrl}/privacy`)} tone="secondary" compact />
          <ActionButton label={tr({ fi: "Käyttöehdot", en: "Terms", es: "Términos" })} onPress={() => Linking.openURL(`${apiBaseUrl}/terms`)} tone="secondary" compact />
          <ActionButton label={tr({ fi: "Vastuullinen käyttö", en: "Responsible use", es: "Uso responsable" })} onPress={() => Linking.openURL(`${apiBaseUrl}/responsible-use`)} tone="secondary" compact />
          <ActionButton label={tr({ fi: "Turvallisuus", en: "Security", es: "Seguridad" })} onPress={() => Linking.openURL(`${apiBaseUrl}/security`)} tone="secondary" compact />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Poista tili", en: "Delete account", es: "Eliminar cuenta" })}</Text>
        <Text style={styles.muted}>{tr({ fi: "Kirjoita alla oleva vahvistuslause englanniksi. Poisto hävittää käyttäjätilin ja paperiseurannan pysyvästi.", en: "Enter the confirmation phrase below. Deletion permanently removes the user account and paper tracking.", es: "Escribe la frase de confirmación en inglés. La eliminación borra permanentemente la cuenta y el seguimiento simulado." })}</Text>
        <Field label={tr({ fi: "Vahvistuslause", en: "Confirmation phrase", es: "Frase de confirmación" })} value={confirmation} onChangeText={setConfirmation} placeholder={DELETE_CONFIRMATION} autoCapitalize="characters" />
        <ActionButton label={tr({ fi: "Poista tili pysyvästi", en: "Delete account permanently", es: "Eliminar cuenta permanentemente" })} onPress={deleteAccount} disabled={busy} tone="danger" />
      </Card>
    </ScrollView>
  );
}
