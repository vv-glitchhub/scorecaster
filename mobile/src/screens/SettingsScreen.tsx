import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { languageOptions, useLanguage } from "../i18n";
import { apiBaseUrl, apiRequest } from "../lib/api";
import {
  loadNotificationRegistry,
  localNotificationDeviceId,
  registerNotificationDevice,
  unregisterNotificationDevice,
  updateNotificationPreferences,
  type NotificationPreferences,
  type NotificationRegistry
} from "../lib/notifications";
import { supabase } from "../lib/supabase";
import { ActionButton, Card, Field, styles } from "../ui";

const DELETE_CONFIRMATION = "DELETE MY SCORECASTER ACCOUNT";

type EditablePreference = Exclude<keyof NotificationPreferences, "push_enabled">;

export default function SettingsScreen({ session }: { session: Session }) {
  const { language, setLanguage, tr } = useLanguage();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [registry, setRegistry] = useState<NotificationRegistry | null>(null);
  const [thisDeviceId, setThisDeviceId] = useState<string | null>(null);

  async function refreshNotifications() {
    try {
      const [nextRegistry, localId] = await Promise.all([
        loadNotificationRegistry(),
        localNotificationDeviceId()
      ]);
      setRegistry(nextRegistry);
      setThisDeviceId(localId);
    } catch {
      setRegistry(null);
      setThisDeviceId(null);
    }
  }

  useEffect(() => { void refreshNotifications(); }, []);

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

  async function setPreference(key: EditablePreference) {
    if (!registry?.available) return;
    setBusy(true);
    try {
      const next = await updateNotificationPreferences({ [key]: !registry.preferences[key] });
      setRegistry(next);
    } catch (error) {
      Alert.alert(
        tr({ fi: "Ilmoitusasetusta ei voitu tallentaa", en: "Notification preference could not be saved", es: "No se pudo guardar la preferencia" }),
        error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" })
      );
    } finally {
      setBusy(false);
    }
  }

  async function enableThisDevice() {
    setBusy(true);
    try {
      const next = await registerNotificationDevice();
      setRegistry(next);
      setThisDeviceId(next.deviceId || null);
      Alert.alert(
        tr({ fi: "Laite rekisteröitiin", en: "Device registered", es: "Dispositivo registrado" }),
        tr({ fi: "Lupa ja token ovat valmiina. Taustalla toimivaa lähetysworkeria ei ole vielä aktivoitu.", en: "Permission and token registration are ready. The background delivery worker is not active yet.", es: "El permiso y el token están listos. El proceso de envío en segundo plano aún no está activo." })
      );
    } catch (error) {
      Alert.alert(
        tr({ fi: "Push-rekisteröinti epäonnistui", en: "Push registration failed", es: "Falló el registro push" }),
        error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" })
      );
    } finally {
      setBusy(false);
    }
  }

  async function disableThisDevice() {
    setBusy(true);
    try {
      const next = await unregisterNotificationDevice();
      setRegistry(next);
      setThisDeviceId(null);
    } catch (error) {
      Alert.alert(
        tr({ fi: "Laitetta ei voitu poistaa", en: "Device could not be removed", es: "No se pudo eliminar el dispositivo" }),
        error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" })
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOutSafely() {
    setBusy(true);
    try {
      if (thisDeviceId) await unregisterNotificationDevice();
      await supabase.auth.signOut();
    } catch (error) {
      Alert.alert(
        tr({ fi: "Uloskirjautumista ei viimeistelty", en: "Sign-out was not completed", es: "No se completó el cierre de sesión" }),
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
      tr({ fi: "Profiili, paperikohteet, seurantalista, hälytyshistoria, ilmoituslaitteet ja virtuaalikassa poistetaan. Tätä ei voi perua.", en: "The profile, paper picks, watchlist, alert history, notification devices and virtual bankroll will be deleted. This cannot be undone.", es: "Se eliminarán el perfil, los pronósticos, la lista, las alertas, los dispositivos y la banca virtual. No se puede deshacer." }),
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

  const preferenceItems: Array<{ key: EditablePreference; label: string }> = [
    { key: "in_app_enabled", label: tr({ fi: "Sovelluksen inbox", en: "In-app inbox", es: "Buzón de la app" }) },
    { key: "high_enabled", label: tr({ fi: "Korkeat hälytykset", en: "High alerts", es: "Alertas altas" }) },
    { key: "medium_enabled", label: tr({ fi: "Keskitason hälytykset", en: "Medium alerts", es: "Alertas medias" }) },
    { key: "info_enabled", label: tr({ fi: "Info-hälytykset", en: "Info alerts", es: "Alertas informativas" }) },
    { key: "kickoff_enabled", label: tr({ fi: "Ottelun alku", en: "Kickoff", es: "Inicio" }) },
    { key: "decision_enabled", label: tr({ fi: "Päätösmuutos", en: "Decision change", es: "Cambio de decisión" }) },
    { key: "price_enabled", label: tr({ fi: "Hintamuutos", en: "Price change", es: "Cambio de cuota" }) }
  ];

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{tr({ fi: "Profiili ja tietosuoja", en: "Profile and privacy", es: "Perfil y privacidad" })}</Text>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Kieli", en: "Language", es: "Idioma" })}</Text>
        <Text style={styles.muted}>{tr({ fi: "Valinta säilyy turvallisesti tällä laitteella.", en: "Your choice is stored safely on this device.", es: "La selección se guarda de forma segura en este dispositivo." })}</Text>
        <View style={styles.actionRow}>
          {languageOptions.map((item) => (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: language === item.code }} key={item.code} onPress={() => setLanguage(item.code)} style={({ pressed }) => [{ borderWidth: 1, borderColor: language === item.code ? "#34d399" : "#334155", backgroundColor: language === item.code ? "#064e3b" : "#0f172a", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }, pressed && { opacity: 0.7 }]}>
              <Text style={{ color: language === item.code ? "#a7f3d0" : "#cbd5e1", fontWeight: "900" }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Ilmoitukset", en: "Notifications", es: "Notificaciones" })}</Text>
        <Text style={styles.muted}>{tr({ fi: "Ilmoitukset ovat vapaaehtoisia. Token rekisteröidään vasta painikkeesta ja käyttöjärjestelmän luvalla.", en: "Notifications are optional. A token is registered only after pressing the button and granting system permission.", es: "Las notificaciones son opcionales. El token solo se registra tras pulsar el botón y conceder permiso." })}</Text>
        {registry?.warning ? <Text style={styles.muted}>{registry.warning}</Text> : null}
        <Text style={styles.muted}>{tr({ fi: "Rekisteröityjä laitteita", en: "Registered devices", es: "Dispositivos registrados" })}: {registry?.devices?.length || 0} · {tr({ fi: "taustalähetys", en: "background delivery", es: "envío en segundo plano" })}: {registry?.deliveryActive ? tr({ fi: "aktiivinen", en: "active", es: "activo" }) : tr({ fi: "ei vielä aktiivinen", en: "not active yet", es: "aún no activo" })}</Text>
        <View style={styles.actionRow}>
          {preferenceItems.map((item) => {
            const active = Boolean(registry?.preferences?.[item.key]);
            return <Pressable accessibilityRole="switch" accessibilityState={{ checked: active, disabled: busy || !registry?.available }} disabled={busy || !registry?.available} key={item.key} onPress={() => setPreference(item.key)} style={({ pressed }) => [{ borderWidth: 1, borderColor: active ? "#34d399" : "#334155", backgroundColor: active ? "#064e3b" : "#0f172a", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, opacity: pressed ? 0.7 : 1 }]}><Text style={{ color: active ? "#d1fae5" : "#94a3b8", fontWeight: "900", fontSize: 12 }}>{active ? "✓ " : ""}{item.label}</Text></Pressable>;
          })}
        </View>
        {thisDeviceId ? <ActionButton label={tr({ fi: "Poista push tältä laitteelta", en: "Disable push on this device", es: "Desactivar push en este dispositivo" })} onPress={disableThisDevice} tone="danger" disabled={busy} /> : <ActionButton label={tr({ fi: "Salli push tällä laitteella", en: "Enable push on this device", es: "Activar push en este dispositivo" })} onPress={enableThisDevice} disabled={busy || registry?.available === false} />}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Kirjautunut käyttäjä", en: "Signed-in user", es: "Usuario conectado" })}</Text>
        <Text style={styles.value}>{session.user.email}</Text>
        <Text style={styles.muted}>{tr({ fi: "Istuntotunnus ja tämän laitteen ilmoitusrekisterin tunniste säilytetään laitteen suojatussa avainsäilössä.", en: "The session token and this device's notification registration ID are stored in the protected device key store.", es: "El token de sesión y el identificador de notificaciones se guardan en el almacén protegido." })}</Text>
        <ActionButton label={tr({ fi: "Kirjaudu ulos", en: "Sign out", es: "Cerrar sesión" })} onPress={signOutSafely} tone="secondary" disabled={busy} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Omat tiedot", en: "Your data", es: "Tus datos" })}</Text>
        <Text style={styles.muted}>{tr({ fi: "Lataa profiili, virtuaalikassa, paperihistoria, seurantalista, hälytyshistoria ja ilmoituslaitteiden metatiedot JSON-tiedostona. Toimitustokenia ei sisällytetä vientiin.", en: "Download your profile, virtual bankroll, paper history, watchlist, alert history and notification-device metadata as JSON. Delivery tokens are not included.", es: "Descarga perfil, banca, historial, lista, alertas y metadatos de dispositivos. Los tokens no se incluyen." })}</Text>
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
        <Text style={styles.muted}>{tr({ fi: "Kirjoita alla oleva vahvistuslause englanniksi. Poisto hävittää käyttäjätilin ja kaiken käyttäjäkohtaisen seuranta- ja ilmoitusdatan pysyvästi.", en: "Enter the confirmation phrase below. Deletion permanently removes the account and all user-specific tracking and notification data.", es: "Escribe la frase de confirmación. La eliminación borra permanentemente la cuenta y todos los datos de seguimiento y notificaciones." })}</Text>
        <Field label={tr({ fi: "Vahvistuslause", en: "Confirmation phrase", es: "Frase de confirmación" })} value={confirmation} onChangeText={setConfirmation} placeholder={DELETE_CONFIRMATION} autoCapitalize="characters" />
        <ActionButton label={tr({ fi: "Poista tili pysyvästi", en: "Delete account permanently", es: "Eliminar cuenta permanentemente" })} onPress={deleteAccount} disabled={busy} tone="danger" />
      </Card>
    </ScrollView>
  );
}
